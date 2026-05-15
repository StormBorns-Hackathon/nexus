import type { Workflow, WorkflowStep, TriggerScenario } from "@/types"

export const mockWorkflows: Workflow[] = [
  {
    id: "wf-001-a3b8",
    signal_type: "github",
    signal_payload: {
      title: "Critical: Memory leak in worker pool",
      description: "Workers are not releasing connections after timeout, causing OOM kills in production.",
      repo: "nexus-platform/core",
      issue_number: 1247,
      author: "sarah-chen",
    },
    status: "completed",
    result_summary:
      "Investigated memory leak in worker pool. Root cause: missing connection.release() in timeout handler. Posted detailed analysis with fix to #engineering Slack channel.",
    created_at: "2026-05-15T08:12:00Z",
    completed_at: "2026-05-15T08:12:58Z",
  },
  {
    id: "wf-002-d7f2",
    signal_type: "pagerduty",
    signal_payload: {
      title: "High CPU on api-gateway-prod-3",
      description: "CPU usage exceeded 90% threshold for 5 minutes. Auto-scaling has not triggered.",
      severity: "critical",
      service: "api-gateway",
    },
    status: "running",
    result_summary: null,
    created_at: "2026-05-15T09:30:15Z",
    completed_at: null,
  },
  {
    id: "wf-003-e1c4",
    signal_type: "github",
    signal_payload: {
      title: "Add rate limiting to public API endpoints",
      description: "We need rate limiting on /api/v1/search and /api/v1/export to prevent abuse.",
      repo: "nexus-platform/api",
      issue_number: 892,
      author: "marcus-r",
    },
    status: "completed",
    result_summary:
      "Researched rate limiting strategies. Recommended token bucket algorithm with Redis. Drafted implementation plan and sent to #backend-eng via Slack.",
    created_at: "2026-05-15T07:45:00Z",
    completed_at: "2026-05-15T07:46:12Z",
  },
  {
    id: "wf-004-b9a1",
    signal_type: "manual",
    signal_payload: {
      title: "Evaluate new vector DB options",
      description: "Compare Qdrant, Pinecone, and Weaviate for our RAG pipeline. Focus on cost and latency.",
    },
    status: "completed",
    result_summary:
      "Compared 3 vector databases across cost, latency, and feature set. Qdrant recommended for self-hosted deployment. Full comparison table sent to #ml-platform.",
    created_at: "2026-05-14T22:10:00Z",
    completed_at: "2026-05-14T22:11:15Z",
  },
  {
    id: "wf-005-c3d6",
    signal_type: "github",
    signal_payload: {
      title: "CI pipeline failing on arm64 builds",
      description: "Docker builds for arm64 targets have been failing since the Node 22 upgrade.",
      repo: "nexus-platform/infra",
      issue_number: 341,
      author: "priya-p",
    },
    status: "failed",
    result_summary: "Researcher agent encountered rate limit on search API. Pipeline aborted.",
    created_at: "2026-05-14T20:30:00Z",
    completed_at: "2026-05-14T20:30:45Z",
  },
]

const stepsForWf001: WorkflowStep[] = [
  {
    id: "step-001-a",
    workflow_id: "wf-001-a3b8",
    agent_name: "planner",
    step_type: "thinking",
    input_data: { signal: "GitHub issue #1247 - Memory leak in worker pool" },
    output_data: {
      plan: "1. Research common Node.js memory leak patterns in worker pools. 2. Investigate connection pooling best practices. 3. Draft fix recommendation for Slack.",
    },
    tool_name: null,
    duration_ms: 1200,
    created_at: "2026-05-15T08:12:02Z",
  },
  {
    id: "step-001-b",
    workflow_id: "wf-001-a3b8",
    agent_name: "planner",
    step_type: "result",
    input_data: null,
    output_data: {
      research_queries: [
        "Node.js worker_threads memory leak connection pool",
        "connection.release() missing timeout handler Node.js",
        "OOM kill worker pool best practices",
      ],
      action_plan: "Send analysis with recommended fix to #engineering Slack",
    },
    tool_name: null,
    duration_ms: 800,
    created_at: "2026-05-15T08:12:04Z",
  },
  {
    id: "step-001-c",
    workflow_id: "wf-001-a3b8",
    agent_name: "researcher",
    step_type: "tool_call",
    input_data: { query: "Node.js worker_threads memory leak connection pool" },
    output_data: {
      results_count: 8,
      top_result: "Stack Overflow: Worker threads leaking memory when connections are not properly released in timeout handlers",
    },
    tool_name: "tavily_search",
    duration_ms: 2400,
    created_at: "2026-05-15T08:12:06Z",
  },
  {
    id: "step-001-d",
    workflow_id: "wf-001-a3b8",
    agent_name: "researcher",
    step_type: "tool_call",
    input_data: { query: "connection.release() missing timeout handler Node.js" },
    output_data: {
      results_count: 5,
      top_result: "GitHub issue: pg-pool connections not released on timeout causing pool exhaustion",
    },
    tool_name: "tavily_search",
    duration_ms: 1800,
    created_at: "2026-05-15T08:12:09Z",
  },
  {
    id: "step-001-e",
    workflow_id: "wf-001-a3b8",
    agent_name: "researcher",
    step_type: "result",
    input_data: null,
    output_data: {
      summary: "Root cause identified: connection.release() is not called in the timeout error handler of the worker pool. This causes connections to leak, eventually exhausting the pool and triggering OOM.",
      evidence: ["Stack Overflow thread on pg-pool leaks", "Node.js docs on worker cleanup", "GitHub issue in pg-pool repo"],
    },
    tool_name: null,
    duration_ms: 1500,
    created_at: "2026-05-15T08:12:12Z",
  },
  {
    id: "step-001-f",
    workflow_id: "wf-001-a3b8",
    agent_name: "action",
    step_type: "tool_call",
    input_data: { channel: "#engineering", message_preview: "Memory leak analysis for issue #1247..." },
    output_data: { status: "sent", channel: "#engineering", ts: "1715760778.000100" },
    tool_name: "send_slack",
    duration_ms: 900,
    created_at: "2026-05-15T08:12:55Z",
  },
  {
    id: "step-001-g",
    workflow_id: "wf-001-a3b8",
    agent_name: "action",
    step_type: "result",
    input_data: null,
    output_data: { confirmation: "Slack message delivered to #engineering with full analysis and recommended fix." },
    tool_name: null,
    duration_ms: 200,
    created_at: "2026-05-15T08:12:57Z",
  },
]

