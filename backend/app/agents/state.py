from typing import TypedDict, Annotated


class TraceEvent(TypedDict):
    agent: str
    step_type: str
    data: dict
    timestamp: str


class AgentState(TypedDict):
    workflow_id: str
    signal_type: str
    signal_payload: dict
    research_queries: list[str]
    action_plan: str
    research_results: list[str]
    research_summary: str
    action_type: str
    action_result: str
    action_confirmed: bool
    trace_events: Annotated[list[TraceEvent], lambda a, b: a + b]
    error: str | None
    user_slack_config: dict
