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


def _signal_summary(signal: dict) -> str:
    parts = [
        f"Title: {signal.get('title', 'Unknown')}",
        f"Repository: {signal.get('repo', 'N/A')}",
        f"Author: {signal.get('author', 'unknown')}",
        f"State: {signal.get('state', 'unknown')}",
    ]
    if signal.get("changed_files") is not None:
        parts.append(
            "Change size: "
            f"{signal.get('changed_files', 0)} files, "
            f"+{signal.get('additions', 0)} / -{signal.get('deletions', 0)}"
        )
    body = (signal.get("body") or "").strip()
    if body:
        parts.extend(["Description:", body[:1200]])
    else:
        parts.append("Description: No PR or issue body was provided.")
    return "\n".join(parts)


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
                {"role": "user", "content": json.dumps({
                    "signal": state.get("signal_payload", {}),
                    "search_results": all_results,
                })},
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if content is None:
            return {"error": "LLM returned empty response in researcher", "trace_events": traces}
        result = json.loads(content)
    except Exception:
        result = {
            "research_summary": _signal_summary(state.get("signal_payload", {})),
            "key_findings": ["Research synthesis failed; used GitHub signal payload instead."],
        }

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
