from uuid import UUID
from datetime import datetime, timezone

from app.models.database import AsyncSessionLocal
from app.models.workflow_models import Workflow, WorkflowStep, WorkflowStatus
from app.agents.pipeline import run_pipeline
from app.services.ws_manager import ws_manager


async def run_workflow(workflow_id: UUID) -> None:
    """Load workflow from DB, run the agent pipeline, persist results."""
    async with AsyncSessionLocal() as db:
        wf = await db.get(Workflow, workflow_id)
        if not wf:
            return

        # Mark running
        wf.status = WorkflowStatus.running
        await db.commit()

        try:
            result = await run_pipeline(
                str(workflow_id),
                wf.signal_type,
                wf.signal_payload,
                ws_manager,
            )

            # Persist trace events as WorkflowStep rows
            for event in result.get("trace_events", []):
                step = WorkflowStep(
                    workflow_id=workflow_id,
                    agent_name=event["agent"],
                    step_type=event["step_type"],
                    output_data=event["data"],
                )
                db.add(step)

            # Mark completed
            wf.status = WorkflowStatus.completed
            wf.result_summary = result.get("action_result", "")
            wf.completed_at = datetime.now(timezone.utc)

        except Exception as e:
            wf.status = WorkflowStatus.failed
            wf.result_summary = str(e)

        await db.commit()

        # Notify WebSocket clients that the workflow finished
        await ws_manager.broadcast(str(workflow_id), {
            "event": "workflow_completed",
            "workflow_id": str(workflow_id),
            "status": wf.status.value,
            "result_summary": wf.result_summary,
        })
