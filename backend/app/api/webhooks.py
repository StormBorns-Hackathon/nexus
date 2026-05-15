from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.workflow_models import Workflow, WorkflowStatus
from app.models.user_models import User
from app.models import schemas
from app.utils.auth_utils import get_current_user

router = APIRouter()


async def run_workflow_background(workflow_id):
    from app.graphs.pipeline import run_workflow
    await run_workflow(workflow_id)


@router.post("/ingest", response_model=schemas.WorkflowCreateResponse, status_code=201)
async def ingest_webhook(
    request: schemas.WebhookIngestRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = Workflow(
        user_id=user.id,
        signal_type=request.source,
        signal_payload=request.payload,
        status=WorkflowStatus.pending,
    )

    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)

    background_tasks.add_task(run_workflow_background, workflow.id)

    return schemas.WorkflowCreateResponse(
        workflow_id=workflow.id,
        status=workflow.status,
        trace_url=f"/workflows/{workflow.id}",
    )
