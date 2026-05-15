from openai import AsyncOpenAI
from app.services.trace import emit_trace
import json
from dotenv import load_dotenv
import os
from ..services.llm import client

load_dotenv()

OPENROUTER_API_KEY=os.getenv("OPENROUTER_API_KEY")
MODEL_NAME="openai/gpt-oss-120b:free"


PLANNER_SYSTEM_PROMPT = """You are a planning agent in an autonomous pipeline.
Given a webhook signal, decompose it into:
1. research_queries: list of 2-4 specific search queries to investigate
2. action_plan: a one-paragraph plan describing what action to take after research

Respond in JSON: {"research_queries": [...], "action_plan": "..."}"""

async def planner_node(state: dict, ws_manager=None) -> dict:
    workflow_id = state["workflow_id"]
    traces = []

    traces.append(await emit_trace(
        ws_manager, workflow_id, "planner", "thinking",
        {"message": "Analyzing signal and decomposing into tasks..."}
    ))

    try:
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps({
                    "source": state["signal_type"],
                    "payload": state["signal_payload"],
                })},
            ],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        return {"error": str(e), "trace_events": traces}
    
    content = response.choices[0].message.content
    if content is None:
        raise ValueError("LLM returned empty response for researcher synthesis")
    result = json.loads(content)

    traces.append(await emit_trace(
        ws_manager, workflow_id, "planner", "result",
        {"research_queries": result["research_queries"],
         "action_plan": result["action_plan"]}
    ))

    return {
        "research_queries": result["research_queries"],
        "action_plan": result["action_plan"],
        "trace_events": traces,
    }
