import { Badge } from "@/components/ui/badge"
import type { WorkflowStatus } from "@/types"
import { cn } from "@/lib/utils"

const statusConfig: Record<
  WorkflowStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  pending: {
    label: "Pending",
    dotClass: "bg-muted-foreground",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
  running: {
    label: "Running",
    dotClass: "bg-chart-3 animate-pulse",
    badgeClass: "border-chart-3/30 bg-chart-3/10 text-chart-3",
  },
  completed: {
    label: "Completed",
    dotClass: "bg-chart-1",
    badgeClass: "border-chart-1/30 bg-chart-1/10 text-chart-1",
  },
  failed: {
    label: "Failed",
    dotClass: "bg-destructive",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
}

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const config = statusConfig[status]

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border px-2.5 py-0.5 text-[11px]", config.badgeClass)}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      {config.label}
    </Badge>
  )
}
