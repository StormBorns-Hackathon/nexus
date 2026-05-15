import httpx
from dotenv import load_dotenv
import os

load_dotenv()

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_CHANNEL_ID = os.getenv("SLACK_CHANNEL_ID")


async def send_slack_message(channel: str, text: str, bot_token: str | None = None) -> dict:
    """Send a message to a Slack channel. Uses provided bot_token or falls back to .env."""
    token = bot_token or SLACK_BOT_TOKEN
    if not token:
        return {"ok": False, "error": "no_token"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://slack.com/api/chat.postMessage",
            headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
            json={
                "channel": channel or SLACK_CHANNEL_ID,
                "text": text,
                "mrkdwn": True,
                "unfurl_links": False,
                "unfurl_media": False,
            },
        )
        return resp.json()
