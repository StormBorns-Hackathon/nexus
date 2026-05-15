import { useState } from "react"
import { motion } from "framer-motion"
import { BrainCircuit, Search, Zap, ChevronDown, ChevronRight, Wrench } from "lucide-react"
import type { WorkflowStep, AgentName, StepType } from "@/types"
import { cn } from "@/lib/utils"

const agentConfig: Record<AgentName, { icon: typeof BrainCircuit; label: string; colorClass: string; bgClass: string }> = {
  planner: {
    icon: BrainCircuit,
    label: "Planner",
    colorClass: "text-chart-4",
    bgClass: "bg-chart-4/10",
  },
  researcher: {
    icon: Search,
    label: "Researcher",
    colorClass: "text-chart-3",
    bgClass: "bg-chart-3/10",
  },
  action: {
    icon: Zap,
    label: "Action",
    colorClass: "text-chart-2",
    bgClass: "bg-chart-2/10",
  },
}

const stepTypeLabels: Record<StepType, string> = {
  thinking: "Thinking",
  tool_call: "Tool Call",
  result: "Result",
}

function getStepMessage(step: WorkflowStep): string | null {
  const output = step.output_data
  if (!output) return null
  if (typeof output.message === "string") return output.message
  if (typeof output.action_result === "string") return output.action_result
  if (typeof output.message_preview === "string") return output.message_preview
  if (typeof output.action_plan === "string") return output.action_plan
  if (typeof output.summary_length === "number") {
    return `Research summary ready (${output.summary_length} characters)`
  }
  return null
}

export function TraceStep({ step, index }: { step: WorkflowStep; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const agent = agentConfig[step.agent_name]
  const AgentIcon = agent.icon
  const message = getStepMessage(step)

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
      className="relative flex gap-3 pb-4"
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", agent.bgClass)}>
          {step.step_type === "tool_call" ? (
            <Wrench className={cn("h-3.5 w-3.5", agent.colorClass)} />
          ) : (
            <AgentIcon className={cn("h-3.5 w-3.5", agent.colorClass)} />
          )}
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 text-left"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", agent.colorClass)}>
                {agent.label}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {stepTypeLabels[step.step_type]}
              </span>
              {step.tool_name && (
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
                  {step.tool_name}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              {message ?? (step.duration_ms !== null ? `${step.duration_ms}ms` : "In progress")}
            </p>
          </div>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>

        {/* Expanded detail */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
            className="mt-3 space-y-3"
          >
            {step.input_data && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Input
                </p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(step.input_data, null, 2)}
                </pre>
              </div>
            )}
            {step.output_data && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Output
                </p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(step.output_data, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
