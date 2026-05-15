import re
import logging

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.models.database import get_db
from app.models.workflow_models import Workflow, WorkflowStep, WorkflowStatus
from app.models.user_models import User
from app.models import schemas
from app.api.webhooks import run_workflow_background
from app.utils.auth_utils import get_current_user
from app.tools.email_tool import send_pr_review_email, send_issue_assigned_email

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=schemas.WorkflowListResponse)
async def list_workflows(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.user_id == user.id)
        .order_by(Workflow.created_at.desc())
    )
    workflows = result.scalars().all()

    summaries = [
        schemas.WorkflowSummary(
            id=w.id,
            signal_type=w.signal_type,
            signal_payload=w.signal_payload,
            status=w.status,
            result_summary=w.result_summary,
            created_at=w.created_at,
            completed_at=w.completed_at,
        )
        for w in workflows
    ]

    return schemas.WorkflowListResponse(workflows=summaries)


@router.get("/{workflow_id}", response_model=schemas.WorkflowDetail)
async def get_workflow_detail(
    workflow_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = wf_result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Ensure the workflow belongs to the current user
    if workflow.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this workflow")

    steps_result = await db.execute(
        select(WorkflowStep)
        .where(WorkflowStep.workflow_id == workflow_id)
        .order_by(WorkflowStep.created_at.asc())
    )
    steps = steps_result.scalars().all()

    summary = schemas.WorkflowSummary(
        id=workflow.id,
        signal_type=workflow.signal_type,
        signal_payload=workflow.signal_payload,
        status=workflow.status,
        result_summary=workflow.result_summary,
        created_at=workflow.created_at,
        completed_at=workflow.completed_at,
    )

    steps_serialized = [
        {
            "id": s.id,
            "agent_name": s.agent_name,
            "step_type": s.step_type,
            "input_data": s.input_data,
            "output_data": s.output_data,
            "tool_name": s.tool_name,
            "duration_ms": s.duration_ms,
            "created_at": s.created_at,
        }
        for s in steps
    ]

    return schemas.WorkflowDetail(workflow=summary, steps=steps_serialized)


GITHUB_URL_PATTERN = re.compile(
    r"https?://github\.com/([^/]+)/([^/]+)/(pull|issues)/(\d+)",
    re.IGNORECASE,
)


@router.post("/trigger", status_code=201)
async def trigger_workflow(
    body: schemas.GithubTriggerRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    url = body.github_url.strip()
    match = GITHUB_URL_PATTERN.match(url)
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub URL. Expected: https://github.com/owner/repo/pull/123 or https://github.com/owner/repo/issues/123",
        )

    owner, repo, kind, number = match.groups()
    is_pr = kind == "pull"

    # Fetch details from GitHub API
    api_path = f"https://api.github.com/repos/{owner}/{repo}/{'pulls' if is_pr else 'issues'}/{number}"
    headers = {"Accept": "application/vnd.github.v3+json"}
    if user.github_access_token:
        headers["Authorization"] = f"Bearer {user.github_access_token}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            api_path,
            headers=headers,
            timeout=10,
        )

    if resp.status_code != 200:
        detail = (
            f"Could not fetch from GitHub (HTTP {resp.status_code}). "
            "Make sure the repo exists and your signed-in GitHub account has access."
        )
        if resp.status_code in (401, 403) and not user.github_access_token:
            detail = (
                "Could not fetch from GitHub because this Nexus account does not have "
                "a GitHub access token. Sign out and sign in with GitHub again."
            )
        raise HTTPException(
            status_code=400,
            detail=detail,
        )

    data = resp.json()

    pr_title = data.get("title", "")
    pr_author = data.get("user", {}).get("login", "unknown")
    repo_full = f"{owner}/{repo}"

    payload = {
        "title": pr_title,
        "url": url,
        "body": data.get("body", "") or "",
        "author": pr_author,
        "repo": repo_full,
        "number": int(number),
        "state": data.get("state", ""),
        "labels": [l["name"] for l in data.get("labels", [])],
    }

    if is_pr:
        payload["changed_files"] = data.get("changed_files", 0)
        payload["additions"] = data.get("additions", 0)
        payload["deletions"] = data.get("deletions", 0)
        payload["merged"] = data.get("merged", False)

    signal_type = "github_pr" if is_pr else "github_issue"

    # ── Collect email recipients for unified notification ──────
    email_recipients: list[dict] = []

    if is_pr:
        # Collect ALL reviewers: pending + those who already submitted reviews
        reviewer_logins: set[str] = set()
        reviewer_map: dict[str, dict] = {}

        pending_reviewers = data.get("requested_reviewers", [])
        print(f"[EMAIL DEBUG] requested_reviewers from PR data: {[r.get('login') for r in pending_reviewers]}")
        for r in pending_reviewers:
            login = r.get("login", "")
            if login:
                reviewer_logins.add(login)
                reviewer_map[login] = r

        # Also check reviews endpoint for reviewers who already reviewed
        reviews_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/reviews"
        async with httpx.AsyncClient() as client:
            reviews_resp = await client.get(reviews_url, headers=headers, timeout=10)
        print(f"[EMAIL DEBUG] Reviews API status: {reviews_resp.status_code}")
        if reviews_resp.status_code == 200:
            for review in reviews_resp.json():
                login = review.get("user", {}).get("login", "")
                if login and login != pr_author:
                    reviewer_logins.add(login)
                    if login not in reviewer_map:
                        reviewer_map[login] = review.get("user", {})

        print(f"[EMAIL DEBUG] PR #{number} — found {len(reviewer_logins)} reviewer(s): {', '.join(reviewer_logins) or '(none)'}")

        for login in reviewer_logins:
            gh_user = reviewer_map.get(login, {})
            email = _get_email_from_gh_user(gh_user)
            if not email:
                email = await _resolve_email(login, str(gh_user.get("id", "")), user.github_access_token)
            if email:
                email_recipients.append({"email": email, "role": "reviewer", "login": login})
                print(f"[EMAIL DEBUG] Resolved reviewer @{login} → {email}")
            else:
                print(f"[EMAIL DEBUG] Could not resolve email for @{login}")
    else:
        assignees = data.get("assignees", [])
        for assignee in assignees:
            login = assignee.get("login", "")
            email = _get_email_from_gh_user(assignee)
            if not email:
                email = await _resolve_email(login, str(assignee.get("id", "")), user.github_access_token)
            if email:
                email_recipients.append({"email": email, "role": "assignee", "login": login})

    print(f"[EMAIL DEBUG] Total email recipients: {len(email_recipients)} → {[r['email'] for r in email_recipients]}")

    # ── Create workflow ───────────────────────────────────────
    # Store recipients in payload so the pipeline can use them
    payload["_email_recipients"] = email_recipients

    workflow = Workflow(
        user_id=user.id,
        signal_type=signal_type,
        signal_payload=payload,
        status=WorkflowStatus.pending,
    )

    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    background_tasks.add_task(run_workflow_background, workflow.id)

    return {"workflow_id": workflow.id, "status": workflow.status}


