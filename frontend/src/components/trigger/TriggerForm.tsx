import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import {
  GitPullRequestArrow,
  CheckCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  GitBranch,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTriggerWorkflow } from "@/lib/queries"
import { useAuth, getGithubLinkURL } from "@/lib/auth-context"
import { ApiError } from "@/lib/api"

const GITHUB_URL_REGEX = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/(pull|issues)\/\d+/i

/** Build actionable error UI from an ApiError */
function ErrorDisplay({ error }: { error: Error }) {
  const isApiError = error instanceof ApiError
  const action = isApiError ? (error as ApiError).action : null
  const statusCode = isApiError ? (error as ApiError).statusCode : null

  // Determine help text and CTA based on the error
  let helpText: string | null = null
  let ctaLabel: string | null = null
  let ctaHref: string | null = null

  if (action === "link_github") {
    helpText = "Your Nexus account doesn't have a GitHub access token. Link your GitHub account to fix this."
    ctaLabel = "Link GitHub Account"
    ctaHref = getGithubLinkURL()
  } else if (action === "connect_slack") {
    helpText = "Connect your Slack workspace to receive notifications."
    ctaLabel = "Go to Integrations"
    ctaHref = "/integrations"
  } else if (statusCode === 404 || error.message.toLowerCase().includes("not found")) {
    helpText = "Make sure the repository and PR/issue number exist, and that your GitHub account has access to the repo."
  } else if (statusCode === 400 && error.message.toLowerCase().includes("invalid github url")) {
    helpText = "The URL format should be: https://github.com/owner/repo/pull/123 or https://github.com/owner/repo/issues/456"
  } else if (!navigator.onLine) {
    helpText = "You appear to be offline. Check your internet connection and try again."
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2.5"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-destructive">{error.message}</p>
          {helpText && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{helpText}</p>
          )}
        </div>
      </div>
      {ctaHref && ctaLabel && (
        <div className="pl-6">
          {ctaHref.startsWith("http") ? (
            <a href={ctaHref}>
              <Button size="xs" variant="outline" className="gap-1.5 text-[11px] border-destructive/20 text-destructive hover:text-destructive">
                {ctaLabel} <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          ) : (
            <Link to={ctaHref}>
              <Button size="xs" variant="outline" className="gap-1.5 text-[11px] border-destructive/20 text-destructive hover:text-destructive">
                {ctaLabel} <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      )}
    </motion.div>
  )
}

export function TriggerForm() {
  const [githubUrl, setGithubUrl] = useState("")
  const navigate = useNavigate()
  const triggerMutation = useTriggerWorkflow()
  const { hasGithub } = useAuth()

  const isValidUrl = GITHUB_URL_REGEX.test(githubUrl.trim())
  const urlType = githubUrl.includes("/pull/") ? "Pull Request" : githubUrl.includes("/issues/") ? "Issue" : null

  function handleTrigger() {
    if (!isValidUrl) return

    triggerMutation.mutate(
      { githubUrl: githubUrl.trim() },
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
      {/* GitHub not linked warning */}
      {!hasGithub && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-chart-3/30 bg-chart-3/5 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-3/10 shrink-0">
              <GitBranch className="h-4 w-4 text-chart-3" />
            </div>
            <div className="space-y-1.5 flex-1">
              <p className="text-xs font-semibold text-foreground">
                GitHub account not linked
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                You signed in with email. To analyze <strong>private repositories</strong>, link your GitHub account.
                Public repos can be analyzed without linking, but may be rate-limited.
              </p>
              <a href={getGithubLinkURL()}>
                <Button size="xs" className="gap-1.5 text-[11px] mt-1">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Link GitHub Account
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* URL Input */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GitPullRequestArrow className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="font-heading text-base font-semibold text-card-foreground">GitHub PR or Issue URL</CardTitle>
              <p className="text-xs text-muted-foreground">
                Paste a GitHub pull request or issue URL to analyze it with the agent pipeline.
              </p>
            </div>
          </div>
          {/* GitHub status indicator */}
          {hasGithub ? (
            <span className="flex items-center gap-1.5 rounded-full bg-chart-1/10 px-2.5 py-1 text-[10px] font-medium text-chart-1 shrink-0">
              <CheckCircle className="h-3 w-3" />
              GitHub linked
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-chart-3/10 px-2.5 py-1 text-[10px] font-medium text-chart-3 shrink-0">
              <AlertTriangle className="h-3 w-3" />
              Public only
            </span>
          )}
        </CardHeader>

        <CardContent>
          <div className="relative">
            <Input
              type="url"
              placeholder="https://github.com/owner/repo/pull/123 or /issues/456"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value)
                if (triggerMutation.isError) triggerMutation.reset()
              }}
              className={cn(
                "pr-10 font-mono text-xs",
                githubUrl && !isValidUrl && "border-destructive/50 focus:border-destructive",
                githubUrl && isValidUrl && "border-chart-1/50 focus:border-chart-1",
              )}
            />
            {githubUrl && isValidUrl && (
              <CheckCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-chart-1" />
            )}
          </div>

          {githubUrl && !isValidUrl && (
            <p className="mt-2 text-xs text-destructive/80">
              Enter a valid GitHub PR or Issue URL (e.g. https://github.com/owner/repo/pull/123)
            </p>
          )}

          {githubUrl && isValidUrl && urlType && (
            <p className="mt-2 text-xs text-chart-1/80">
              Detected: <span className="font-medium">{urlType}</span>
            </p>
          )}

          {/* Trigger Button */}
          <div className="flex items-center gap-4 mt-8">
            <Button
              size="lg"
              onClick={handleTrigger}
              disabled={!isValidUrl || isLoading || isSubmitted}
              className={cn(
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
                  Fetching from GitHub…
                </>
              ) : (
                <>
                  Trigger Pipeline
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

        </CardContent>
      </Card>

      {/* Enhanced error display */}
      {triggerMutation.isError && (
        <ErrorDisplay error={triggerMutation.error} />
      )}

      {/* How it works */}
      <Card className="border-border bg-card/50">
        <CardContent className="">
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            What happens next
          </p>
          <div className="space-y-2.5">
            {[
              "Fetch PR/Issue details, description, and labels from GitHub",
              "Planner agent analyzes the context and creates an action plan",
              "Researcher agent gathers additional context about the topic",
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
    </div>
  )
}