const stepsForWf002: WorkflowStep[] = [
  {
    id: "step-002-a",
    workflow_id: "wf-002-d7f2",
    agent_name: "planner",
    step_type: "thinking",
    input_data: { signal: "PagerDuty alert - High CPU on api-gateway-prod-3" },
    output_data: {
      plan: "1. Check recent deployments to api-gateway. 2. Research auto-scaling trigger failures. 3. Recommend immediate action.",
    },
    tool_name: null,
    duration_ms: 1100,
    created_at: "2026-05-15T09:30:17Z",
  },
  {
    id: "step-002-b",
    workflow_id: "wf-002-d7f2",
    agent_name: "planner",
    step_type: "result",
    input_data: null,
    output_data: {
      research_queries: [
        "AWS auto-scaling not triggering high CPU",
        "api-gateway CPU spike troubleshooting",
      ],
      action_plan: "Alert on-call engineer with findings via Slack",
    },
    tool_name: null,
    duration_ms: 700,
    created_at: "2026-05-15T09:30:19Z",
  },
  {
    id: "step-002-c",
    workflow_id: "wf-002-d7f2",
    agent_name: "researcher",
    step_type: "tool_call",
    input_data: { query: "AWS auto-scaling not triggering high CPU" },
    output_data: { results_count: 6, top_result: "AWS docs: Cooldown periods can prevent scaling actions" },
    tool_name: "tavily_search",
    duration_ms: 2100,
    created_at: "2026-05-15T09:30:22Z",
  },
]

const stepsForWf005: WorkflowStep[] = [
  {
    id: "step-005-a",
    workflow_id: "wf-005-c3d6",
    agent_name: "planner",
    step_type: "thinking",
    input_data: { signal: "GitHub issue #341 - CI pipeline failing on arm64 builds" },
    output_data: { plan: "Research Docker arm64 build failures with Node 22." },
    tool_name: null,
    duration_ms: 950,
    created_at: "2026-05-14T20:30:02Z",
  },
  {
    id: "step-005-b",
    workflow_id: "wf-005-c3d6",
    agent_name: "researcher",
    step_type: "tool_call",
    input_data: { query: "Docker arm64 build failure Node 22" },
    output_data: { error: "Rate limit exceeded. Retry after 60 seconds." },
    tool_name: "tavily_search",
    duration_ms: 500,
    created_at: "2026-05-14T20:30:04Z",
  },
]

export const mockStepsByWorkflow: Record<string, WorkflowStep[]> = {
  "wf-001-a3b8": stepsForWf001,
  "wf-002-d7f2": stepsForWf002,
  "wf-003-e1c4": [],
  "wf-004-b9a1": [],
  "wf-005-c3d6": stepsForWf005,
}

export const triggerScenarios: TriggerScenario[] = [
  {
    id: "github_issue",
    label: "GitHub Issue",
    description: "Simulate a critical GitHub issue being opened in your repo.",
    payload: {
      source: "github",
      event_type: "issue.opened",
      payload: {
        title: "Database connection pool exhaustion under load",
        description: "Production PostgreSQL pool hits max connections during peak traffic, causing 503 errors on /api/v1/users.",
        repo: "nexus-platform/core",
        issue_number: 1302,
        author: "ops-bot",
        labels: ["bug", "critical", "production"],
      },
    },
  },
  {
    id: "pagerduty_alert",
    label: "PagerDuty Alert",
    description: "Simulate a critical infrastructure alert from PagerDuty.",
    payload: {
      source: "pagerduty",
      event_type: "incident.triggered",
      payload: {
        title: "Latency spike on payment-service",
        description: "p99 latency exceeded 5000ms for payment-service. Customers reporting failed checkouts.",
        severity: "critical",
        service: "payment-service",
        urgency: "high",
      },
    },
  },
  {
    id: "custom_webhook",
    label: "Custom Webhook",
    description: "Write your own JSON payload to test the pipeline.",
    payload: {
      source: "manual",
      event_type: "custom",
      payload: {
        description: "Your custom signal here...",
      },
    },
  },
]
