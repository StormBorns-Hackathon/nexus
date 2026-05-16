# Nexus

Autonomous multi-agent pipeline that watches GitHub pull requests, investigates them with AI agents, and delivers analysis reports to Slack. No human in the loop.

## What it does

1. A PR is opened on a connected GitHub repo
2. GitHub webhook fires and hits Nexus
3. Three AI agents run in sequence:
   - **Planner** decomposes the PR into research queries
   - **Researcher** runs parallel web searches and synthesises findings
   - **Action** writes a report and sends it to mapped Slack channels
4. Results also fan out to custom webhooks (Discord, Teams, etc.)

The whole thing runs autonomously. After initial setup, users don't touch anything.

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, Python 3.12, SQLAlchemy (async), PostgreSQL |
| Agent Framework | LangGraph (StateGraph) |
| LLM | OpenRouter (gpt-oss-120b) |
| Web Search | Tavily API |
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Auth | JWT + GitHub OAuth + email/password |
| Integrations | Slack Bot API, GitHub App webhooks, custom outgoing webhooks |
| Observability | Omium SDK, WebSocket real-time traces |
| Database | Neon PostgreSQL (serverless) |
| Deployment | Render (backend), Vercel (frontend) |

## Project Structure

```
nexus/
├── backend/
│   ├── app/
│   │   ├── agents/          # Planner, Researcher, Action agents
│   │   ├── api/             # FastAPI routes (auth, workflows, slack, webhooks)
│   │   ├── graphs/          # LangGraph pipeline orchestration
│   │   ├── models/          # SQLAlchemy models + Pydantic schemas
│   │   ├── services/        # LLM client, WebSocket manager, Omium tracing
│   │   ├── tools/           # Tavily search, Slack, email tools
│   │   └── utils/           # Auth utilities
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (layout, trigger form, etc.)
│   │   ├── pages/           # Dashboard, Profile, Integrations, Onboarding
│   │   └── lib/             # API client, auth context, hooks
│   └── package.json
├── WRITEUP.md               # 3-page hackathon writeup
└── README.md
```

## Quickstart

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL database (or a Neon account)
- API keys: OpenRouter, Tavily, GitHub OAuth app, Slack app

### 1. Clone

```bash
git clone https://github.com/StormBorns-Hackathon/nexus.git
cd nexus
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
JWT_SECRET=your-jwt-secret
OPENROUTER_API_KEY=your-openrouter-key
TAVILY_API_KEY=your-tavily-key
GITHUB_OAUTH_CLIENT_ID=your-github-client-id
GITHUB_OAUTH_SECRET=your-github-client-secret
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
BACKEND_PUBLIC_URL=http://localhost:8000
OMIUM_API_KEY=your-omium-key          # optional
OMIUM_API_URL=https://api.omium.ai    # optional
```

Start the backend:

```bash
fastapi dev
```

The server runs at `http://localhost:8000`.

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://127.0.0.1:8000
VITE_GITHUB_APP_SLUG=your-github-app-slug
```

Start the frontend:

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

### 4. Setup Integrations

1. **Sign up** at `http://localhost:5173/signup` (email or GitHub OAuth)
2. **Link GitHub** from the onboarding flow or Integrations page
3. **Connect Slack** from the Integrations page
4. **Map repos to channels** (e.g. `myorg/api` -> `#backend-alerts`)
5. **Install the GitHub App** on your repos to enable automatic webhook triggers

### 5. Trigger a Workflow

Two ways to trigger:

- **Automatic:** Open a PR on a connected repo. The webhook fires and the pipeline runs.
- **Manual:** Paste a GitHub PR or issue URL on the Trigger page.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Email signup |
| POST | `/api/auth/login` | Email login |
| POST | `/api/auth/github` | GitHub OAuth login |
| POST | `/api/auth/link-github` | Link GitHub to existing account |
| GET | `/api/auth/me` | Current user |
| PATCH | `/api/auth/me` | Update profile |
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows/trigger` | Trigger from GitHub URL |
| GET | `/api/workflows/:id` | Workflow detail + steps |
| GET | `/api/slack/status` | Slack connection status |
| POST | `/api/slack/oauth` | Slack OAuth callback |
| GET | `/api/slack/channels/:id` | List channels for a workspace |
| POST | `/api/github/webhook` | GitHub App webhook receiver |
| CRUD | `/api/custom-webhooks` | Custom outgoing webhooks |

## Dependencies

- **FastAPI** - async Python web framework
- **LangGraph** - agent orchestration
- **OpenAI SDK** (via OpenRouter) - LLM calls
- **Tavily** - web search API
- **SQLAlchemy** (async) - database ORM
- **Slack SDK** - Slack Bot API
- **Omium SDK** - tracing and observability (optional)
- **React + Vite** - frontend
- **Framer Motion** - animations
- **TanStack Query** - data fetching
- **shadcn/ui** - UI components

## Team

**StormBorns** - Built at Anvil Hackathon 2025

## License

MIT
