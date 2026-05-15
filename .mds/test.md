# Nexus Backend — API Testing Guide

> All commands assume the server is running on `http://localhost:8000`.  
> Start it with `fastapi dev` from the `backend/` directory.

---

## Prerequisites

```bash
# Install wscat for WebSocket testing (one-time)
npm install -g wscat

# Make sure you have curl available
curl --version
```

### Environment Variables

Ensure your `.env` has at minimum:

```env
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
# Optional (pipeline runs in dry-run mode without these)
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0123456789
```

---

## Endpoints Overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/api/webhooks/ingest` | Ingest a webhook signal, triggers pipeline |
| `GET` | `/api/workflows` | List all workflows |
| `GET` | `/api/workflows/{id}` | Get workflow detail + steps |
| `POST` | `/api/workflows/trigger` | Manual trigger with preset scenario |
| `WS` | `/ws/workflows/{id}` | Live trace stream via WebSocket |

---

## Test Cases

### 1. Health Check

**Verify the server is up and responding.**

```bash
curl http://localhost:8000/
```

**Expected response:**

```json
{"message": "hello"}
```

**Expected status:** `200 OK`

---

### 2. Swagger Docs

**Verify auto-generated API docs load.**

Open in browser:

```
http://localhost:8000/docs
```

You should see all endpoints listed with their schemas.

---

### 3. Webhook Ingest — Happy Path

**Ingest a GitHub issue signal and verify a workflow is created.**

```bash
curl -X POST http://localhost:8000/api/webhooks/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source": "github",
    "event_type": "issue.opened",
    "payload": {
      "title": "Bug: login page broken",
      "body": "Users cannot log in since the last deploy",
      "url": "https://github.com/org/repo/issues/42"
    }
  }'
```

**Expected response (201):**

```json
{
  "workflow_id": "<uuid>",
  "status": "pending",
  "trace_url": "/workflows/<uuid>"
}
```

**What to verify:**
- [ ] Status code is `201`
- [ ] `workflow_id` is a valid UUID
- [ ] `status` is `"pending"`
- [ ] `trace_url` contains the workflow ID

> **Save the `workflow_id`** — you'll need it for tests 5, 6, and 8.

---

### 4. Webhook Ingest — Validation Error

**Send an incomplete payload to verify schema validation.**

```bash
# Missing required "source" field
curl -X POST http://localhost:8000/api/webhooks/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {"title": "test"}
  }'
```

**Expected response (422):**

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "source"],
      "msg": "Field required",
      ...
    },
    {
      "type": "missing",
      "loc": ["body", "event_type"],
      "msg": "Field required",
      ...
    }
  ]
}
```

**What to verify:**
- [ ] Status code is `422`
- [ ] Error mentions missing `source` and `event_type` fields

---

### 5. List Workflows

**Retrieve all workflows (run after test 3 so there's data).**

```bash
curl http://localhost:8000/api/workflows
```

**Expected response (200):**

```json
{
  "workflows": [
    {
      "id": "<uuid>",
      "signal_type": "github",
      "status": "pending",
      "result_summary": null,
      "created_at": "2026-05-15T...",
      "completed_at": null
    }
  ]
}
```

**What to verify:**
- [ ] Response has a `workflows` array
- [ ] The workflow from test 3 appears in the list
- [ ] `created_at` is a valid ISO timestamp
- [ ] Workflows are ordered newest-first

---

### 6. Get Workflow Detail

**Fetch a specific workflow with its steps.**

```bash
# Replace <workflow_id> with the UUID from test 3
curl http://localhost:8000/api/workflows/<workflow_id>
```

**Expected response (200):**

```json
{
  "workflow": {
    "id": "<uuid>",
    "signal_type": "github",
    "status": "completed",
    "result_summary": "Slack: sent",
    "created_at": "...",
    "completed_at": "..."
  },
  "steps": [
    {
      "id": "<uuid>",
      "agent_name": "planner",
      "step_type": "thinking",
      "input_data": null,
      "output_data": {"message": "Analyzing signal..."},
      "tool_name": null,
      "duration_ms": null,
      "created_at": "..."
    }
  ]
}
```

**What to verify:**
- [ ] `workflow` object has correct fields
- [ ] If the pipeline has finished: `status` is `"completed"` or `"failed"`
- [ ] If completed: `completed_at` is not null
- [ ] `steps` array contains trace events from planner, researcher, and action agents
- [ ] Each step has `agent_name` and `step_type`

> **Note:** If you check immediately after ingest, the status may still be `"pending"` or `"running"`. Wait a few seconds for the background pipeline to complete, then check again.

---

### 7. Get Workflow Detail — Not Found

**Request a workflow that doesn't exist.**

```bash
curl http://localhost:8000/api/workflows/00000000-0000-0000-0000-000000000000
```

**Expected response (404):**

```json
{
  "detail": "Workflow not found"
}
```

**What to verify:**
- [ ] Status code is `404`
- [ ] Error message is clear

---

### 8. Manual Trigger — GitHub Issue Scenario

**Trigger a workflow using the preset scenario with default payload.**

```bash
curl -X POST http://localhost:8000/api/workflows/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "github_issue"
  }'
