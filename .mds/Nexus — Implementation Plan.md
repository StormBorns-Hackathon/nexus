---
title: Nexus — Implementation Plan

---

# Nexus — Implementation Plan

> **Drop a signal, get a completed action.**

---

## 1. Problem Understanding

**Problem Summary:** Build an autonomous multi-agent pipeline that ingests external signals (webhooks), decomposes them into tasks, researches via web/APIs, and executes real-world actions — all without human intervention.

**Target Users:** Engineering teams and operators running recurring research-to-action workflows (e.g., "when X alert fires, investigate Y, and post summary to Slack").

**Pain Points:**
- Manual triage of alerts/signals is slow and repetitive
- Research-to-action pipelines are fragmented across tools
- No visibility into what an autonomous system is actually doing

**Expected Outcomes:**
- Fire a webhook → agents autonomously plan, research, and act
- Real-time trace dashboard shows agent reasoning live
- Deliverable (Slack message / email / report) lands within 60 seconds

---

## 2. Technical Decision

| Question | Answer |
|---|---|
| **AI Required** | **YES** |
| **Reason** | Core product IS multi-agent orchestration with planning, reasoning, tool-calling, and web search. Every evaluation axis demands AI. |
| **Selected Backend** | FastAPI · Python · LangGraph · CrewAI |
| **Justification** | LangGraph provides state-machine agent orchestration with async support. CrewAI handles agent role separation. FastAPI gives async WebSocket support for real-time streaming. |

**External Services:**

| Service | Purpose |
|---|---|
| OpenRouter / OpenAI | LLM calls (GPT-4o / Claude 3.5) |
| Tavily / SerpAPI | Web search tool for Researcher agent |
| Slack API | Action delivery (send results) |
| SendGrid / Resend | Email delivery fallback |
| PostgreSQL | Workflow state + trace persistence |
| Omium SDK (bonus) | Trace observability for +10% bonus |

---

## 3. MVP Definition

### Core Features (Must Have)

| # | Feature | User Value | Complexity | Time |
|---|---|---|---|---|
| 1 | **Webhook Ingestion Endpoint** | Triggers workflows from any external system | Low | 1h |
| 2 | **Planner Agent** | Decomposes incoming signal into actionable sub-tasks | High | 3h |
| 3 | **Researcher Agent** | Web search + API calls to gather context | High | 3h |
| 4 | **Action Agent** | Executes final action (Slack/email/file) | Medium | 2h |
| 5 | **LangGraph Orchestration** | Manages agent state transitions + handoffs | High | 3h |
| 6 | **Real-Time Trace Dashboard** | Watch agents think live via WebSocket | Medium | 3h |
| 7 | **One Polished E2E Workflow** | "GitHub issue webhook → research → Slack summary" | Medium | 2h |

### Secondary Features (Should Have)

| # | Feature | User Value | Complexity | Time |
|---|---|---|---|---|
| 8 | **Workflow History Page** | Review past workflow runs | Low | 1.5h |
| 9 | **Agent Step Detail View** | Click into any step to see reasoning + tool calls | Medium | 1.5h |
| 10 | **Manual Trigger UI** | Fire a test webhook from the dashboard | Low | 1h |

### Stretch Features (Nice to Have)

| # | Feature | User Value | Complexity | Time |
|---|---|---|---|---|
| 11 | Omium SDK Tracing | Bonus +10% on judging | Medium | 2h |
| 12 | Multiple workflow templates | Show versatility | High | 3h+ |
| 13 | Retry/error recovery UI | Polish | Medium | 2h |

---

## 4. User Flow

