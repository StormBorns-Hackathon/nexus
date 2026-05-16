from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .models.database import Base, engine
from .models import user_models  # noqa: F401 — ensures User table is registered with Base
from .models import slack_models  # noqa: F401 — ensures Slack tables are registered with Base
from .models import webhook_models  # noqa: F401 — ensures CustomWebhook table is registered
from app.api import webhooks, workflows, websocket, auth, slack, github_webhooks, custom_webhooks
from app.services.omium_tracing import init_omium


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise Omium tracing before anything else
    init_omium()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token VARCHAR(512)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username VARCHAR(255)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(255)")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(255)")
        )
        # ── Multi-workspace migration ──
        # Drop old unique constraint on user_id (single workspace) if it exists
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE slack_installations DROP CONSTRAINT IF EXISTS slack_installations_user_id_key;
            EXCEPTION WHEN undefined_object THEN NULL; END $$;
        """))
        # Add installation_id column to repo_channel_mappings if missing
        await conn.execute(text("""
            ALTER TABLE repo_channel_mappings
            ADD COLUMN IF NOT EXISTS installation_id UUID REFERENCES slack_installations(id)
        """))
        # Drop old unique constraint if it exists
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE repo_channel_mappings DROP CONSTRAINT IF EXISTS uq_user_repo_channel;
            EXCEPTION WHEN undefined_object THEN NULL; END $$;
        """))
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])
app.include_router(slack.router, prefix="/api/slack", tags=["slack"])
app.include_router(github_webhooks.router, prefix="/api/github", tags=["github-webhooks"])
app.include_router(custom_webhooks.router, prefix="/api/custom-webhooks", tags=["custom-webhooks"])


@app.get("/")
async def root():
    return {"message": "hello"}
