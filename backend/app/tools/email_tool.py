import httpx
from dotenv import load_dotenv
import os

load_dotenv()

SENDGRID_API_KEY=os.getenv("SENDGRID_API_KEY")


async def send_email(to: str, subject: str, body: str) -> dict:
    # SendGrid v3 API
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {SENDGRID_API_KEY}"},
            json={
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": "agarwalmehul423@gmail.com"},
                "subject": subject,
                "content": [{"type": "text/plain", "value": body}],
            },
        )
        return {"status": resp.status_code}
