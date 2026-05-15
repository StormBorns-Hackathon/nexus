from openai import AsyncOpenAI
from ..tools.tavily import search_web
from app.services.trace import emit_trace
import json, asyncio
from dotenv import load_dotenv
import os
from ..services.llm import client

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL_NAME = "openai/gpt-oss-120b:free"

RESEARCHER_SYSTEM_PROMPT = """You are a research agent. Given search results for
multiple queries, synthesize a clear, factual summary. Include key findings
and cite sources. Respond in JSON:
{"research_summary": "...", "key_findings": ["...", "..."]}"""


async def researcher_node(state: dict, ws_manager=None) -> dict:
    workflow_id = state["workflow_id"]
    traces = []

    traces.append(
        await emit_trace(
            ws_manager,
            workflow_id,
            "researcher",
            "thinking",
            {"message": f"Researching {len(state['research_queries'])} queries..."},
        )
    )

    search_tasks = [search_web(q) for q in state["research_queries"]]
    results_list = await asyncio.gather(*search_tasks)
    all_results = [
        {"query": q, "results": r}
        for q, r in zip(state["research_queries"], results_list)
    ]

    traces.append(
        await emit_trace(
            ws_manager,
            workflow_id,
            "researcher",
            "thinking",
            {"message": "Synthesizing research findings..."},
        )
    )

    try:
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": RESEARCHER_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(all_results)},
            ],
            response_format={"type": "json_object"},
        )
    except Exception as e:
        return {"error": str(e), "trace_events": traces}

    content = response.choices[0].message.content
    if content is None:
        raise ValueError("LLM returned empty response for researcher synthesis")
    result = json.loads(content)

    traces.append(
        await emit_trace(
            ws_manager,
            workflow_id,
            "researcher",
            "result",
            {
                "summary_length": len(result["research_summary"]),
                "findings_count": len(result.get("key_findings", [])),
            },
        )
    )

    return {
        "research_results": all_results,
        "research_summary": result["research_summary"],
        "trace_events": traces,
    }
