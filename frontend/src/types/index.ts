export type WorkflowStatus = "pending" | "running" | "completed" | "failed"

export type AgentName = "planner" | "researcher" | "action"

export type StepType = "thinking" | "tool_call" | "result"

export interface Workflow {
  id: string
  signal_type: string
  signal_payload: Record<string, unknown>
  status: WorkflowStatus
  result_summary: string | null
  created_at: string
  completed_at: string | null
}

export interface WorkflowStep {
  id: string
  workflow_id: string
  agent_name: AgentName
  step_type: StepType
  input_data: Record<string, unknown> | null
  output_data: Record<string, unknown> | null
  tool_name: string | null
  duration_ms: number
  created_at: string
}

export interface TriggerScenario {
  id: string
  label: string
  description: string
  payload: Record<string, unknown>
}
