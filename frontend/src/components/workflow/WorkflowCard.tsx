import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Clock } from "lucide-react"
import { WorkflowStatusBadge } from "@/components/workflow/WorkflowStatus"
import type { Workflow } from "@/types"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function WorkflowCard({
  workflow,
  index,
}: {
  workflow: Workflow
  index: number
}) {
  const title =
    (workflow.signal_payload?.title as string) ??
    (workflow.signal_payload?.description as string) ??
    workflow.id

  const duration =
    workflow.completed_at && workflow.created_at
      ? Math.round(
          (new Date(workflow.completed_at).getTime() -
            new Date(workflow.created_at).getTime()) /
            1000
        )
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
    >
      <Link to={`/workflow/${workflow.id}`}>
        <div className="group rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-card-foreground group-hover:text-accent-foreground">
                {title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{workflow.signal_type}</span>
                <span className="text-border">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(workflow.created_at)}
                </span>
                {duration !== null && (
                  <>
                    <span className="text-border">·</span>
                    <span>{duration}s</span>
                  </>
                )}
                <span className="text-border">·</span>
                <span className="font-mono text-[10px]">
                  {workflow.id}
                </span>
              </div>
              {workflow.result_summary && (
                <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                  {workflow.result_summary}
                </p>
              )}
            </div>
            <WorkflowStatusBadge status={workflow.status} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
