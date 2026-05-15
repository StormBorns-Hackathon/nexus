"""
GitHub Webhook receiver — receives PR events and sends Slack notifications.

This endpoint is UNAUTHENTICATED (called by GitHub), but verifies the
X-Hub-Signature-256 header using the per-repo webhook secret stored in
the monitored_repos table.
"""

import hashlib
import hmac
import logging

from fastapi import APIRouter, BackgroundTasks, Request, HTTPException
from sqlalchemy import select

from app.models.database import AsyncSessionLocal
from app.models.slack_models import MonitoredRepo, RepoChannelMapping, SlackInstallation
from app.models.workflow_models import Workflow, WorkflowStatus
from app.api.webhooks import run_workflow_background
from app.tools.slack import send_slack_message

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_signature(payload_body: bytes, secret: str, signature_header: str | None) -> bool:
    """Verify the GitHub webhook signature (X-Hub-Signature-256)."""
    if not signature_header:
        return False

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        payload_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature_header)


def _format_pr_notification(event: dict) -> str:
    """Format a GitHub PR event into a readable Slack message."""
    action = event.get("action", "unknown")
    pr = event.get("pull_request", {})
    repo = event.get("repository", {})

    title = pr.get("title", "Untitled")
    pr_url = pr.get("html_url", "")
    pr_number = pr.get("number", "?")
    author = pr.get("user", {}).get("login", "unknown")
    repo_name = repo.get("full_name", "unknown")
    base_branch = pr.get("base", {}).get("ref", "")
    head_branch = pr.get("head", {}).get("ref", "")
    body = (pr.get("body") or "")[:300]
    additions = pr.get("additions", 0)
    deletions = pr.get("deletions", 0)
    changed_files = pr.get("changed_files", 0)
    merged = pr.get("merged", False)

    # Emoji based on action
    emoji_map = {
        "opened": "🆕",
        "closed": "🔴" if not merged else "🟣",
        "reopened": "🔄",
        "synchronize": "🔄",
        "ready_for_review": "👀",
        "review_requested": "👁️",
    }
    emoji = emoji_map.get(action, "📋")

    # Build the message
    if action == "closed" and merged:
        action_text = "merged"
        emoji = "🟣"
    else:
        action_text = action

    lines = [
        f"{emoji} *Pull Request {action_text}*",
        "",
        f"*<{pr_url}|#{pr_number} {title}>*",
        f"*Repo:* `{repo_name}`",
        f"*Author:* {author}",
        f"*Branch:* `{head_branch}` → `{base_branch}`",
    ]

    if action in ("opened", "synchronize", "ready_for_review") and changed_files:
        lines.append(f"*Changes:* {changed_files} files (+{additions} / -{deletions})")

    if body and action == "opened":
        lines.extend(["", f"_{body}{'…' if len(body) >= 300 else ''}_"])

    return "\n".join(lines)


def _build_workflow_payload(event: dict) -> dict:
    """Convert a GitHub pull_request webhook payload into our workflow signal."""
    pr = event.get("pull_request", {})
    repo = event.get("repository", {})

    return {
        "title": pr.get("title", ""),
        "url": pr.get("html_url", ""),
        "body": pr.get("body") or "",
        "author": pr.get("user", {}).get("login", "unknown"),
        "repo": repo.get("full_name", "").lower(),
        "number": pr.get("number") or event.get("number"),
        "state": pr.get("state", ""),
        "labels": [label.get("name", "") for label in pr.get("labels", [])],
        "changed_files": pr.get("changed_files", 0),
        "additions": pr.get("additions", 0),
        "deletions": pr.get("deletions", 0),
        "merged": pr.get("merged", False),
        "action": event.get("action", ""),
    }