```
External System (GitHub, PagerDuty, manual)
         │
         ▼
   POST /api/webhooks/ingest   ← Webhook payload arrives
         │
         ▼
   FastAPI receives, validates, creates Workflow record
         │
         ▼
   LangGraph pipeline triggered (async background task)
         │
         ├──► Planner Agent
         │       • Reads signal payload
         │       • Decomposes into research questions + action plan
         │       • Emits trace events via WebSocket
         │
         ├──► Researcher Agent
         │       • Executes web searches (Tavily)
         │       • Calls relevant APIs
         │       • Synthesizes findings
         │       • Emits trace events via WebSocket
         │
         ├──► Action Agent
         │       • Takes research output + plan
         │       • Executes action (Slack message / email / file)
         │       • Confirms completion
         │       • Emits trace events via WebSocket
         │
         ▼
   Workflow marked COMPLETED in DB
         │
         ▼
   Dashboard updates in real-time (WebSocket)
         │
         ▼
   User sees: full trace, agent reasoning, final deliverable
```

**Frontend User Journey:**
1. User opens Nexus dashboard → sees list of workflow runs
2. User clicks "Trigger Test Webhook" or fires external webhook
3. Dashboard auto-navigates to live trace view
4. Cards appear in real-time: Planner thinking → Researcher searching → Action executing
5. Final card shows deliverable (Slack message sent, email delivered)
6. User can click any step to expand reasoning details

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ Landing  │  │ Workflow │  │   Live Trace View     │  │
│  │  Page    │  │  List    │  │   (WebSocket)         │  │
│  └──────────┘  └──────────┘  └───────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │  HTTP + WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ Webhook  │  │ Workflow │  │  WebSocket Manager    │  │
│  │ Router   │  │  Router  │  │  (broadcast traces)   │  │
│  └────┬─────┘  └──────────┘  └───────────────────────┘  │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────────────────────────────────────────────┐    │
│  │           LangGraph State Machine                │    │
│  │                                                  │    │
│  │  ┌─────────┐   ┌────────────┐   ┌────────────┐  │    │
│  │  │ Planner │──►│ Researcher │──►│   Action   │  │    │
│  │  │  Agent  │   │   Agent    │   │   Agent    │  │    │
│  │  └─────────┘   └────────────┘   └────────────┘  │    │
│  │       │              │                │          │    │
│  │       ▼              ▼                ▼          │    │
│  │    [GPT-4o]     [Tavily API]    [Slack API]      │    │
│  │                 [Web Fetch]     [SendGrid]       │    │
│  └──────────────────────────────────────────────────┘    │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────┐                                           │
│  │PostgreSQL│  ← Workflows, Steps, Traces               │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

### AI Architecture (LangGraph Pipeline)

```
Webhook Payload
      │
      ▼
┌─────────────┐
│   START      │
└──────┬──────┘
       ▼
┌─────────────┐     Prompt: "Decompose this signal into
│   PLANNER   │◄─── research questions and an action plan"
│   Agent     │
└──────┬──────┘
       │  outputs: research_queries[], action_plan
       ▼
┌─────────────┐     Tools: tavily_search, fetch_url
│  RESEARCHER │◄─── Prompt: "Research these questions,
│   Agent     │     synthesize findings"
└──────┬──────┘
       │  outputs: research_summary, evidence[]
       ▼
┌─────────────┐     Tools: send_slack, send_email
│   ACTION    │◄─── Prompt: "Execute the action plan
│   Agent     │     using research findings"
└──────┬──────┘
       │  outputs: action_result, confirmation
       ▼
┌─────────────┐
│    END       │
└─────────────┘

State shared across all nodes:
{
  workflow_id, signal_payload, plan,
  research_queries, research_results,
  action_plan, action_result, trace_events[]
}
```

---

## 6. Database Design

### Entity: `workflows`

| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Unique workflow identifier |
| `signal_type` | VARCHAR(50) | Source type (github, pagerduty, manual) |
| `signal_payload` | JSONB | Raw webhook payload |
| `status` | ENUM | pending / running / completed / failed |
| `result_summary` | TEXT | Final action summary |
| `created_at` | TIMESTAMP | When workflow was triggered |
| `completed_at` | TIMESTAMP | When workflow finished |

### Entity: `workflow_steps`