```

**Expected response (201):**

```json
{
  "workflow_id": "<uuid>",
  "status": "pending"
}
```

**What to verify:**
- [ ] Status code is `201`
- [ ] A new workflow is created with `signal_type: "github"`
- [ ] Verify it appears in `GET /api/workflows`

---

### 9. Manual Trigger — Custom Payload

**Trigger with a custom payload instead of the default.**

```bash
curl -X POST http://localhost:8000/api/workflows/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "github_issue",
    "custom_payload": {
      "title": "Critical: database migration failed",
      "body": "Migration 042 failed on production, users seeing 500 errors",
      "url": "https://github.com/org/repo/issues/999"
    }
  }'
```

**Expected response (201):**

```json
{
  "workflow_id": "<uuid>",
  "status": "pending"
}
```

**What to verify:**
- [ ] The created workflow uses your custom payload (check via `GET /api/workflows/<id>`)

---

### 10. Manual Trigger — Unknown Scenario

**Send an unsupported scenario name.**

```bash
curl -X POST http://localhost:8000/api/workflows/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "jira_ticket"
  }'
```

**Expected response (400):**

```json
{
  "detail": "Unknown scenario"
}
```

**What to verify:**
- [ ] Status code is `400`
- [ ] Error message says "Unknown scenario"

---

### 11. WebSocket — Live Trace Stream

**Connect to the WebSocket before triggering a workflow to see live trace events.**

**Terminal 1 — Connect WebSocket:**

```bash
# Replace <workflow_id> with the UUID you'll get from terminal 2
wscat -c ws://localhost:8000/ws/workflows/<workflow_id>
```

**Terminal 2 — Trigger workflow (use the same workflow_id):**

The easiest way is to:
1. First create a workflow via `/api/webhooks/ingest` (test 3)
2. Copy the `workflow_id` from the response
3. Connect WebSocket with that ID in terminal 1

Since the pipeline runs as a background task, you may need to connect the WebSocket quickly after ingesting.

**Expected WebSocket messages (in terminal 1):**

```json
{"event": "step_thinking", "agent": "planner", "step_type": "thinking", "data": {"message": "Analyzing signal and decomposing into tasks..."}, "timestamp": "..."}
{"event": "step_result", "agent": "planner", "step_type": "result", "data": {"research_queries": [...], "action_plan": "..."}, "timestamp": "..."}
{"event": "step_thinking", "agent": "researcher", "step_type": "thinking", "data": {"message": "Researching 3 queries..."}, "timestamp": "..."}
{"event": "step_tool_call", "agent": "researcher", "step_type": "tool_call", "data": {"tool": "tavily_search", "query": "..."}, "timestamp": "..."}
{"event": "step_thinking", "agent": "researcher", "step_type": "thinking", "data": {"message": "Synthesizing research findings..."}, "timestamp": "..."}
{"event": "step_result", "agent": "researcher", "step_type": "result", "data": {...}, "timestamp": "..."}
{"event": "step_thinking", "agent": "action", "step_type": "thinking", "data": {"message": "Composing deliverable from research..."}, "timestamp": "..."}
{"event": "step_tool_call", "agent": "action", "step_type": "tool_call", "data": {"tool": "send_slack_message", ...}, "timestamp": "..."}
{"event": "step_result", "agent": "action", "step_type": "result", "data": {"action_result": "...", "confirmed": true}, "timestamp": "..."}
{"event": "workflow_completed", "workflow_id": "<uuid>", "status": "completed", "result_summary": "..."}
```

**What to verify:**
- [ ] Connection established without error
- [ ] Events arrive in order: planner → researcher → action
- [ ] Each event has `agent`, `step_type`, `data`, and `timestamp`
- [ ] Final `workflow_completed` event is received
- [ ] Connection stays alive until you close it

---

### 12. WebSocket — Disconnect Handling

**Verify the server handles client disconnects gracefully.**

1. Connect via `wscat -c ws://localhost:8000/ws/workflows/<any-uuid>`
2. Press `Ctrl+C` to disconnect
3. Server should not crash or log errors

