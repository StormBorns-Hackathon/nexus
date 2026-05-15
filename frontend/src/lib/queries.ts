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
  type WorkflowListResponse,
  type WorkflowDetailResponse,
  type TriggerResponse,
  type WebhookIngestResponse,
} from "./api"

// ──────────────── Query Keys ────────────────

export const queryKeys = {
  workflows: ["workflows"] as const,
  workflowDetail: (id: string) => ["workflows", id] as const,
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

  return useMutation<TriggerResponse, Error, { commitUrl: string }>({
    mutationFn: ({ commitUrl }) => triggerWorkflow(commitUrl),
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