| Field | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Step identifier |
| `workflow_id` | UUID (FK) | Parent workflow |
| `agent_name` | VARCHAR(50) | planner / researcher / action |
| `step_type` | VARCHAR(50) | thinking / tool_call / result |
| `input_data` | JSONB | What the agent received |
| `output_data` | JSONB | What the agent produced |
| `tool_name` | VARCHAR(100) | Tool used (if any) |
| `duration_ms` | INTEGER | Step execution time |
| `created_at` | TIMESTAMP | Step timestamp |

**Relationships:**
- `workflows` → `workflow_steps`: one-to-many

> [!NOTE]
> Schema is intentionally minimal. No auth tables, no user tables. This is a demo-focused MVP.

---

## 7. API Design

### Webhook Ingestion

```
POST /api/webhooks/ingest

Purpose: Receive external webhook, trigger agent pipeline
Request:
{
  "source": "github",           // signal source identifier
  "event_type": "issue.opened", // event type
  "payload": { ... }            // raw event data
}
Response: 201
{
  "workflow_id": "uuid",
  "status": "pending",
  "trace_url": "/workflows/uuid"
}
```

### List Workflows

```
GET /api/workflows

Purpose: List all workflow runs
Response: 200
{
  "workflows": [
    {
      "id": "uuid",
      "signal_type": "github",
      "status": "completed",
      "result_summary": "...",
      "created_at": "...",
      "completed_at": "..."
    }
  ]
}
```

### Get Workflow Detail

```
GET /api/workflows/{workflow_id}

Purpose: Get workflow with all steps
Response: 200
{
  "workflow": { ... },
  "steps": [ ... ]
}
```

### Manual Trigger

```
POST /api/workflows/trigger

Purpose: Manually trigger a test workflow from UI
Request:
{
  "scenario": "github_issue",  // pre-built scenario
  "custom_payload": { ... }    // optional override
}
Response: 201
{ "workflow_id": "uuid", "status": "pending" }
```

### WebSocket

```
WS /ws/workflows/{workflow_id}

Purpose: Real-time trace streaming
Messages (server → client):
{
  "event": "step_started" | "step_completed" | "workflow_completed",
  "agent": "planner" | "researcher" | "action",
  "step_type": "thinking" | "tool_call" | "result",
  "data": { ... },
  "timestamp": "..."
}
```

---

## 8. Folder Structure

### Frontend

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn components
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── workflow/
│   │   │   ├── WorkflowCard.tsx
│   │   │   ├── WorkflowList.tsx
│   │   │   └── WorkflowStatus.tsx
│   │   ├── trace/
│   │   │   ├── TraceTimeline.tsx
│   │   │   ├── TraceStep.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   └── LiveIndicator.tsx
│   │   └── trigger/
│   │       └── TriggerForm.tsx
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Dashboard.tsx
│   │   ├── WorkflowDetail.tsx
│   │   └── TriggerPage.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useWorkflows.ts
│   │   └── useWorkflowDetail.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── types/
│   │   └── index.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

### Backend (AI + FastAPI)

```
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── webhooks.py        # POST /webhooks/ingest
│   │   ├── workflows.py       # GET/POST /workflows
│   │   └── websocket.py       # WS /ws/workflows/{id}
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── planner.py         # Planner agent node
│   │   ├── researcher.py      # Researcher agent node
│   │   └── action.py          # Action agent node
│   ├── graphs/
│   │   ├── __init__.py
│   │   └── pipeline.py        # LangGraph state machine
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── web_search.py      # Tavily search wrapper
│   │   ├── slack.py           # Slack message sender
│   │   ├── email.py           # Email sender
│   │   └── fetch_url.py       # URL content fetcher
│   ├── services/
│   │   ├── __init__.py
│   │   ├── workflow_service.py
│   │   └── ws_manager.py      # WebSocket connection manager
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py         # Pydantic models
│   │   └── database.py        # SQLAlchemy / asyncpg setup
│   ├── prompts/
│   │   ├── planner.py
│   │   ├── researcher.py
│   │   └── action.py
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py          # Settings, env vars
│   └── main.py                # FastAPI app entry
├── pyproject.toml
├── .env
└── README.md
```

