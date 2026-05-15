from uuid import UUID
from datetime import datetime, timezone
import logging

from sqlalchemy import select

logger = logging.getLogger(__name__)

from app.models.database import AsyncSessionLocal
from app.models.workflow_models import Workflow, WorkflowStatus,WorkflowStep
from app.models.slack_models import SlackInstallation, RepoChannelMapping
from app.agents.pipeline import run_pipeline
from app.services.ws_manager import ws_manager
from app.services.omium_tracing import flush_omium_traces

logger = logging.getLogger(__name__)


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

            # Load repo → channel mappings for this repo across ALL users.
            # The webhook creates a single workflow; the pipeline must send
            # to every unique channel that any user mapped for this repo.
            repo_name = (wf.signal_payload or {}).get("repo", "")
            if repo_name:
                result_maps = await db.execute(
                    select(RepoChannelMapping).where(
                        RepoChannelMapping.repo_full_name == repo_name.lower(),
                    )
                )
                mappings = result_maps.scalars().all()

                # Load ALL installations referenced by these mappings
                all_inst_ids = {m.installation_id for m in mappings if m.installation_id}
                installations_map = {inst.id: inst for inst in installations}
                if all_inst_ids - set(installations_map.keys()):
                    extra_result = await db.execute(
                        select(SlackInstallation).where(
                            SlackInstallation.id.in_(all_inst_ids - set(installations_map.keys()))
                        )
                    )
                    for inst in extra_result.scalars().all():
                        installations_map[inst.id] = inst

                # Build channels list with per-channel bot tokens (deduplicate by channel_id)
                channels = []
                seen_channel_ids = set()
                for m in mappings:
                    if m.channel_id in seen_channel_ids:
                        continue
                    seen_channel_ids.add(m.channel_id)

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

        result = {}
        try:
            result = await run_pipeline(
                str(workflow_id),
                wf.signal_type,
                wf.signal_payload,
                ws_manager,
                user_slack_config=user_slack_config,
            )

            # Trace events are already persisted by emit_trace() in real-time,
            # so no need to persist them again here.

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

        # Deliver to custom outgoing webhooks
        try:
            from app.api.custom_webhooks import deliver_to_webhooks

            webhook_payload = {
                "event": "workflow_completed",
                "source": "nexus",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "workflow": {
                    "id": str(workflow_id),
                    "signal_type": wf.signal_type,
                    "signal_payload": wf.signal_payload,
                    "status": wf.status.value,
                    "result_summary": wf.result_summary,
                    "report": result.get("slack_message", "") if wf.status == WorkflowStatus.completed else "",
                },
            }
            logger.info(f"Delivering to custom webhooks for user {wf.user_id}")
            delivery_results = await deliver_to_webhooks(wf.user_id, webhook_payload)
            logger.info(f"Custom webhook delivery results: {delivery_results}")
        except Exception as e:
            logger.error(f"Custom webhook delivery error: {e}", exc_info=True)
        
        # Ensure the workflow span is flushed to Omium dashboard
        try:
            from omium.integrations.tracer import get_current_tracer
            tracer = get_current_tracer()
            if tracer:
                tracer.flush()
        except Exception as e:
            pass

    # ── Flush Omium traces to the backend ──
    # The SDK's auto-instrumented ainvoke() creates spans but its internal
    # aflush() fires too early (before spans exit the context manager).
    # This explicit flush sends the accumulated spans immediately after
    # the entire workflow completes, so they appear on the Omium dashboard.
    flush_omium_traces()
    logger.debug("Omium traces flushed for workflow %s", workflow_id)
