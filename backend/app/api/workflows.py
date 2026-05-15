from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.models.database import get_db
from app.models.workflow_models import Workflow, WorkflowStep, WorkflowStatus
from app.models import schemas
from app.api.webhooks import run_workflow_background

router = APIRouter()


@router.get("", response_model=schemas.WorkflowListResponse)
async def list_workflows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).order_by(Workflow.created_at.desc()))
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
    workflow_id: UUID, db: AsyncSession = Depends(get_db)
):
    wf_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = wf_result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")

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


@router.post("/trigger", status_code=201)
async def trigger_workflow(
    body: schemas.ManualTriggerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # for now, we hardcode one scenario
    if body.scenario != "github_issue":
        raise HTTPException(status_code=400, detail="Unknown scenario")

    payload = body.custom_payload or {
        "title": "API error when saving user profile",
        "url": "https://github.com/org/repo/issues/123",
        "body": "Steps to reproduce...",
    }

    workflow = Workflow(
        signal_type="github",
        signal_payload=payload,
        status=WorkflowStatus.pending,
    )

    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    background_tasks.add_task(run_workflow_background, workflow.id)

    return {"workflow_id": workflow.id, "status": workflow.status}
