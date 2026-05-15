from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from uuid import UUID
import httpx
import os
import secrets
import logging

from app.models.database import get_db
from app.models.user_models import User
from app.models.slack_models import SlackInstallation, RepoChannelMapping, MonitoredRepo
from app.utils.auth_utils import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID", "")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET", "")


# ── Schemas ──

class SlackCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


class AddMappingRequest(BaseModel):
    installation_id: str
    repo_full_name: str
    channel_id: str
    channel_name: str


class SetDefaultChannelRequest(BaseModel):
    installation_id: str
    channel_id: str
    channel_name: str


# ── OAuth endpoints ──

@router.get("/auth-url")
async def get_auth_url():
    if not SLACK_CLIENT_ID:
        raise HTTPException(status_code=500, detail="SLACK_CLIENT_ID not configured")
    scopes = "chat:write,channels:read,groups:read,channels:join"
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

    # Upsert by (user_id, team_id) — allows multiple workspaces, but not duplicates
    result = await db.execute(
        select(SlackInstallation).where(
            SlackInstallation.user_id == user.id,
            SlackInstallation.team_id == team_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
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


# ── Status ──

@router.get("/status")
async def get_slack_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all connected Slack workspaces for the current user."""
    result = await db.execute(
        select(SlackInstallation)
        .where(SlackInstallation.user_id == user.id)
        .order_by(SlackInstallation.installed_at.desc())
    )
    installations = result.scalars().all()

    if not installations:
        return {"connected": False, "installations": []}

    return {
        "connected": True,
        # Legacy single-workspace fields for backward compatibility
        "team_name": installations[0].team_name,
        "team_id": installations[0].team_id,
        "default_channel_id": installations[0].default_channel_id,
        "default_channel_name": installations[0].default_channel_name,
        "installed_at": installations[0].installed_at,
        # Multi-workspace
        "installations": [
            {
                "id": str(inst.id),
                "team_id": inst.team_id,
                "team_name": inst.team_name,
                "default_channel_id": inst.default_channel_id,
                "default_channel_name": inst.default_channel_name,
                "installed_at": inst.installed_at,
            }
            for inst in installations
        ],
    }


@router.delete("/disconnect/{installation_id}")
async def disconnect_slack(
    installation_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SlackInstallation).where(
            SlackInstallation.id == installation_id,
            SlackInstallation.user_id == user.id,
        )
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Installation not found")

    # Remove mappings that reference this installation
    await db.execute(
        delete(RepoChannelMapping).where(
            RepoChannelMapping.installation_id == installation_id,
            RepoChannelMapping.user_id == user.id,
        )
    )
    await db.delete(inst)
    await db.commit()
    return {"ok": True}


# Keep legacy DELETE /disconnect for backward compat
@router.delete("/disconnect")
async def disconnect_slack_all(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(RepoChannelMapping).where(RepoChannelMapping.user_id == user.id)
    )
    await db.execute(
        delete(MonitoredRepo).where(MonitoredRepo.user_id == user.id)
    )
    await db.execute(
        delete(SlackInstallation).where(SlackInstallation.user_id == user.id)
    )
    await db.commit()
    return {"ok": True}


# ── Default channel ──

@router.put("/default-channel")
async def set_default_channel(
    body: SetDefaultChannelRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SlackInstallation).where(
            SlackInstallation.id == UUID(body.installation_id),
            SlackInstallation.user_id == user.id,
        )
    )
    installation = result.scalar_one_or_none()
    if not installation:
        raise HTTPException(status_code=400, detail="Installation not found")

    installation.default_channel_id = body.channel_id
    installation.default_channel_name = body.channel_name
    await db.commit()

    # Auto-join the channel so the bot can post
    await _auto_join_channel(installation.bot_token, body.channel_id)

    return {"ok": True}


async def _auto_join_channel(bot_token: str, channel_id: str) -> None:
    """Have the bot join a public channel. Silently ignores errors (e.g. private channels)."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://slack.com/api/conversations.join",
                headers={"Authorization": f"Bearer {bot_token}"},
                json={"channel": channel_id},
            )
    except Exception:
        pass  # Best-effort; private channels require manual invite


# ── Channel listing ──

@router.get("/channels/{installation_id}")
async def list_slack_channels(
    installation_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SlackInstallation).where(
            SlackInstallation.id == installation_id,
            SlackInstallation.user_id == user.id,
        )
    )
    installation = result.scalar_one_or_none()
    if not installation:
        raise HTTPException(status_code=400, detail="Installation not found")

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


