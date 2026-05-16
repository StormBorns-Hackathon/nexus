import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query"
import {
  fetchWorkflows,
  fetchWorkflowDetail,
  triggerWorkflow,
  ingestWebhook,
  getSlackStatus,
  getSlackChannels,
  getSlackChannelsForInstallation,
  getRepoMappings,
  connectSlack,
  disconnectSlack,
  disconnectSlackInstallation,
  addRepoMapping,
  deleteRepoMapping,
  repairRepoWebhook,
  setDefaultChannel,
  getCustomWebhooks,
  createCustomWebhook,
  updateCustomWebhook,
  deleteCustomWebhook,
  testCustomWebhook,
  getGitHubAppStatus,
  saveGitHubAppInstallation,
  type WorkflowListResponse,
  type WorkflowDetailResponse,
  type TriggerResponse,
  type WebhookIngestResponse,
  type SlackStatus,
  type SlackChannel,
  type RepoChannelMapping,
  type CustomWebhook,
  type GitHubAppStatus,
} from "./api"

// ──────────────── Query Keys ────────────────

export const queryKeys = {
  workflows: ["workflows"] as const,
  workflowDetail: (id: string) => ["workflows", id] as const,
  slackStatus: ["slack", "status"] as const,
  slackChannels: ["slack", "channels"] as const,
  slackChannelsForInstallation: (id: string) => ["slack", "channels", id] as const,
  repoMappings: ["slack", "mappings"] as const,
  customWebhooks: ["custom-webhooks"] as const,
  githubAppStatus: ["github-app", "status"] as const,
}

// ──────────────── Queries ────────────────

export function useWorkflows(
  options?: Partial<UseQueryOptions<WorkflowListResponse>>,
) {
  return useQuery<WorkflowListResponse>({
    queryKey: queryKeys.workflows,
    queryFn: fetchWorkflows,
    refetchInterval: 5000, // poll every 5s to catch running workflow updates
    ...options,
  })
}

export function useWorkflowDetail(
  workflowId: string,
  options?: Partial<UseQueryOptions<WorkflowDetailResponse>>,
) {
  return useQuery<WorkflowDetailResponse>({
    queryKey: queryKeys.workflowDetail(workflowId),
    queryFn: () => fetchWorkflowDetail(workflowId),
    enabled: !!workflowId,
    refetchInterval: (query) => {
      // Poll faster while workflow is running
      const status = query.state.data?.workflow.status
      return status === "running" || status === "pending" ? 2000 : false
    },
    ...options,
  })
}

// ──────────────── Mutations ────────────────

export function useTriggerWorkflow() {
  const queryClient = useQueryClient()

  return useMutation<TriggerResponse, Error, { githubUrl: string }>({
    mutationFn: ({ githubUrl }) => triggerWorkflow(githubUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows })
    },
  })
}

export function useIngestWebhook() {
  const queryClient = useQueryClient()

  return useMutation<
    WebhookIngestResponse,
    Error,
    { source: string; eventType: string; payload: Record<string, unknown> }
  >({
    mutationFn: ({ source, eventType, payload }) =>
      ingestWebhook(source, eventType, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows })
    },
  })
}

// ──────────────── Slack Queries ────────────────

export function useSlackStatus() {
  return useQuery<SlackStatus>({
    queryKey: queryKeys.slackStatus,
    queryFn: getSlackStatus,
  })
}

export function useSlackChannels(enabled = true) {
  return useQuery<{ channels: SlackChannel[] }>({
    queryKey: queryKeys.slackChannels,
    queryFn: getSlackChannels,
    enabled,
  })
}

export function useSlackChannelsForInstallation(installationId: string, enabled = true) {
  return useQuery<{ channels: SlackChannel[] }>({
    queryKey: queryKeys.slackChannelsForInstallation(installationId),
    queryFn: () => getSlackChannelsForInstallation(installationId),
    enabled: enabled && !!installationId,
  })
}

export function useRepoMappings() {
  return useQuery<{ mappings: RepoChannelMapping[] }>({
    queryKey: queryKeys.repoMappings,
    queryFn: getRepoMappings,
  })
}

// ──────────────── Slack Mutations ────────────────

export function useConnectSlack() {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean; team_name: string }, Error, { code: string; redirectUri: string }>({
    mutationFn: ({ code, redirectUri }) => connectSlack(code, redirectUri),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slackStatus })
    },
  })
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slackStatus })
      queryClient.invalidateQueries({ queryKey: queryKeys.repoMappings })
    },
  })
}

export function useDisconnectSlackInstallation() {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (installationId) => disconnectSlackInstallation(installationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slackStatus })
      queryClient.invalidateQueries({ queryKey: queryKeys.repoMappings })
    },
  })
}

export function useAddMapping() {
  const queryClient = useQueryClient()
  return useMutation<
    RepoChannelMapping,
    Error,
    { installationId: string; repoFullName: string; channelId: string; channelName: string }
  >({
    mutationFn: ({ installationId, repoFullName, channelId, channelName }) =>
      addRepoMapping(installationId, repoFullName, channelId, channelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoMappings })
    },
  })
}

export function useDeleteMapping() {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (mappingId) => deleteRepoMapping(mappingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoMappings })
    },
  })
}

export function useSetDefaultChannel() {
  const queryClient = useQueryClient()
  return useMutation<
    { ok: boolean },
    Error,
    { installationId: string; channelId: string; channelName: string }
  >({
    mutationFn: ({ installationId, channelId, channelName }) =>
      setDefaultChannel(installationId, channelId, channelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slackStatus })
    },
  })
}

export function useRepairWebhook() {
  const queryClient = useQueryClient()
  return useMutation<
    { ok: boolean; repo_full_name: string; github_webhook_id: number; message: string },
    Error,
    string
  >({
    mutationFn: (mappingId) => repairRepoWebhook(mappingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.repoMappings })
    },
  })
}

// ──────────────── Custom Webhooks ────────────────

export function useCustomWebhooks() {
  return useQuery<CustomWebhook[]>({
    queryKey: queryKeys.customWebhooks,
    queryFn: getCustomWebhooks,
  })
}

export function useCreateCustomWebhook() {
  const queryClient = useQueryClient()
  return useMutation<
    CustomWebhook,
    Error,
    { name: string; url: string; secret?: string }
  >({
    mutationFn: (data) => createCustomWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customWebhooks })
    },
  })
}

export function useDeleteCustomWebhook() {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => deleteCustomWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customWebhooks })
    },
  })
}

export function useToggleCustomWebhook() {
  const queryClient = useQueryClient()
  return useMutation<
    CustomWebhook,
    Error,
    { id: string; is_active: boolean }
  >({
    mutationFn: ({ id, is_active }) => updateCustomWebhook(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customWebhooks })
    },
  })
}

export function useTestCustomWebhook() {
  return useMutation<
    { ok: boolean; status_code?: number; response?: string; error?: string },
    Error,
    string
  >({
    mutationFn: (id) => testCustomWebhook(id),
  })
}

// ──────────────── GitHub App Status ────────────────

export function useGitHubAppStatus() {
  return useQuery<GitHubAppStatus>({
    queryKey: queryKeys.githubAppStatus,
    queryFn: getGitHubAppStatus,
  })
}

export function useSaveGitHubAppInstallation() {
  const queryClient = useQueryClient()
  return useMutation<
    { ok: boolean; github_app_installation_id: number },
    Error,
    number
  >({
    mutationFn: (installationId) => saveGitHubAppInstallation(installationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.githubAppStatus })
    },
  })
}