**What to verify:**
- [ ] Server continues running after client disconnect
- [ ] No unhandled exception in server logs

---

## End-to-End Flow Test

Run this full sequence to validate the entire pipeline:

```bash
# Step 1: Ingest a webhook
RESPONSE=$(curl -s -X POST http://localhost:8000/api/webhooks/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "source": "github",
    "event_type": "issue.opened",
    "payload": {
      "title": "Bug: payment processing fails for international cards",
      "body": "Stripe webhook returns 402 for non-USD currencies",
      "url": "https://github.com/org/repo/issues/256"
    }
  }')

echo "Created: $RESPONSE"
WORKFLOW_ID=$(echo $RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['workflow_id'])")
echo "Workflow ID: $WORKFLOW_ID"

# Step 2: Check it exists in the list
curl -s http://localhost:8000/api/workflows | python3 -m json.tool

# Step 3: Wait for pipeline to complete (adjust as needed)
echo "Waiting 30s for pipeline to complete..."
sleep 30

# Step 4: Check the detail with steps
curl -s http://localhost:8000/api/workflows/$WORKFLOW_ID | python3 -m json.tool

# Step 5: Verify status is completed or failed
STATUS=$(curl -s http://localhost:8000/api/workflows/$WORKFLOW_ID \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['workflow']['status'])")
echo "Final status: $STATUS"
```

**Expected outcome:**
- [ ] Workflow created with `pending` status
- [ ] After ~30s, status transitions to `completed` (or `failed` if API keys are missing)
- [ ] Steps array is populated with planner, researcher, and action traces
- [ ] `result_summary` is not null
- [ ] `completed_at` is not null

---

## Common Issues & Debugging

| Symptom | Cause | Fix |
|---------|-------|-----|
| `422` on ingest | Missing `source`, `event_type`, or `payload` | Check request body matches `WebhookIngestRequest` schema |
| Workflow stays `pending` forever | Background task crashed | Check server logs for tracebacks |
| Empty `steps` array | Pipeline didn't persist traces | Check `OPENROUTER_API_KEY` and `TAVILY_API_KEY` are set |
| WebSocket connects but no events | UUID/str mismatch or late connection | Connect WS *before* triggering the workflow |
| `"Slack failed: ..."` in result | Slack not configured | Expected if `SLACK_BOT_TOKEN` is not set — runs in dry-run mode |
| `500 Internal Server Error` | Database connection issue | Verify `DATABASE_URL` and that PostgreSQL is running |
