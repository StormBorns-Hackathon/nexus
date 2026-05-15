from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.database import AsyncSessionLocal
from app.models.workflow_models import Workflow, WorkflowStatus,WorkflowStep
from app.models.slack_models import SlackInstallation, RepoChannelMapping
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

        # Load the user's Slack config
        user_slack_config = {}
        result_inst = await db.execute(
            select(SlackInstallation).where(SlackInstallation.user_id == wf.user_id)
        )
        installation = result_inst.scalar_one_or_none()

        if installation:
            user_slack_config["bot_token"] = installation.bot_token

            # Load repo → channel mappings for this user
            repo_name = (wf.signal_payload or {}).get("repo", "")
            if repo_name:
                result_maps = await db.execute(
                    select(RepoChannelMapping).where(
                        RepoChannelMapping.user_id == wf.user_id,
                        RepoChannelMapping.repo_full_name == repo_name.lower(),
                    )
                )
                mappings = result_maps.scalars().all()
                user_slack_config["channels"] = [
                    {"id": m.channel_id, "name": m.channel_name}
                    for m in mappings
                ]

        try:
            result = await run_pipeline(
                str(workflow_id),
                wf.signal_type,
                wf.signal_payload,
                ws_manager,
                user_slack_config=user_slack_config,
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
