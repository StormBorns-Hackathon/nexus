"""
Verify that Omium tracing works end-to-end.

Run: cd backend && source .venv/bin/activate && python scratch_omium.py

Expected output:
  1. "Omium tracing initialised" log
  2. "Starting async LangGraph execution" log when graph runs
  3. "Sent N spans to Omium" log AFTER flush_omium_traces() is called
  4. "HTTP Request: POST .../traces/ingest ... 200 OK" confirming API accepted it

If you see all 4, Omium is working and traces will appear on the dashboard.
"""

import asyncio
import logging
import os

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logging.getLogger("omium").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.INFO)


async def main():
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

    # ── Step 1: Init (same as FastAPI lifespan) ──
    from app.services.omium_tracing import init_omium, flush_omium_traces

    ok = init_omium()
    if not ok:
        print("❌ Omium init failed — check OMIUM_API_KEY in .env")
        return

    print("\n✅ Step 1: Omium initialised")

    # ── Step 2: Run a LangGraph pipeline (same as run_pipeline) ──
    from langgraph.graph import StateGraph, START, END
    from typing import TypedDict

    class TestState(TypedDict):
        msg: str

    async def step_a(state):
        return {"msg": state["msg"] + " → step_a"}

    async def step_b(state):
        return {"msg": state["msg"] + " → step_b"}

    graph = StateGraph(TestState)
    graph.add_node("step_a", step_a)
    graph.add_node("step_b", step_b)
    graph.add_edge(START, "step_a")
    graph.add_edge("step_a", "step_b")
    graph.add_edge("step_b", END)

    print("🚀 Step 2: Invoking LangGraph pipeline …")
    result = await graph.compile().ainvoke({"msg": "test"})
    print(f"   result = {result}")

    # ── Step 3: Flush (same as graphs/pipeline.py does after run) ──
    print("📤 Step 3: Flushing traces …")
    flush_omium_traces()

    print("\n✅ Done! Check the log output above for:")
    print('   • "Sent N spans to Omium" — confirms spans were transmitted')
    print('   • "HTTP … 200 OK" — confirms API accepted them')
    print("   • Then check https://app.omium.ai → nexus project → Traces tab\n")


if __name__ == "__main__":
    asyncio.run(main())
