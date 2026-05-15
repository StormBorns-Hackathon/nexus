from datetime import datetime, timezone
from uuid import UUID


async def emit_trace(ws_manager, workflow_id: str, agent: str,
                     step_type: str, data: dict) -> dict:
    """Emit a trace event to WebSocket and return event dict for state."""
    event = {
        "agent": agent,
        "step_type": step_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    # Broadcast to connected dashboard clients
    if ws_manager:
        await ws_manager.broadcast(workflow_id, {
            "event": f"step_{step_type}",
            **event,
        })
    try:
        from app.models.database import AsyncSessionLocal
        from app.models.workflow_models import WorkflowStep

        async with AsyncSessionLocal() as db:
            step = WorkflowStep(
                workflow_id=UUID(str(workflow_id)),
                agent_name=agent,
                step_type=step_type,
                output_data=data,
                tool_name=data.get("tool") if step_type == "tool_call" else None,
            )
            db.add(step)
            await db.commit()
    except Exception:
        # Trace persistence should never break the agent pipeline.
        pass

    return event
