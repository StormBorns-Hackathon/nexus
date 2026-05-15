import httpx
from dotenv import load_dotenv
import os

load_dotenv()

SLACK_BOT_TOKEN=os.getenv("SLACK_BOT_TOKEN")
SLACK_CHANNEL_ID=os.getenv("SLACK_CHANNEL_ID")


async def send_slack_message(channel: str, text: str) -> dict:
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