# Keep legacy GET /channels for backward compat
@router.get("/channels")
async def list_slack_channels_legacy(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SlackInstallation)
        .where(SlackInstallation.user_id == user.id)
        .order_by(SlackInstallation.installed_at.desc())
    )
    installation = result.scalars().first()
    if not installation:
        raise HTTPException(status_code=400, detail="Slack not connected")

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

    # Fetch installation info for display
    inst_ids = {m.installation_id for m in mappings if m.installation_id}
    installations_map = {}
    if inst_ids:
        inst_result = await db.execute(
            select(SlackInstallation).where(SlackInstallation.id.in_(inst_ids))
        )
        for inst in inst_result.scalars().all():
            installations_map[inst.id] = inst.team_name

    return {
        "mappings": [
            {
                "id": str(m.id),
                "installation_id": str(m.installation_id) if m.installation_id else None,
                "workspace_name": installations_map.get(m.installation_id, "Unknown"),
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
    # Verify the installation belongs to this user
    inst_result = await db.execute(
        select(SlackInstallation).where(
            SlackInstallation.id == UUID(body.installation_id),
            SlackInstallation.user_id == user.id,
        )
    )
    installation = inst_result.scalar_one_or_none()
    if not installation:
        raise HTTPException(status_code=400, detail="Installation not found")

    repo_name = body.repo_full_name.strip().lower()

    mapping = RepoChannelMapping(
        user_id=user.id,
        installation_id=installation.id,
        repo_full_name=repo_name,
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

    # Auto-join the channel so the bot can post
    await _auto_join_channel(installation.bot_token, body.channel_id)

    # Auto-register GitHub webhook for this repo if not already done
    await _ensure_github_webhook(user, repo_name, db)

    return {
        "id": str(mapping.id),
        "installation_id": str(mapping.installation_id),
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


# ── GitHub Webhook Auto-Registration ──

BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "")


async def _ensure_github_webhook(user: User, repo_full_name: str, db: AsyncSession):
    """Register a GitHub webhook for the repo if one doesn't already exist for this user."""
    if not user.github_access_token:
        logger.warning(f"Cannot register webhook for {repo_full_name}: user has no GitHub token")
        return

    if not BACKEND_PUBLIC_URL:
        logger.warning("BACKEND_PUBLIC_URL not set — skipping webhook registration")
        return

    # Check if we already monitor this repo
    result = await db.execute(
        select(MonitoredRepo).where(
            MonitoredRepo.user_id == user.id,
            MonitoredRepo.repo_full_name == repo_full_name,
        )
    )
    existing = result.scalar_one_or_none()
    if existing and existing.github_webhook_id:
        return  # Already registered

    webhook_secret = secrets.token_hex(32)

    webhook_url = f"{BACKEND_PUBLIC_URL.rstrip('/')}/api/github/webhook"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.github.com/repos/{repo_full_name}/hooks",
                headers={
                    "Authorization": f"Bearer {user.github_access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                json={
                    "name": "web",
                    "active": True,
                    "events": ["pull_request"],
                    "config": {
                        "url": webhook_url,
                        "content_type": "json",
                        "secret": webhook_secret,
                        "insecure_ssl": "0",
                    },
                },
                timeout=15,
            )

        if resp.status_code in (201, 200):
            hook_data = resp.json()
            github_webhook_id = hook_data.get("id")
        elif resp.status_code == 422:
            # Hook may already exist (different user registered it)
            github_webhook_id = None
            logger.info(f"Webhook may already exist for {repo_full_name}: {resp.text}")
        else:
            logger.error(f"Failed to register webhook for {repo_full_name}: {resp.status_code} {resp.text}")
            github_webhook_id = None

        if existing:
            existing.webhook_secret = webhook_secret
            existing.github_webhook_id = github_webhook_id
        else:
            monitored = MonitoredRepo(
                user_id=user.id,
                repo_full_name=repo_full_name,
                github_webhook_id=github_webhook_id,
                webhook_secret=webhook_secret,
            )
            db.add(monitored)

        await db.commit()

    except Exception as e:
        logger.error(f"Error registering webhook for {repo_full_name}: {e}")
