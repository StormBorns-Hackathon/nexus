"""Custom outgoing webhooks — CRUD + delivery helper."""

import hashlib
import hmac
import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.webhook_models import CustomWebhook
from app.utils.auth_utils import get_current_user
from app.models.user_models import User

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ──────────────────────────────────────────────────

class WebhookCreate(BaseModel):
    name: str
    url: HttpUrl
    secret: str | None = None


class WebhookUpdate(BaseModel):
    name: str | None = None
    url: HttpUrl | None = None
    secret: str | None = None
    is_active: bool | None = None


class WebhookOut(BaseModel):
    id: str
    name: str
    url: str
    has_secret: bool
    is_active: bool
    created_at: str | None

    class Config:
        from_attributes = True


# ── CRUD endpoints ───────────────────────────────────────────

@router.get("", response_model=list[WebhookOut])
async def list_webhooks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomWebhook)
        .where(CustomWebhook.user_id == user.id)
        .order_by(CustomWebhook.created_at.desc())
    )
    webhooks = result.scalars().all()
    return [
        WebhookOut(
            id=str(w.id),
            name=w.name,
            url=w.url,
            has_secret=bool(w.secret),
            is_active=w.is_active,
            created_at=w.created_at.isoformat() if w.created_at else None,
        )
        for w in webhooks
    ]


@router.post("", response_model=WebhookOut, status_code=201)
async def create_webhook(
    body: WebhookCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    webhook = CustomWebhook(
        user_id=user.id,
        name=body.name,
        url=str(body.url),
        secret=body.secret or None,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return WebhookOut(
        id=str(webhook.id),
        name=webhook.name,
        url=webhook.url,
        has_secret=bool(webhook.secret),
        is_active=webhook.is_active,
        created_at=webhook.created_at.isoformat() if webhook.created_at else None,
    )


@router.patch("/{webhook_id}", response_model=WebhookOut)
async def update_webhook(
    webhook_id: str,
    body: WebhookUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomWebhook).where(
            CustomWebhook.id == UUID(webhook_id),
            CustomWebhook.user_id == user.id,
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if body.name is not None:
        webhook.name = body.name
    if body.url is not None:
        webhook.url = str(body.url)
    if body.secret is not None:
        webhook.secret = body.secret or None
    if body.is_active is not None:
        webhook.is_active = body.is_active

    await db.commit()
    await db.refresh(webhook)
    return WebhookOut(
        id=str(webhook.id),
        name=webhook.name,
        url=webhook.url,
        has_secret=bool(webhook.secret),
        is_active=webhook.is_active,
        created_at=webhook.created_at.isoformat() if webhook.created_at else None,
    )


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CustomWebhook).where(
            CustomWebhook.id == UUID(webhook_id),
            CustomWebhook.user_id == user.id,
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    await db.delete(webhook)
    await db.commit()
    return {"ok": True}


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test payload to verify the webhook URL works."""
    result = await db.execute(
        select(CustomWebhook).where(
            CustomWebhook.id == UUID(webhook_id),
            CustomWebhook.user_id == user.id,
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    test_payload = {
        "event": "test",
        "source": "nexus",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "message": "This is a test event from Nexus. Your webhook is working!",
            "webhook_name": webhook.name,
        },
    }

    try:
        status, response_text = await _deliver(webhook.url, test_payload, webhook.secret)
        return {"ok": status < 400, "status_code": status, "response": response_text[:500]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Delivery helper (used by the pipeline) ───────────────────

async def deliver_to_webhooks(user_id: UUID, payload: dict) -> list[dict]:
    """POST payload to all active webhooks for a given user.

    Called after the pipeline completes to fan out results.
    Returns a list of delivery results for logging.
    """
    from app.models.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CustomWebhook).where(
                CustomWebhook.user_id == user_id,
                CustomWebhook.is_active == True,  # noqa: E712
            )
        )
        webhooks = result.scalars().all()

    results = []
    for wh in webhooks:
        try:
            status, _ = await _deliver(wh.url, payload, wh.secret)
            results.append({"webhook": wh.name, "status": status, "ok": status < 400})
        except Exception as e:
            results.append({"webhook": wh.name, "error": str(e), "ok": False})
            logger.error(f"Webhook delivery to {wh.name} failed: {e}")

    return results


async def _deliver(url: str, payload: dict, secret: str | None) -> tuple[int, str]:
    """POST JSON to a URL. Auto-detects Discord/Slack webhook URLs and
    reformats the payload so messages appear natively in those platforms."""
    import json

    # Detect platform from URL and transform payload
    body_dict = _transform_payload(url, payload)
    body = json.dumps(body_dict, default=str)

    headers = {"Content-Type": "application/json"}

    if secret:
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-Nexus-Signature"] = f"sha256={sig}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, content=body, headers=headers)

    return resp.status_code, resp.text


def _transform_payload(url: str, payload: dict) -> dict:
    """Auto-detect the target platform from the URL and return a
    platform-native payload. Falls back to raw JSON for unknown URLs."""

    event = payload.get("event", "unknown")

    # ── Test events — handle first, before platform detection ──
    if event == "test":
        test_msg = payload.get("data", {}).get("message", "Test from Nexus")
        webhook_name = payload.get("data", {}).get("webhook_name", "")
        label = f"✅ {test_msg}"
        if webhook_name:
            label += f"\n_Webhook: {webhook_name}_"

        if "discord.com/api/webhooks" in url or "discordapp.com/api/webhooks" in url:
            return {"embeds": [{"title": "Nexus Test", "description": label, "color": 0x22C55E}]}

        if "hooks.slack.com/services" in url:
            return {"text": label}

        return payload

    workflow = payload.get("workflow", {})
    summary = workflow.get("result_summary", "")
    report = workflow.get("report", "")
    signal = workflow.get("signal_payload", {})
    signal_type = workflow.get("signal_type", "")
    status = workflow.get("status", "")
    title = signal.get("title", "Nexus Pipeline Report")
    repo = signal.get("repo", "")
    pr_url = signal.get("url", "")
    timestamp = payload.get("timestamp", "")

    # ── Discord ──────────────────────────────────────────────
    if "discord.com/api/webhooks" in url or "discordapp.com/api/webhooks" in url:
        color = 0x22C55E if status == "completed" else 0xEF4444  # green / red

        fields = []
        if repo:
            fields.append({"name": "Repository", "value": repo, "inline": True})
        if signal_type:
            fields.append({"name": "Signal", "value": signal_type, "inline": True})
        if status:
            fields.append({"name": "Status", "value": status.upper(), "inline": True})
        if summary and summary != report:
            fields.append({"name": "Summary", "value": summary[:1024], "inline": False})

        description = report[:4000] if report else summary[:4000] or "No report generated."

        embed = {
            "title": f"🔗 {title}",
            "description": description,
            "color": color,
            "fields": fields,
            "footer": {"text": "Nexus Pipeline"},
            "timestamp": timestamp,
        }
        if pr_url:
            embed["url"] = pr_url

        return {"embeds": [embed]}

    # ── Slack Incoming Webhook ───────────────────────────────
    if "hooks.slack.com/services" in url:
        text = report or summary or "No report generated."
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"🔗 {title}"[:150], "emoji": True},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": text[:3000]},
            },
        ]
        context_parts = []
        if repo:
            context_parts.append(f"*Repo:* {repo}")
        if status:
            context_parts.append(f"*Status:* {status}")
        if context_parts:
            blocks.append({
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": " | ".join(context_parts)}],
            })
        return {"blocks": blocks, "text": f"Nexus: {title}"}

    # ── Generic / webhook.site / custom API ──────────────────
    return payload
