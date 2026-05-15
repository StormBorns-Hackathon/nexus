import json
from langchain_tavily import TavilySearch


def get_search_tool():
    return TavilySearch(max_results=5)


async def search_web(query: str) -> list[dict]:
    tool = get_search_tool()
    raw = await tool.ainvoke({"query": query})
    
    if isinstance(raw, str):
        parsed = json.loads(raw)
        results = parsed.get("results", [])
    else:
        results = raw.get("results", []) if isinstance(raw, dict) else raw

    return [{"url": r["url"], "content": r["content"]} for r in results]