@router.post("/webhook")
async def receive_github_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receive a GitHub webhook event. This is called by GitHub, not by our frontend.
    It's unauthenticated but we verify the HMAC signature.
    """
    payload_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    event_type = request.headers.get("X-GitHub-Event", "")

    # We only care about pull_request events
    if event_type == "ping":
        return {"ok": True, "message": "pong"}

    if event_type != "pull_request":
        return {"ok": True, "message": f"ignored event: {event_type}"}

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    repo_full_name = event.get("repository", {}).get("full_name", "").lower()
    if not repo_full_name:
        raise HTTPException(status_code=400, detail="Missing repository info")

    action = event.get("action", "")
    # Only notify on meaningful PR actions
    notify_actions = {"opened", "closed", "reopened", "synchronize", "ready_for_review", "review_requested"}
    if action not in notify_actions:
        return {"ok": True, "message": f"ignored action: {action}"}

    async with AsyncSessionLocal() as db:
        # Find all MonitoredRepo entries for this repo to verify signature
        result = await db.execute(
            select(MonitoredRepo).where(
                MonitoredRepo.repo_full_name == repo_full_name
            )
        )
        monitored_repos = result.scalars().all()

        if not monitored_repos:
            # No one is monitoring this repo
            logger.info(f"Received webhook for unmonitored repo: {repo_full_name}")
            return {"ok": True, "message": "no monitors"}

        # Verify signature against any of the stored secrets
        verified = False
        for mr in monitored_repos:
            if _verify_signature(payload_body, mr.webhook_secret, signature):
                verified = True
                break

        if not verified:
            logger.warning(f"Invalid webhook signature for {repo_full_name}")
            raise HTTPException(status_code=401, detail="Invalid signature")

        # Find all repo→channel mappings for this repo (across all users)
        mappings_result = await db.execute(
            select(RepoChannelMapping).where(
                RepoChannelMapping.repo_full_name == repo_full_name
            )
        )
        mappings = mappings_result.scalars().all()

        if not mappings:
            logger.info(f"No channel mappings for {repo_full_name}")
            return {"ok": True, "message": "no mappings"}

        # Create one workflow per mapped Nexus user, then let the normal pipeline
        # produce the trace and Slack report for that user's mapped channels.
        mapped_user_ids = {m.user_id for m in mappings}
        workflow_payload = _build_workflow_payload(event)
        workflows = []
        for user_id in mapped_user_ids:
            workflow = Workflow(
                user_id=user_id,
                signal_type="github_pr",
                signal_payload=workflow_payload,
                status=WorkflowStatus.pending,
            )
            db.add(workflow)
            workflows.append(workflow)

        await db.commit()
        for workflow in workflows:
            await db.refresh(workflow)
            background_tasks.add_task(run_workflow_background, workflow.id)

        # Group mappings by installation_id to batch token lookups
        installation_ids = {m.installation_id for m in mappings if m.installation_id}
        installations_map = {}
        if installation_ids:
            inst_result = await db.execute(
                select(SlackInstallation).where(
                    SlackInstallation.id.in_(installation_ids)
                )
            )
            for inst in inst_result.scalars().all():
                installations_map[inst.id] = inst

        # Format the notification message
        message = _format_pr_notification(event)

        # Send to all mapped channels
        sent_count = 0
        errors = []
        for m in mappings:
            inst = installations_map.get(m.installation_id)
            if not inst:
                errors.append(f"No installation for mapping {m.id}")
                continue

            try:
                resp = await send_slack_message(
                    channel=m.channel_id,
                    text=message,
                    bot_token=inst.bot_token,
                )
                if resp.get("ok"):
                    sent_count += 1
                    logger.info(f"Sent PR notification to #{m.channel_name} in {inst.team_name}")
                else:
                    errors.append(f"#{m.channel_name}: {resp.get('error', 'unknown')}")
            except Exception as e:
                errors.append(f"#{m.channel_name}: {str(e)}")

        logger.info(
            f"Webhook for {repo_full_name} PR#{event.get('number', '?')}: "
            f"sent={sent_count}, errors={len(errors)}"
        )

        return {
            "ok": True,
            "workflows": [str(workflow.id) for workflow in workflows],
            "sent": sent_count,
            "errors": errors if errors else None,
        }
