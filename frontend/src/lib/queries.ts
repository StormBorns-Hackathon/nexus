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
  getRepoMappings,
  connectSlack,
  disconnectSlack,
  addRepoMapping,
  deleteRepoMapping,
  setDefaultChannel,
  type WorkflowListResponse,
  type WorkflowDetailResponse,
  type TriggerResponse,
  type WebhookIngestResponse,
  type SlackStatus,
  type SlackChannel,
  type RepoChannelMapping,
} from "./api"

// ──────────────── Query Keys ────────────────

export const queryKeys = {
  workflows: ["workflows"] as const,
  workflowDetail: (id: string) => ["workflows", id] as const,
  slackStatus: ["slack", "status"] as const,
  slackChannels: ["slack", "channels"] as const,
  repoMappings: ["slack", "mappings"] as const,
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

export function useAddMapping() {
  const queryClient = useQueryClient()
  return useMutation<RepoChannelMapping, Error, { repoFullName: string; channelId: string; channelName: string }>({
    mutationFn: ({ repoFullName, channelId, channelName }) => addRepoMapping(repoFullName, channelId, channelName),
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
  return useMutation<{ ok: boolean }, Error, { channelId: string; channelName: string }>({
    mutationFn: ({ channelId, channelName }) => setDefaultChannel(channelId, channelName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.slackStatus })
    },
  })
}