---

## 9. Team Task Distribution

### Frontend Developer 1 — **Dashboard & Layout**

| Task | Hours | Dependencies |
|---|---|---|
| Project setup (Vite + React + Tailwind + shadcn) | 0.5h | None |
| Layout (Header, Sidebar, responsive shell) | 1.5h | None |
| Landing page (hero, product pitch) | 1.5h | None |
| Dashboard page (workflow list, status cards) | 2h | API contract |
| Workflow history with filtering | 1.5h | GET /workflows |
| Polish, animations, dark mode | 2h | After core pages |
| Demo prep + testing | 1h | Integration |

### Frontend Developer 2 — **Live Trace View & WebSocket**

| Task | Hours | Dependencies |
|---|---|---|
| WebSocket hook + connection manager | 1.5h | WS contract |
| Live Trace Timeline component | 3h | WebSocket hook |
| Agent Step cards (planner/researcher/action) | 2h | Trace Timeline |
| Manual Trigger form page | 1.5h | POST /workflows/trigger |
| Step detail expansion view | 1.5h | GET /workflows/{id} |
| Real-time animations (typing, pulse, progress) | 1.5h | After core |
| Integration testing | 1h | Backend ready |

### Backend Developer 1 (AI + Express) — **Agent Pipeline**

| Task | Hours | Dependencies |
|---|---|---|
| LangGraph state machine skeleton | 2h | None |
| Planner agent (prompt + node) | 2h | Graph skeleton |
| Researcher agent + Tavily tool | 2.5h | Graph skeleton |
| Action agent + Slack/email tools | 2h | Graph skeleton |
| WebSocket trace emission from agents | 1.5h | WS manager |
| E2E pipeline testing + prompt tuning | 2h | All agents |
| Demo scenario hardening | 1h | E2E working |

### Backend Developer 2 — **API + Infrastructure**

| Task | Hours | Dependencies |
|---|---|---|
| FastAPI project setup + config | 1h | None |
| PostgreSQL schema + async DB layer | 1.5h | None |
| Webhook ingestion endpoint | 1h | DB layer |
| Workflow CRUD endpoints | 1.5h | DB layer |
| WebSocket manager (broadcast) | 2h | None |
| Background task runner (asyncio) | 1.5h | Pipeline ready |
| Integration with agent pipeline | 1.5h | Both devs ready |
| CORS, error handling, deploy | 1h | After integration |

### Parallel Work Opportunities

```
Hour 0-5: ALL FOUR work independently
  FE1: Layout + Landing     │  FE2: WebSocket hook + Trace UI
  BE1: LangGraph + Agents   │  BE2: FastAPI + DB + APIs

Hour 5-8: First integration checkpoint
  FE2 connects to BE2's WebSocket
  BE1 connects pipeline to BE2's task runner

Hour 8+: Integrated development
  Everyone working against real endpoints
```

---

## 10. 24-Hour Execution Timeline

