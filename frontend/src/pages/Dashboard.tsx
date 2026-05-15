import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Search, Filter, Loader2, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkflowCard } from "@/components/workflow/WorkflowCard"
import { useWorkflows } from "@/lib/queries"
import type { WorkflowStatus } from "@/types"
import { cn } from "@/lib/utils"

const filters: { label: string; value: WorkflowStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
]

export function Dashboard() {
  const [activeFilter, setActiveFilter] = useState<WorkflowStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const { data, isLoading } = useWorkflows()

  const workflows = data?.workflows ?? []

  const filtered = workflows.filter((wf) => {
    if (activeFilter !== "all" && wf.status !== activeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const title = ((wf.signal_payload?.title as string) ?? "").toLowerCase()
      const desc = ((wf.signal_payload?.description as string) ?? "").toLowerCase()
      return title.includes(q) || desc.includes(q) || wf.signal_type.includes(q)
    }
    return true
  })

  const counts = {
    all: workflows.length,
    running: workflows.filter((w) => w.status === "running").length,
    completed: workflows.filter((w) => w.status === "completed").length,
    failed: workflows.filter((w) => w.status === "failed").length,
  }

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Workflows</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor and inspect autonomous agent pipeline runs.
        </p>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { label: "Total", value: counts.all, colorClass: "text-foreground" },
          { label: "Running", value: counts.running, colorClass: "text-chart-3" },
          { label: "Completed", value: counts.completed, colorClass: "text-chart-1" },
          { label: "Failed", value: counts.failed, colorClass: "text-destructive" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={cn("mt-1 font-heading text-2xl font-bold", stat.colorClass)}>
              {isLoading ? "—" : stat.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-1.5">
          <Filter className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={activeFilter === f.value ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setActiveFilter(f.value)}
              className={cn(
                "text-xs",
                activeFilter === f.value && "text-secondary-foreground"
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none sm:w-64"
          />
        </div>
      </motion.div>

      {/* Workflow List */}
      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((wf, i) => (
            <WorkflowCard key={wf.id} workflow={wf} index={i} />
          ))
        ) : workflows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Radio className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-4 font-heading text-base font-semibold text-foreground">
              No workflows yet
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Trigger your first webhook to start an autonomous agent pipeline run.
            </p>
            <Link to="/trigger">
              <Button className="mt-5 gap-2" >
                {/* <Send className="h-3.5 w-3.5" /> */}
                Create your first workflow
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No workflows match your filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}
