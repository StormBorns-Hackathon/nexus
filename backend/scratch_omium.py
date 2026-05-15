"""
Quick smoke-test for the Omium integration.

Run with:
    cd backend && source .venv/bin/activate && python scratch_omium.py

What it does:
  1. Calls omium.init() the same way the FastAPI lifespan does.
  2. Builds a tiny LangGraph graph (2 nodes) and invokes it.
  3. The auto-instrumented ainvoke() should send a trace to Omium.
  4. Prints whether spans were successfully sent (look for "Sent N spans").
"""

import asyncio
import logging
import os

# Show Omium & httpx logs so we can confirm the POST succeeds
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logging.getLogger("omium").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.INFO)


async def main():
    # ── 1. Initialise Omium (mirrors app/services/omium_tracing.py) ──
    # Load .env first
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    import omium

    api_key = os.getenv("OMIUM_API_KEY")
    api_url = os.getenv("OMIUM_API_URL")

    if not api_key:
        print("ERROR: OMIUM_API_KEY not set in environment.")
        print("  export OMIUM_API_KEY=omium_xxxx   OR   add it to .env and use dotenv")
        return

    config = omium.init(
        api_key=api_key,
        api_base_url=api_url or "https://api.omium.ai",
        project="nexus",
        auto_trace=True,
        auto_checkpoint=True,
    )

    print(f"\n✅ Omium initialised")
    print(f"   project       = {config.project}")
    print(f"   api_base_url  = {config.api_base_url}")
    print(f"   auto_trace    = {config.auto_trace}")
    print(f"   frameworks    = {config.detected_frameworks}")

    # ── 2. Build a minimal LangGraph and run it ──
    from langgraph.graph import StateGraph, START, END
    from typing import TypedDict

    class TestState(TypedDict):
        message: str

    async def step_a(state: TestState) -> TestState:
        return {"message": state["message"] + " → step_a"}

    async def step_b(state: TestState) -> TestState:
        return {"message": state["message"] + " → step_b"}

    graph = StateGraph(TestState)
    graph.add_node("step_a", step_a)
    graph.add_node("step_b", step_b)
    graph.add_edge(START, "step_a")
    graph.add_edge("step_a", "step_b")
    graph.add_edge("step_b", END)
    compiled = graph.compile()

    print("\n🚀 Invoking LangGraph pipeline …")
    result = await compiled.ainvoke({"message": "test"})
    print(f"   result = {result}")

    # ── 3. Wait for async flush ──
    print("\n⏳ Waiting 5 s for background flush …")
    await asyncio.sleep(5)

    print("\n✅ Done — check the log lines above for:")
    print('   "Sent N spans to Omium"  → spans reached the API')
    print('   "HTTP Request: POST …/traces/ingest … 200 OK"  → API accepted them')
    print("   Then check https://app.omium.ai for your 'nexus' project traces.\n")


if __name__ == "__main__":
    asyncio.run(main())
