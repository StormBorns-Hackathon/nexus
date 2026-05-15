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
    """POST JSON to a URL. If a secret is set, include HMAC signature header."""
    import json

    body = json.dumps(payload, default=str)
    headers = {"Content-Type": "application/json"}

    if secret:
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-Nexus-Signature"] = f"sha256={sig}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, content=body, headers=headers)

    return resp.status_code, resp.text
