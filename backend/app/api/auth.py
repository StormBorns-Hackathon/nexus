from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import httpx
import os

from app.models.database import get_db
from app.models.user_models import User
from app.utils.auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter()

GITHUB_CLIENT_ID = os.getenv("GITHUB_OAUTH_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_OAUTH_SECRET", "")


# ──────────────── Request / Response schemas ────────────────


class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str


class SignInRequest(BaseModel):
    email: str
    password: str


class GitHubCodeRequest(BaseModel):
    code: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None
    github_id: str | None


# ──────────────── Helpers ────────────────


def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "github_id": user.github_id,
    }


# ──────────────── POST /signup ────────────────


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(body: SignUpRequest, db: AsyncSession = Depends(get_db)):
    # Check existing user
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), user.email)
    return AuthResponse(access_token=token, user=_user_dict(user))


# ──────────────── POST /signin ────────────────


@router.post("/signin", response_model=AuthResponse)
async def signin(body: SignInRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id), user.email)
    return AuthResponse(access_token=token, user=_user_dict(user))


# ──────────────── POST /github ────────────────


@router.post("/github", response_model=AuthResponse)
async def github_auth(body: GitHubCodeRequest, db: AsyncSession = Depends(get_db)):
    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": body.code,
            },
            headers={"Accept": "application/json"},
        )

    token_data = token_resp.json()
    gh_access_token = token_data.get("access_token")
    if not gh_access_token:
        raise HTTPException(
            status_code=400,
            detail=f"GitHub OAuth failed: {token_data.get('error_description', 'unknown error')}",
        )

    # 2. Fetch GitHub user profile
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {gh_access_token}"},
        )
        gh_user = user_resp.json()

        # Fetch primary email if not public
        email = gh_user.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {gh_access_token}"},
            )
            emails = emails_resp.json()
            primary = next((e for e in emails if e.get("primary")), None)
            email = primary["email"] if primary else None

    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from GitHub")

    gh_id = str(gh_user["id"])
    gh_name = gh_user.get("name") or gh_user.get("login", "GitHub User")
    gh_login = gh_user.get("login", "")
    gh_avatar = gh_user.get("avatar_url")

    # 3. Find or create user
    # First check by github_id
    result = await db.execute(select(User).where(User.github_id == gh_id))
    user = result.scalar_one_or_none()

    if not user:
        # Check by email (link accounts)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            # Link GitHub to existing email account
            user.github_id = gh_id
            user.github_access_token = gh_access_token
            user.github_username = gh_login
            user.avatar_url = gh_avatar
        else:
            # Brand new user
            user = User(
                email=email,
                name=gh_name,
                github_id=gh_id,
                github_access_token=gh_access_token,
                github_username=gh_login,
                avatar_url=gh_avatar,
            )
            db.add(user)
    else:
        user.github_access_token = gh_access_token
        user.github_username = gh_login
        user.avatar_url = gh_avatar

    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), user.email)
    return AuthResponse(access_token=token, user=_user_dict(user))


# ──────────────── GET /me ────────────────


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        github_id=user.github_id,
    )
