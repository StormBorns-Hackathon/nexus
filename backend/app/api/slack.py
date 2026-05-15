from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from uuid import UUID
import httpx
import os

from app.models.database import get_db
from app.models.user_models import User
from app.models.slack_models import SlackInstallation, RepoChannelMapping
from app.utils.auth_utils import get_current_user

router = APIRouter()

SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID", "")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET", "")


# ── Schemas ──

class SlackCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


class AddMappingRequest(BaseModel):
    repo_full_name: str
    channel_id: str
    channel_name: str


# ── OAuth endpoints ──

@router.get("/auth-url")
async def get_auth_url():
    if not SLACK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="SLACK_CLIENT_ID not configured")
    scopes = "chat:write,channels:read,groups:read"
    url = (
        f"https://slack.com/oauth/v2/authorize"
        f"?client_id={SLACK_CLIENT_ID}"
        f"&scope={scopes}"
    )
    return {"url": url}


@router.post("/callback")
async def slack_callback(
    body: SlackCallbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Exchange code for token
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": SLACK_CLIENT_ID,
                "client_secret": SLACK_CLIENT_SECRET,
                "code": body.code,
                "redirect_uri": body.redirect_uri,
            },
        )

    data = resp.json()
    if not data.get("ok"):
        raise HTTPException(
            status_code=400,
            detail=f"Slack OAuth failed: {data.get('error', 'unknown')}",
        )

    bot_token = data.get("access_token", "")
    team_id = data.get("team", {}).get("id", "")
    team_name = data.get("team", {}).get("name", "")
    bot_user_id = data.get("bot_user_id", "")

    # Upsert installation
    result = await db.execute(
        select(SlackInstallation).where(SlackInstallation.user_id == user.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.team_id = team_id
        existing.team_name = team_name
        existing.bot_token = bot_token
        existing.bot_user_id = bot_user_id
    else:
        installation = SlackInstallation(
            user_id=user.id,
            team_id=team_id,
            team_name=team_name,
            bot_token=bot_token,
            bot_user_id=bot_user_id,
        )
        db.add(installation)

    await db.commit()
    return {"ok": True, "team_name": team_name}


@router.get("/status")
async def get_slack_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SlackInstallation).where(SlackInstallation.user_id == user.id)
    )
    installation = result.scalar_one_or_none()

    if not installation:
        return {"connected": False}

    return {
        "connected": True,
        "team_name": installation.team_name,
        "team_id": installation.team_id,
        "installed_at": installation.installed_at,
    }


@router.delete("/disconnect")
async def disconnect_slack(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(SlackInstallation).where(SlackInstallation.user_id == user.id)
    )
    # Also remove all mappings
    await db.execute(
        delete(RepoChannelMapping).where(RepoChannelMapping.user_id == user.id)
    )
    await db.commit()
    return {"ok": True}


# ── Channel listing ──

@router.get("/channels")
async def list_slack_channels(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SlackInstallation).where(SlackInstallation.user_id == user.id)
    )
    installation = result.scalar_one_or_none()
    if not installation:
        raise HTTPException(status_code=400, detail="Slack not connected")

    # Fetch channels from Slack API
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://slack.com/api/conversations.list",
            headers={"Authorization": f"Bearer {installation.bot_token}"},
            params={"types": "public_channel,private_channel", "limit": "200"},
        )

    data = resp.json()
    if not data.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=f"Slack API error: {data.get('error', 'unknown')}",
        )

    channels = [
        {"id": ch["id"], "name": ch["name"], "is_private": ch.get("is_private", False)}
        for ch in data.get("channels", [])
    ]

    return {"channels": channels}


# ── Repo ↔ Channel Mappings ──

@router.get("/mappings")
async def list_mappings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RepoChannelMapping)
        .where(RepoChannelMapping.user_id == user.id)
        .order_by(RepoChannelMapping.created_at.desc())
    )
    mappings = result.scalars().all()

    return {
        "mappings": [
            {
                "id": m.id,
                "repo_full_name": m.repo_full_name,
                "channel_id": m.channel_id,
                "channel_name": m.channel_name,
                "created_at": m.created_at,
            }
            for m in mappings
        ]
    }


@router.post("/mappings", status_code=201)
async def add_mapping(
    body: AddMappingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mapping = RepoChannelMapping(
        user_id=user.id,
        repo_full_name=body.repo_full_name.strip().lower(),
        channel_id=body.channel_id,
        channel_name=body.channel_name,
    )
    db.add(mapping)
    try:
        await db.commit()
        await db.refresh(mapping)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="This mapping already exists")

    return {
        "id": mapping.id,
        "repo_full_name": mapping.repo_full_name,
        "channel_id": mapping.channel_id,
        "channel_name": mapping.channel_name,
    }


@router.delete("/mappings/{mapping_id}")
async def delete_mapping(
    mapping_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RepoChannelMapping).where(
            RepoChannelMapping.id == mapping_id,
            RepoChannelMapping.user_id == user.id,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")

    await db.delete(mapping)
    await db.commit()
    return {"ok": True}
