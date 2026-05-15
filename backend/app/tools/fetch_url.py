import httpx

async def fetch_url(url: str) -> str:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        # TODO(@akshat-code-21): check for truncation of content
        return resp.text[:5000]