| Time Block | FE1 | FE2 | BE1 (AI) | BE2 |
|---|---|---|---|---|
| **H0–1** | Vite+shadcn setup, design system | WebSocket hook scaffold | LangGraph skeleton, prompts | FastAPI setup, DB schema |
| **H1–3** | Layout shell, Header, Sidebar | Trace Timeline component | Planner agent + tests | Webhook + Workflow endpoints |
| **H3–5** | Landing page, Dashboard list | Agent Step cards, animations | Researcher agent + Tavily | WebSocket manager |
| **H5–6** | 🔗 **CHECKPOINT 1**: FE connects to GET /workflows | 🔗 FE2 connects to WS | 🔗 BE1 pipeline → BE2 task runner | 🔗 Integration testing |
| **H6–8** | Workflow status cards, polish | Live trace view wired to WS | Action agent + Slack tool | Background asyncio runner |
| **H8–10** | History page, filtering | Manual trigger form | E2E pipeline tuning | Trigger endpoint, CORS |
| **H10–11** | 🔗 **CHECKPOINT 2**: Full integration test | 🔗 End-to-end flow test | 🔗 Full pipeline demo run | 🔗 Bug fixes |
| **H11–14** | UI polish, micro-animations | Step detail expansion | Prompt optimization | Error handling, logging |
| **H14–16** | Dark mode, responsive | Edge case UX | Demo scenario hardening | Deploy prep |
| **H16–18** | 🔗 **CHECKPOINT 3**: Feature freeze | 🔗 Feature freeze | 🔗 Feature freeze | 🔗 Feature freeze |
| **H18–20** | Bug fixes, visual polish | Bug fixes, animation polish | Pipeline reliability testing | Stability testing |
| **H20–22** | Demo flow prep | Screen recording assist | Demo script + rehearsal | README, writeup |
| **H22–24** | 🎬 Demo recording, submission | 🎬 Final testing | 🎬 Demo recording | 🎬 Submission packaging |

> [!IMPORTANT]
> **Feature freeze at Hour 18.** Last 6 hours are bug-fixing, polish, demo prep, and submission only. No new features.

---

## 11. Risk Assessment & Fallback Plan

| Risk | Impact | Fallback |
|---|---|---|
| **LLM API latency >30s** | Demo feels slow | Pre-warm with a cached first run; use GPT-4o-mini for speed; show "thinking" animations to mask wait |
| **LLM API rate limits** | Pipeline stalls | Use OpenRouter with fallback models; queue requests; have a pre-recorded backup demo |
| **Agent hallucination** | Wrong actions taken | Constrain tool schemas tightly; validate outputs before action execution; hardcode demo scenario tools |
| **Tavily/search API failure** | Researcher agent breaks | Cache known-good search results for demo scenario; have local mock data |
| **Slack API failure** | No visible action result | Fall back to console output + dashboard display; email as backup |
| **WebSocket disconnection** | Dashboard goes blank | Auto-reconnect logic; polling fallback; optimistic UI with HTTP GET |
| **PostgreSQL issues** | No persistence | In-memory dict store as fallback; SQLite file-based backup |
| **LangGraph complexity** | Can't finish pipeline | Simplify to sequential function calls with manual state passing |
| **Demo crashes live** | Judging failure | Pre-recorded backup video; "replay" mode that shows cached workflow |

---

## 12. Demo Strategy

### Demo Flow (5 minutes)

| Segment | Duration | Content |
|---|---|---|
| **Opening Hook** | 30s | "What if your infrastructure could think for itself? Watch this." |
| **Problem** | 45s | "Teams spend hours triaging alerts → researching context → taking action. It's manual, slow, and repetitive." |
| **Live Demo** | 2.5min | Fire a real webhook → dashboard lights up → agents think in real time → Slack message lands |
| **Architecture** | 45s | Quick diagram: webhook → planner → researcher → action. Show LangGraph state machine. |
| **Impact + Close** | 30s | "60 seconds from signal to action. No human in the loop. That's Nexus." |

### Demo Script

1. Open Nexus dashboard (empty state, clean)
2. Say: *"A critical GitHub issue just came in. Let's fire it."*
3. Click "Trigger Webhook" → paste GitHub issue payload OR use pre-built scenario
4. Dashboard auto-navigates to live trace view
5. **Planner card appears** — show it decomposing the problem in real-time
6. **Researcher card appears** — show web searches happening, results streaming
7. **Action card appears** — show Slack message being composed and sent
8. Switch to Slack → show the delivered message with research summary
9. Go back to dashboard → show completed workflow with full trace

### Judge Talking Points
- Multi-agent: 3 distinct agents with clear responsibilities
- Autonomous: zero human intervention after webhook fires
- Long-running: async background task, survives beyond request lifecycle
- Tool-calling: Tavily search, Slack API, URL fetch — real side effects
- Deep reasoning: Planner decomposes, Researcher synthesizes, Action executes

