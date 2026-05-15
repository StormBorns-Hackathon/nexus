from langchain_tavily import TavilySearch

def get_search_tool():
    return TavilySearch(max_results=5)

async def search_web(query: str) -> list[dict]:
    tool = get_search_tool()
    results = await tool.ainvoke({"query": query})
    return [{"url": r["url"], "content": r["content"]} for r in results]
