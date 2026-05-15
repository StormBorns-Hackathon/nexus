import type { Workflow, WorkflowStep } from "@/types"


const API_BASE = "/api"

function getToken(): string | null {
  return localStorage.getItem("nexus_token")
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}


export interface WorkflowListResponse {
  workflows: Workflow[]
}

export interface WorkflowDetailResponse {
  workflow: Workflow
  steps: WorkflowStep[]
}

export interface TriggerResponse {
  workflow_id: string
  status: string
}

export interface WebhookIngestResponse {
  workflow_id: string
  status: string
  trace_url: string
}


export async function fetchWorkflows(): Promise<WorkflowListResponse> {
  return apiFetch<WorkflowListResponse>("/workflows")
}

export async function fetchWorkflowDetail(
  workflowId: string,
): Promise<WorkflowDetailResponse> {
  return apiFetch<WorkflowDetailResponse>(`/workflows/${workflowId}`)
}

export async function triggerWorkflow(
  githubUrl: string,
): Promise<TriggerResponse> {
  return apiFetch<TriggerResponse>("/workflows/trigger", {
    method: "POST",
    body: JSON.stringify({ github_url: githubUrl }),
  })
}

export async function ingestWebhook(
  source: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<WebhookIngestResponse> {
  return apiFetch<WebhookIngestResponse>("/webhooks/ingest", {
    method: "POST",
    body: JSON.stringify({ source, event_type: eventType, payload }),
  })
}
