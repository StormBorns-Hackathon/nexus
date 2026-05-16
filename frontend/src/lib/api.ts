import type { Workflow, WorkflowStep } from "@/types"

const backendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ?? ""
const API_BASE = `${backendUrl}/api`
export function apiUrl(path: string) {
  return `${backendUrl}${path.startsWith("/") ? path : `/${path}`}`
}

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

// ── Error class with actionable hints ──

export class ApiError extends Error {
  statusCode: number
  errorCode: string | null
  /** Suggested action the user should take, e.g. "link_github", "connect_slack" */
  action: string | null

  constructor(
    message: string,
    statusCode: number,
    errorCode: string | null = null,
    action: string | null = null,
  ) {
    super(message)
    this.name = "ApiError"
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.action = action
  }
}

/** Infer an actionable hint from the error response */
function inferAction(status: number, message: string): string | null {
  const lower = message.toLowerCase()
  if (
    lower.includes("github access token") ||
    lower.includes("sign in with github") ||
    lower.includes("link") && lower.includes("github") ||
    (status === 401 && lower.includes("github")) ||
    (status === 403 && lower.includes("github"))
  ) {
    return "link_github"
  }
  if (lower.includes("slack") && (lower.includes("connect") || lower.includes("not connected"))) {
    return "connect_slack"
  }
  return null
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
    let message = `Request failed: ${res.status}`
    if (typeof body.detail === "string") {
      message = body.detail
    } else if (Array.isArray(body.detail)) {
      message = body.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join(", ")
    }
    const action = inferAction(res.status, message)
    throw new ApiError(message, res.status, body.error_code ?? null, action)
  }
  return res.json()
}

// ── GitHub Account Linking ──

export async function linkGithubAccount(code: string): Promise<{ ok: boolean; user: Record<string, unknown> }> {
  return apiFetch("/auth/link-github", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}

export async function updateProfile(data: { name?: string; organization?: string; role?: string }): Promise<Record<string, unknown>> {
  return apiFetch("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  })
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
  workflowId: string
): Promise<WorkflowDetailResponse> {
  return apiFetch<WorkflowDetailResponse>(`/workflows/${workflowId}`)
}

export async function triggerWorkflow(
  githubUrl: string
): Promise<TriggerResponse> {
  return apiFetch<TriggerResponse>("/workflows/trigger", {
    method: "POST",
    body: JSON.stringify({ github_url: githubUrl }),
  })
}

export async function ingestWebhook(
  source: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<WebhookIngestResponse> {
  return apiFetch<WebhookIngestResponse>("/webhooks/ingest", {
    method: "POST",
    body: JSON.stringify({ source, event_type: eventType, payload }),
  })
}

// ── Slack Integration ──

export interface SlackInstallation {
  id: string
  team_id: string
  team_name: string
  default_channel_id?: string | null
  default_channel_name?: string | null
  installed_at?: string
}

export interface SlackStatus {
  connected: boolean
  // Legacy single-workspace fields
  team_name?: string
  team_id?: string
  default_channel_id?: string
  default_channel_name?: string
  installed_at?: string
  // Multi-workspace
  installations: SlackInstallation[]
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
}

export interface RepoChannelMapping {
  id: string
  installation_id: string | null
  workspace_name?: string
  repo_full_name: string
  channel_id: string
  channel_name: string
  created_at?: string
  webhook_registered?: boolean
  webhook_message?: string
}

export async function getSlackAuthUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>("/slack/auth-url")
}

export async function connectSlack(code: string, redirectUri: string): Promise<{ ok: boolean; team_name: string }> {
  return apiFetch("/slack/callback", {
    method: "POST",
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  })
}

export async function getSlackStatus(): Promise<SlackStatus> {
  return apiFetch<SlackStatus>("/slack/status")
}

export async function disconnectSlack(): Promise<{ ok: boolean }> {
  return apiFetch("/slack/disconnect", { method: "DELETE" })
}

export async function disconnectSlackInstallation(installationId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/slack/disconnect/${installationId}`, { method: "DELETE" })
}

export async function getSlackChannels(): Promise<{ channels: SlackChannel[] }> {
  return apiFetch("/slack/channels")
}

export async function getSlackChannelsForInstallation(installationId: string): Promise<{ channels: SlackChannel[] }> {
  return apiFetch(`/slack/channels/${installationId}`)
}

export async function getRepoMappings(): Promise<{ mappings: RepoChannelMapping[] }> {
  return apiFetch("/slack/mappings")
}

export async function addRepoMapping(
  installationId: string,
  repoFullName: string,
  channelId: string,
  channelName: string,
): Promise<RepoChannelMapping> {
  return apiFetch("/slack/mappings", {
    method: "POST",
    body: JSON.stringify({
      installation_id: installationId,
      repo_full_name: repoFullName,
      channel_id: channelId,
      channel_name: channelName,
    }),
  })
}

export async function deleteRepoMapping(mappingId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/slack/mappings/${mappingId}`, { method: "DELETE" })
}

export async function repairRepoWebhook(
  mappingId: string,
): Promise<{ ok: boolean; repo_full_name: string; github_webhook_id: number; message: string }> {
  return apiFetch(`/slack/mappings/${mappingId}/repair-webhook`, { method: "POST" })
}

export async function setDefaultChannel(
  installationId: string,
  channelId: string,
  channelName: string,
): Promise<{ ok: boolean }> {
  return apiFetch("/slack/default-channel", {
    method: "PUT",
    body: JSON.stringify({
      installation_id: installationId,
      channel_id: channelId,
      channel_name: channelName,
    }),
  })
}

// ── Custom Webhooks ──

export interface CustomWebhook {
  id: string
  name: string
  url: string
  has_secret: boolean
  is_active: boolean
  created_at: string | null
}

export async function getCustomWebhooks(): Promise<CustomWebhook[]> {
  return apiFetch<CustomWebhook[]>("/custom-webhooks")
}

export async function createCustomWebhook(data: {
  name: string
  url: string
  secret?: string
}): Promise<CustomWebhook> {
  return apiFetch<CustomWebhook>("/custom-webhooks", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateCustomWebhook(
  webhookId: string,
  data: { name?: string; url?: string; secret?: string; is_active?: boolean },
): Promise<CustomWebhook> {
  return apiFetch<CustomWebhook>(`/custom-webhooks/${webhookId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteCustomWebhook(webhookId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/custom-webhooks/${webhookId}`, { method: "DELETE" })
}

export async function testCustomWebhook(
  webhookId: string,
): Promise<{ ok: boolean; status_code?: number; response?: string; error?: string }> {
  return apiFetch(`/custom-webhooks/${webhookId}/test`, { method: "POST" })
}

// ── GitHub App Installation ──

export interface GitHubAppStatus {
  installed: boolean
  installation_id: number | null
}

export async function getGitHubAppStatus(): Promise<GitHubAppStatus> {
  return apiFetch<GitHubAppStatus>("/auth/github-app-status")
}

export async function saveGitHubAppInstallation(
  installationId: number,
): Promise<{ ok: boolean; github_app_installation_id: number }> {
  return apiFetch("/auth/github-app-installed", {
    method: "POST",
    body: JSON.stringify({ installation_id: installationId }),
  })
}
