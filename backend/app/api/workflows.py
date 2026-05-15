import re

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


COMMIT_URL_PATTERN = re.compile(
    r"https?://github\.com/([^/]+)/([^/]+)/commit/([a-f0-9]+)",
    re.IGNORECASE,
)


@router.post("/trigger", status_code=201)
async def trigger_workflow(
    body: schemas.CommitTriggerRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Parse the commit URL
    match = COMMIT_URL_PATTERN.match(body.commit_url.strip())
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub commit URL. Expected format: https://github.com/owner/repo/commit/sha",
        )

    owner, repo, sha = match.groups()

    # Fetch commit details from GitHub API
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Could not fetch commit from GitHub (HTTP {resp.status_code}). Make sure the repo is public and the URL is correct.",
        )

    commit_data = resp.json()

    payload = {
        "title": commit_data["commit"]["message"].split("\n")[0],
        "url": body.commit_url.strip(),
        "body": commit_data["commit"]["message"],
        "author": commit_data["commit"]["author"]["name"],
        "repo": f"{owner}/{repo}",
        "sha": sha,
        "files_changed": len(commit_data.get("files", [])),
        "stats": commit_data.get("stats", {}),
    }

    workflow = Workflow(
        user_id=user.id,
        signal_type="github_commit",
        signal_payload=payload,
        status=WorkflowStatus.pending,
    )

    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    background_tasks.add_task(run_workflow_background, workflow.id)

    return {"workflow_id": workflow.id, "status": workflow.status}
