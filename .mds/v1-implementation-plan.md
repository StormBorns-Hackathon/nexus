# User-Scoped Workflows + Per-User Integration Credentials

## Problem Summary

Two architectural gaps exist in the current system:

### Issue 1: Workflows have no owner
The `Workflow` table has **no `user_id` column**. This means:
- **Every user sees every workflow** on their dashboard — User A can see User B's workflows
- Creating a workflow doesn't record who triggered it
- There's no way to filter workflows per user

### Issue 2: Integration credentials are global
Slack, SendGrid, and Resend credentials are **hardcoded in `.env`** and shared by the entire app:
- `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` → only **your** Slack workspace/channel
- `SENDGRID_API_KEY` / `SENDGRID_EMAIL_ADDRESS` → only **your** SendGrid account
- `RESEND_API_KEY` → only **your** Resend account
- When a workflow runs, the action agent always sends to YOUR Slack channel, regardless of who triggered it
- There's no UI for users to configure their own integrations

---

## Proposed Changes

### Backend: Add user_id to Workflow model

#### [MODIFY] [workflow_models.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/models/workflow_models.py)
- Add `user_id = Column(UUID, ForeignKey("users.id"), nullable=False)` to `Workflow`
- This is the core change — every workflow now belongs to a user

#### [MODIFY] [workflows.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/api/workflows.py)
- `list_workflows`: Add `get_current_user` dependency, filter by `Workflow.user_id == user.id`
- `get_workflow_detail`: Verify `workflow.user_id == user.id` (403 if not)
- `trigger_workflow`: Set `workflow.user_id = user.id` on creation, pass `user.id` to background task

#### [MODIFY] [webhooks.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/api/webhooks.py)
- `ingest_webhook`: Add `get_current_user` dependency, set `workflow.user_id = user.id`

#### [MODIFY] [schemas.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/models/schemas.py)
- Add `user_id: UUID` to `WorkflowSummary` response schema

---

### Backend: Per-User Integration Settings (new `UserSettings` model)

#### [NEW] [user_settings.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/models/user_settings.py)
New `UserSettings` table (one-to-one with `User`):
```
user_id          UUID (PK, FK → users.id)
slack_bot_token  String (nullable, encrypted at rest ideally)
slack_channel_id String (nullable)
sendgrid_api_key String (nullable)
sendgrid_email   String (nullable)
resend_api_key   String (nullable)
updated_at       Timestamp
```
Each user stores their own integration credentials. If a field is `null`, the integration is not configured for that user.

#### [NEW] [settings.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/api/settings.py)
New router at `/api/settings`:
- `GET /api/settings` → returns the current user's settings (masked tokens: `sk-***...abc`)
- `PUT /api/settings` → upserts the current user's settings

#### [MODIFY] [main.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/main.py)
- Register the new `settings` router
- Import `user_settings` model for table creation

---

### Backend: Pass user credentials to the agent pipeline

#### [MODIFY] [pipeline.py (graphs)](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/graphs/pipeline.py)
- Load user's `UserSettings` from DB using the workflow's `user_id`
- Pass a `user_config` dict into `run_pipeline()` containing the user's Slack/SendGrid/Resend credentials

#### [MODIFY] [state.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/agents/state.py)
- Add `user_config: dict` to `AgentState` TypedDict

#### [MODIFY] [pipeline.py (agents)](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/agents/pipeline.py)
- Pass `user_config` through the initial state

#### [MODIFY] [action.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/agents/action.py)
- Read `slack_bot_token`, `slack_channel_id` from `state["user_config"]` instead of `.env`
- Fall back to `.env` values if user config is empty (backward compatible)

#### [MODIFY] [slack.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/tools/slack.py)
- Accept `bot_token` and `channel_id` as parameters instead of reading from `.env`

#### [MODIFY] [email_tool.py](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/backend/app/tools/email_tool.py)
- Accept `api_key` and `from_email` as parameters instead of reading from `.env`

---

### Frontend: Settings / Integrations page

#### [NEW] [api.ts additions](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/frontend/src/lib/api.ts)
- `fetchSettings()` → `GET /api/settings`
- `updateSettings(data)` → `PUT /api/settings`

#### [NEW] [queries.ts additions](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/frontend/src/lib/queries.ts)
- `useSettings()` query hook
- `useUpdateSettings()` mutation hook

#### [NEW] [SettingsPage.tsx](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/frontend/src/pages/SettingsPage.tsx)
New page at `/settings` with cards for each integration:
- **Slack**: Bot Token + Channel ID inputs
- **SendGrid**: API Key + From Email inputs
- **Resend**: API Key input
- Each card shows connected/not connected status
- Save button persists to backend

#### [MODIFY] [App.tsx](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/frontend/src/App.tsx)
- Add `/settings` route

#### [MODIFY] [Sidebar.tsx](file:///Users/mehulagarwal/Documents/anvilHackathon/nexus/frontend/src/components/layout/Sidebar.tsx)
- Add "Settings" / "Integrations" link to sidebar nav

---

### Database Migration

> [!WARNING]
> Adding `user_id` as `NOT NULL` to `workflows` will fail if there are existing rows without a user_id. We have two options:
> 1. **Drop existing workflow rows** (fine for hackathon — these were all test data)
> 2. **Make it nullable temporarily**, backfill, then alter to NOT NULL
>
> I recommend option 1 for the hackathon: drop the `workflows` and `workflow_steps` tables and let SQLAlchemy recreate them.

---

## Verification Plan

### Automated Tests
1. Start backend → verify `user_settings` table is created alongside updated `workflows` table
2. Sign in as User A → trigger workflow → verify it appears on User A's dashboard
3. Sign in as User B → verify User A's workflow is NOT visible
4. `GET /api/settings` → returns empty/default settings
5. `PUT /api/settings` with Slack creds → verify they persist
6. Trigger a workflow → verify it uses User A's configured Slack channel (not `.env`)

### Manual Verification
- Open Settings page → enter Slack Bot Token + Channel ID → Save
- Trigger a workflow → confirm the Slack message goes to the configured channel
- Sign out, sign in as different user → confirm workflows are isolated
