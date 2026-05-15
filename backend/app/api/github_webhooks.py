"""
GitHub Webhook receiver — receives PR events and sends Slack notifications.

Supports two modes:
1. GitHub App mode (preferred): Uses GITHUB_APP_WEBHOOK_SECRET env var to
   verify all incoming webhooks. The GitHub App is installed on the org/repo
   and sends PR events automatically — no per-user admin access needed.
2. Legacy per-repo mode: Falls back to per-repo secrets stored in
   the monitored_repos table if GITHUB_APP_WEBHOOK_SECRET is not set.
"""

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, BackgroundTasks, Request, HTTPException
from sqlalchemy import select

from app.models.database import AsyncSessionLocal
from app.models.slack_models import MonitoredRepo, RepoChannelMapping, SlackInstallation
from app.models.workflow_models import Workflow, WorkflowStatus
from app.api.webhooks import run_workflow_background
from app.tools.slack import send_slack_message

router = APIRouter()
logger = logging.getLogger(__name__)

# GitHub App webhook secret — set this to use App mode (recommended)
GITHUB_APP_WEBHOOK_SECRET = os.getenv("GITHUB_APP_WEBHOOK_SECRET", "")


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
    Receive a GitHub webhook event. Called by GitHub (unauthenticated).
    Verifies HMAC signature, then creates workflows and sends Slack notifications.
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
    # Actions that create a full workflow (agent pipeline run)
    workflow_actions = {"opened"}
    # Actions that only send a Slack notification (no workflow)
    notify_only_actions = {"closed", "reopened", "synchronize", "ready_for_review", "review_requested"}
    all_actions = workflow_actions | notify_only_actions
    if action not in all_actions:
        return {"ok": True, "message": f"ignored action: {action}"}

    # ── Signature verification ──
    if GITHUB_APP_WEBHOOK_SECRET:
        # GitHub App mode: single shared secret
        if not _verify_signature(payload_body, GITHUB_APP_WEBHOOK_SECRET, signature):
            logger.warning(f"Invalid GitHub App webhook signature for {repo_full_name}")
            raise HTTPException(status_code=401, detail="Invalid signature")
    else:
        # Legacy per-repo mode
        async with AsyncSessionLocal() as _legacy_db:
            result = await _legacy_db.execute(
                select(MonitoredRepo).where(
                    MonitoredRepo.repo_full_name == repo_full_name
                )
            )
            monitored_repos = result.scalars().all()
            if not monitored_repos:
                logger.info(f"Received webhook for unmonitored repo: {repo_full_name}")
                return {"ok": True, "message": "no monitors"}

            verified = any(
                _verify_signature(payload_body, mr.webhook_secret, signature)
                for mr in monitored_repos
            )
            if not verified:
                logger.warning(f"Invalid webhook signature for {repo_full_name}")
                raise HTTPException(status_code=401, detail="Invalid signature")

    # ── Process the event ──
    async with AsyncSessionLocal() as db:
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

        # Only create workflows for "opened" PRs — other actions just notify
        workflows = []
        if action in workflow_actions:
            # Create ONE workflow per event.
            # Try to assign it to the Nexus user who authored the PR.
            pr_author_login = (
                event.get("pull_request", {}).get("user", {}).get("login", "")
            ).lower()

            owner_user_id = mappings[0].user_id  # fallback
            if pr_author_login:
                from app.models.user_models import User
                author_result = await db.execute(
                    select(User).where(
                        User.github_username.ilike(pr_author_login)
                    )
                )
                author_user = author_result.scalar_one_or_none()
                if author_user:
                    owner_user_id = author_user.id

            workflow_payload = _build_workflow_payload(event)
            workflow = Workflow(
                user_id=owner_user_id,
                signal_type="github_pr",
                signal_payload=workflow_payload,
                status=WorkflowStatus.pending,
            )
            db.add(workflow)
            workflows.append(workflow)

            await db.commit()
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

        # Send to all mapped channels (deduplicate by channel_id)
        sent_count = 0
        errors = []
        seen_channels = set()
        for m in mappings:
            if m.channel_id in seen_channels:
                continue
            seen_channels.add(m.channel_id)

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
