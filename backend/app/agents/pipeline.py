from langgraph.graph import StateGraph, START, END
from app.agents.state import AgentState
from app.agents.planner import planner_node
from app.agents.researcher import researcher_node
from app.agents.action import action_node

# ── NOTE ──
# Omium init + LangGraph instrumentation is handled centrally by
# ``app.services.omium_tracing.init_omium()`` which runs during
# FastAPI lifespan startup (see app/main.py).  Do NOT call
# ``omium.init()`` or ``omium.instrument_langgraph()`` here —
# doing so would create a duplicate project on the Omium dashboard.


def build_pipeline(ws_manager=None):
    """Build and compile the Nexus agent pipeline."""

    async def planner(state):
        return await planner_node(state, ws_manager)

    async def researcher(state):
        return await researcher_node(state, ws_manager)

    async def action(state):
        return await action_node(state, ws_manager)

    graph = StateGraph(AgentState)

    graph.add_node("planner", planner)
    graph.add_node("researcher", researcher)
    graph.add_node("action", action)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "researcher")
    graph.add_edge("researcher", "action")
    graph.add_edge("action", END)

    return graph.compile()


async def run_pipeline(
    workflow_id: str,
    signal_type: str,
    signal_payload: dict,
    ws_manager=None,
    user_slack_config: dict | None = None,
) -> dict:
    """Execute the full pipeline and return final state."""
    pipeline = build_pipeline(ws_manager)

    initial_state: AgentState = {
        "workflow_id": workflow_id,
        "signal_type": signal_type,
        "signal_payload": signal_payload,
        "research_queries": [],
        "action_plan": "",
        "research_results": [],
        "research_summary": "",
        "action_type": "",
        "action_result": "",
        "action_confirmed": False,
        "trace_events": [],
        "error": None,
        "user_slack_config": user_slack_config or {},
        "slack_message": "",
    }

    result = await pipeline.ainvoke(initial_state)
    return result