### Backup Demo
- Pre-recorded video of a successful run
- "Replay mode": dashboard can replay a cached workflow trace with animations

---

## 13. Fast Development Recommendations

### Time-Saving Libraries
- **`shadcn/ui`** — Pre-built components, no design time
- **`framer-motion`** — Quick animations for trace cards
- **`react-router-dom`** — Simple routing, no Next.js overhead
- **`@tanstack/react-query`** — Caching, refetching, loading states for free
- **`tavily-python`** — One-liner web search, no scraping
- **`langchain-openai`** — Standardized LLM interface
- **`asyncpg`** + **`databases`** — Async PostgreSQL without ORM overhead

### Hardcoded Shortcuts (Acceptable for Hackathon)
- **Hardcode the demo scenario** — One perfect GitHub-issue-to-Slack workflow
- **Hardcode Slack channel** — No channel picker, just one target
- **Hardcode agent prompts** — No prompt editor, bake them in
- **Skip auth entirely** — No login, no sessions, public dashboard
- **Skip pagination** — Show last 20 workflows, no infinite scroll
- **Use SQLite if PostgreSQL is painful** — Trade scale for speed
- **Pre-seed sample data** — Dashboard looks alive on first load

### Mock-Data Opportunities
- Seed 3-4 completed workflow traces so dashboard isn't empty
- Cache a known-good Tavily response for the demo scenario
- Have a fallback Slack message template if LLM output is weird

### Simplification Areas
- No error retry logic — if a step fails, mark workflow as failed
- No workflow editing or configuration
- No user management or multi-tenancy
- No deployment automation — run locally for demo
- Single workflow template only

---

## 14. Implementation Summary

**Product:** Nexus

**One-line Product Pitch:** Drop a signal, get a completed action.

**Target Users:** Engineering teams and operators running recurring research-to-action workflows.

**MVP Features:**
- Webhook ingestion endpoint (accepts any external signal)
- 3-agent LangGraph pipeline (Planner → Researcher → Action)
- Real-time trace dashboard with WebSocket streaming
- Manual trigger UI for demo
- Slack/email action delivery
- Workflow history view

**Primary User Flow:**

```
Webhook fires (GitHub issue, alert, manual)
       ↓
Planner agent decomposes signal into tasks
       ↓
Researcher agent searches web + APIs
       ↓
Action agent sends Slack message with findings
       ↓
Dashboard shows complete trace in real-time
```

**Key Screens:**
- Landing Page — Product pitch + "Try it" CTA
- Dashboard — Workflow list with status indicators
- Live Trace View — Real-time agent activity timeline
- Workflow Detail — Completed workflow with expandable steps
- Trigger Page — Manual webhook trigger form

**AI Pipeline:**
```
LangGraph StateGraph:
  START → Planner (GPT-4o) → Researcher (GPT-4o + Tavily) → Action (GPT-4o + Slack) → END
  
State: { workflow_id, payload, plan, research, action_result, traces[] }
Each node emits trace events via WebSocket manager
```

**Primary CTA:** "Fire a Webhook" → triggers live demo workflow

**Features Intentionally Excluded:**
- Authentication / user accounts
- Workflow editor / visual builder
- Complex retry logic / error recovery
- Production database migrations
- Multiple workflow templates
- Multi-tenancy
- Deployment infrastructure

**Selected Stack:**

| Layer | Technology |
|---|---|
| **Frontend** | React · TypeScript · Vite · Tailwind · shadcn/ui · TanStack Query · WebSocket · Bun |
| **Backend** | FastAPI · Python · LangGraph · CrewAI · asyncio · PostgreSQL |
| **AI** | GPT-4o (via OpenAI/OpenRouter) · Tavily (web search) · LangChain tools |
| **Actions** | Slack API · SendGrid/Resend |
| **Bonus** | Omium SDK (tracing) |