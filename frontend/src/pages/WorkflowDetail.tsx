import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { WorkflowStatusBadge } from "@/components/workflow/WorkflowStatus"
import { TraceStep } from "@/components/trace/TraceStep"
import { LiveIndicator } from "@/components/trace/LiveIndicator"
import { useWorkflowDetail } from "@/lib/queries"

export function WorkflowDetail() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError } = useWorkflowDetail(id ?? "")

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">Workflow not found</p>
          <Link to="/dashboard" className="mt-2 inline-block text-sm text-primary hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const { workflow, steps } = data

  const title =
    (workflow.signal_payload?.title as string) ??
    (workflow.signal_payload?.description as string) ??
    workflow.id

  const duration =
    workflow.completed_at && workflow.created_at
      ? Math.round(
          (new Date(workflow.completed_at).getTime() - new Date(workflow.created_at).getTime()) / 1000
        )
      : null

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Back link */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Workflows
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mt-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="capitalize">{workflow.signal_type}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(workflow.created_at).toLocaleString()}
              </span>
              {duration !== null && (
                <>
                  <span className="text-border">·</span>
                  <span>{duration}s total</span>
                </>
              )}
              <span className="text-border">·</span>
              <span className="font-mono text-[10px]">{workflow.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {workflow.status === "running" && <LiveIndicator />}
            <WorkflowStatusBadge status={workflow.status} />
          </div>
        </div>
      </motion.div>

      {/* Result summary */}
      {workflow.result_summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-5 rounded-xl border border-border bg-card p-4"
        >
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Result
          </p>
          <p className="text-sm leading-relaxed text-card-foreground">{workflow.result_summary}</p>
        </motion.div>
      )}

      {/* Trace Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mt-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Agent Trace
          </h2>
          <span className="text-xs text-muted-foreground">{steps.length} steps</span>
        </div>

        {steps.length > 0 ? (
          <div className="relative">
            {steps.map((step, i) => (
              <TraceStep key={step.id} step={step} index={i} />
            ))}

            {/* Pipeline completed indicator */}
            {workflow.status === "completed" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: steps.length * 0.08 + 0.3 }}
                className="ml-2 flex items-center gap-3 pl-2"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-chart-1/10">
                  <CheckCircle2 className="h-3.5 w-3.5 text-chart-1" />
                </div>
                <span className="text-xs font-medium text-chart-1">Pipeline completed</span>
              </motion.div>
            )}

            {/* Running indicator */}
            {workflow.status === "running" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: steps.length * 0.08 + 0.3 }}
                className="ml-2 flex items-center gap-3 pl-2"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-chart-3/10">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-chart-3" />
                </div>
                <span className="text-xs text-muted-foreground">Agents working...</span>
              </motion.div>
            )}

            {/* Failed indicator */}
            {workflow.status === "failed" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: steps.length * 0.08 + 0.3 }}
                className="ml-2 flex items-center gap-3 pl-2"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/10">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                </div>
                <span className="text-xs text-destructive">Pipeline failed</span>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No trace steps recorded yet.</p>
          </div>
        )}
      </motion.div>

      {/* Raw payload */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="mt-8"
      >
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
          Signal Payload
        </h2>
        <pre className="overflow-x-auto rounded-xl border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          {JSON.stringify(workflow.signal_payload, null, 2)}
        </pre>
      </motion.div>
    </div>
  )
}
