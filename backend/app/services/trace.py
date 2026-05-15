from datetime import datetime, timezone

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
    return event
