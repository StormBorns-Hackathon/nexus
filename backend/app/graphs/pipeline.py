from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.database import AsyncSessionLocal
from app.models.workflow_models import Workflow, WorkflowStatus,WorkflowStep
from app.models.slack_models import SlackInstallation, RepoChannelMapping
from app.agents.pipeline import run_pipeline
from app.services.ws_manager import ws_manager

# ── Omium tracing (graceful no-op when SDK is not installed) ──
try:
    import omium
    _omium_trace = omium.trace
except ImportError:
    def _omium_trace(name: str):
        return lambda fn: fn


@_omium_trace("run_workflow")
async def run_workflow(workflow_id: UUID) -> None:
    """Load workflow from DB, run the agent pipeline, persist results."""
    async with AsyncSessionLocal() as db:
        wf = await db.get(Workflow, workflow_id)
        if not wf:
            return

        # Mark running
        wf.status = WorkflowStatus.running
        await db.commit()

        # Load the user's Slack config — now supports multiple installations
        user_slack_config = {}

        # Get all installations for this user
        result_inst = await db.execute(
            select(SlackInstallation)
            .where(SlackInstallation.user_id == wf.user_id)
            .order_by(SlackInstallation.installed_at.desc())
        )
        installations = result_inst.scalars().all()

        if installations:
            # Use the first (most recent) installation's bot_token as default
            user_slack_config["bot_token"] = installations[0].bot_token

            # Set default channel as fallback (from first installation)
            for inst in installations:
                if inst.default_channel_id:
                    user_slack_config["default_channel"] = {
                        "id": inst.default_channel_id,
                        "name": inst.default_channel_name or "default",
                    }
                    # Use this installation's token for the default channel
                    user_slack_config["bot_token"] = inst.bot_token
                    break

            # Load repo → channel mappings for this user, including installation info
            repo_name = (wf.signal_payload or {}).get("repo", "")
            if repo_name:
                result_maps = await db.execute(
                    select(RepoChannelMapping).where(
                        RepoChannelMapping.user_id == wf.user_id,
                        RepoChannelMapping.repo_full_name == repo_name.lower(),
                    )
                )
                mappings = result_maps.scalars().all()

                # Build channels list with per-channel bot tokens
                installations_map = {inst.id: inst for inst in installations}
                channels = []
                for m in mappings:
                    inst = installations_map.get(m.installation_id)
                    if inst:
                        channels.append({
                            "id": m.channel_id,
                            "name": m.channel_name,
                            "bot_token": inst.bot_token,
                        })
                    else:
                        channels.append({
                            "id": m.channel_id,
                            "name": m.channel_name,
                        })

                user_slack_config["channels"] = channels

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