# ──────────────── Helpers for email resolution ────────────────


def _get_email_from_gh_user(gh_user: dict) -> str | None:
    """Extract email directly from the GitHub API user object (if present)."""
    return gh_user.get("email") or None


async def _resolve_email(
    username: str, github_id: str, auth_token: str | None = None
) -> str | None:
    """Try DB lookup, then authenticated GitHub API, then public profile."""
    from app.models.database import AsyncSessionLocal

    # 1. DB lookup
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User.email).where(User.github_id == github_id)
        )
        email = result.scalar_one_or_none()
        if email:
            return email

    # 2. Authenticated GitHub user emails endpoint (works for org members)
    if auth_token:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/users/{username}",
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Accept": "application/vnd.github+json",
                },
                timeout=10,
            )
            if resp.status_code == 200:
                email = resp.json().get("email")
                if email:
                    return email

    # 3. Public profile fallback
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/users/{username}",
            headers={"Accept": "application/vnd.github+json"},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get("email")

    return None


async def _send_pr_email_with_lookup(
    username: str,
    github_id: str,
    pr_title: str,
    pr_url: str,
    pr_author: str,
    repo_name: str,
    auth_token: str | None = None,
):
    """Resolve a reviewer's email and send the PR review notification."""
    email = await _resolve_email(username, github_id, auth_token)
    if not email:
        logger.warning("Could not resolve email for reviewer @%s — skipping", username)
        return
    result = await send_pr_review_email(
        reviewer_email=email,
        pr_title=pr_title,
        pr_url=pr_url,
        pr_author=pr_author,
        repo_name=repo_name,
    )
    logger.info("PR review email sent to %s (status %s)", email, result.get("status"))


async def _send_issue_email_with_lookup(
    username: str,
    github_id: str,
    issue_title: str,
    issue_url: str,
    issue_author: str,
    repo_name: str,
    auth_token: str | None = None,
):
    """Resolve an assignee's email and send the issue assignment notification."""
    email = await _resolve_email(username, github_id, auth_token)
    if not email:
        logger.warning("Could not resolve email for assignee @%s — skipping", username)
        return
    result = await send_issue_assigned_email(
        assignee_email=email,
        issue_title=issue_title,
        issue_url=issue_url,
        issue_author=issue_author,
        repo_name=repo_name,
    )
    logger.info("Issue assignment email sent to %s (status %s)", email, result.get("status"))
