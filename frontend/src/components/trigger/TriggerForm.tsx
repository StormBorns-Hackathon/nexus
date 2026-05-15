import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { GitCommitHorizontal, Send, CheckCircle, Loader2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTriggerWorkflow } from "@/lib/queries"

const COMMIT_URL_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/commit\/[a-f0-9]+/i

export function TriggerForm() {
  const [commitUrl, setCommitUrl] = useState("")
  const navigate = useNavigate()
  const triggerMutation = useTriggerWorkflow()

  const isValidUrl = COMMIT_URL_REGEX.test(commitUrl.trim())

  function handleTrigger() {
    if (!isValidUrl) return

    triggerMutation.mutate(
      { commitUrl: commitUrl.trim() },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            navigate(`/workflow/${data.workflow_id}`)
          }, 1200)
        },
      },
    )
  }

  const isSubmitted = triggerMutation.isSuccess
  const isLoading = triggerMutation.isPending

  return (
    <div className="space-y-6">
      {/* URL Input */}
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <GitCommitHorizontal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-card-foreground">GitHub Commit URL</h3>
              <p className="text-xs text-muted-foreground">
                Paste a public GitHub commit URL to analyze it with the agent pipeline.
              </p>
            </div>
          </div>

          <div className="relative">
            <Input
              type="url"
              placeholder="https://github.com/owner/repo/commit/abc123..."
              value={commitUrl}
              onChange={(e) => {
                setCommitUrl(e.target.value)
                if (triggerMutation.isError) triggerMutation.reset()
              }}
              className={cn(
                "pr-10 font-mono text-xs",
                commitUrl && !isValidUrl && "border-destructive/50 focus:border-destructive",
                commitUrl && isValidUrl && "border-chart-1/50 focus:border-chart-1",
              )}
            />
            {commitUrl && isValidUrl && (
              <CheckCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-chart-1" />
            )}
          </div>

          {commitUrl && !isValidUrl && (
            <p className="mt-2 text-xs text-destructive/80">
              Enter a valid GitHub commit URL (e.g. https://github.com/owner/repo/commit/sha)
            </p>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-border bg-card/50">
        <CardContent className="p-5">
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            What happens next
          </p>
          <div className="space-y-2.5">
            {[
              "Fetch commit details, changed files, and stats from GitHub",
              "Planner agent analyzes the commit and creates an action plan",
              "Researcher agent gathers context about the changes",
              "Action agent delivers a summary to your configured Slack channel",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {triggerMutation.isError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {triggerMutation.error.message}
        </motion.div>
      )}

      {/* Trigger Button */}
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={handleTrigger}
          disabled={!isValidUrl || isLoading || isSubmitted}
          className={cn(
            "h-11 px-6 text-sm transition-all",
            isSubmitted ? "bg-chart-1 text-chart-1" : "",
          )}
        >
          {isSubmitted ? (
            <>
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Workflow Created!
            </>
          ) : isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Analyzing commit…
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-4 w-4" />
              Run Pipeline
            </>
          )}
        </Button>
        {isSubmitted && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xs text-chart-1"
          >
            Redirecting to trace view…
          </motion.span>
        )}
      </div>
    </div>
  )
}
