import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Hash,
  GitBranch,
  Building2,
  Zap,
  ChevronDown,
  Webhook,
  AlertTriangle,
} from "lucide-react"
import {
  useSlackStatus,
  useSlackChannelsForInstallation,
  useRepoMappings,
  useDisconnectSlackInstallation,
  useAddMapping,
  useDeleteMapping,
  useSetDefaultChannel,
  useCustomWebhooks,
  useCreateCustomWebhook,
  useDeleteCustomWebhook,
  useToggleCustomWebhook,
  useTestCustomWebhook,
} from "@/lib/queries"
import { getSlackAuthUrl } from "@/lib/api"
import type { SlackInstallation } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuth, getGithubLinkURL } from "@/lib/auth-context"

export function IntegrationsPage() {
  const { user, hasGithub } = useAuth()
  const slackStatus = useSlackStatus()
  const isConnected = slackStatus.data?.connected ?? false
  const installations = slackStatus.data?.installations ?? []
  const mappings = useRepoMappings()
  const disconnectMutation = useDisconnectSlackInstallation()
  const addMappingMutation = useAddMapping()
  const deleteMappingMutation = useDeleteMapping()
  const setDefaultMutation = useSetDefaultChannel()

  // GitHub App installation state
  const [searchParams, setSearchParams] = useSearchParams()
  const [ghAppInstalled, setGhAppInstalled] = useState(() =>
    localStorage.getItem("nexus_github_app_installed") === "true"
  )

  useEffect(() => {
    const installationId = searchParams.get("installation_id")
    if (installationId) {
      localStorage.setItem("nexus_github_app_installed", "true")
      setGhAppInstalled(true)
      // Clean up the query params from the URL
      searchParams.delete("installation_id")
      searchParams.delete("setup_action")
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const [newRepo, setNewRepo] = useState("")
  const [selectedInstallation, setSelectedInstallation] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("")

  // Custom webhooks
  const customWebhooks = useCustomWebhooks()
  const createWebhookMutation = useCreateCustomWebhook()
  const deleteWebhookMutation = useDeleteCustomWebhook()
  const toggleWebhookMutation = useToggleCustomWebhook()
  const testWebhookMutation = useTestCustomWebhook()
  const [showWebhookForm, setShowWebhookForm] = useState(false)
  const [webhookName, setWebhookName] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [testResult, setTestResult] = useState<{
    id: string
    ok: boolean
    status_code?: number
    error?: string
  } | null>(null)

  // Fetch channels for the selected installation in the mapping form
  const channelsQuery = useSlackChannelsForInstallation(
    selectedInstallation,
    !!selectedInstallation,
  )

  async function handleConnectSlack() {
    try {
      const { url } = await getSlackAuthUrl()
      const redirectUri = `${window.location.origin}/integrations/slack/callback`
      window.location.href = `${url}&redirect_uri=${encodeURIComponent(redirectUri)}`
    } catch (e) {
      console.error("Failed to get Slack auth URL", e)
    }
  }

  function handleAddMapping() {
    if (!newRepo.trim() || !selectedChannel || !selectedInstallation) return
    const channel = channelsQuery.data?.channels.find((c) => c.id === selectedChannel)
    if (!channel) return

    addMappingMutation.mutate(
      {
        installationId: selectedInstallation,
        repoFullName: newRepo.trim(),
        channelId: channel.id,
        channelName: channel.name,
      },
      {
        onSuccess: () => {
          setNewRepo("")
          setSelectedChannel("")
        },
      },
    )
  }

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Integrations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect services to receive automated PR alerts and notifications.
        </p>
      </motion.div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 max-w-5xl">
        {/* Slack Workspaces Card — full width */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="md:col-span-2"
        >
          <Card className="border-border bg-card hover:shadow-md hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="oklch(0.473 0.137 46.201)">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.52 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.52v-2.522h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.52 2.521h-6.313z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                    Slack Workspaces
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Connect one or more Slack workspaces to receive PR alerts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {slackStatus.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : isConnected ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-chart-1/10 px-2.5 py-1 text-xs font-medium text-chart-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {installations.length} connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    <XCircle className="h-3 w-3" />
                    Not connected
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {installations.map((inst: SlackInstallation) => (
                <WorkspaceRow
                  key={inst.id}
                  installation={inst}
                  onDisconnect={() => disconnectMutation.mutate(inst.id)}
                  onSetDefault={(channelId, channelName) =>
                    setDefaultMutation.mutate({
                      installationId: inst.id,
                      channelId,
                      channelName,
                    })
                  }
                  isDisconnecting={disconnectMutation.isPending}
                  isSettingDefault={setDefaultMutation.isPending}
                />
              ))}

              <Button
                onClick={handleConnectSlack}
                variant={isConnected ? "outline" : "default"}
                className="gap-2"
                size="sm"
              >
                {isConnected ? "Connect Another Workspace" : "Connect Slack"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* GitHub Account — OAuth Linking */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
        >
          <Card className={cn("border-border bg-card h-full hover:shadow-md hover:shadow-primary/5 transition-shadow duration-300", !hasGithub && "border-chart-3/30")}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  hasGithub ? "bg-chart-1/10" : "bg-primary/10"
                )}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="oklch(0.473 0.137 46.201)">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                    GitHub Account
                  </CardTitle>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    Link your GitHub to analyze private repos.
                  </p>
                </div>
              </div>

              {hasGithub ? (
                <span className="flex items-center gap-1.5 rounded-full bg-chart-1/10 px-2.5 py-1 text-xs font-medium text-chart-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-chart-3/10 px-2.5 py-1 text-xs font-medium text-chart-3">
                  <AlertTriangle className="h-3 w-3" />
                  Not linked
                </span>
              )}
            </CardHeader>

            <CardContent>
              {hasGithub ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    {/* <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg> */}
                    <div>
                      <p className="text-sm font-medium text-foreground">@{user?.github_username || user?.github_id}</p>
                      <p className="text-[10px] text-muted-foreground">GitHub account linked</p>
                    </div>
                  </div>
                  <a href={getGithubLinkURL()}>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      Re-link GitHub Account
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-chart-3/20 bg-chart-3/5 px-3 py-2.5">
                    <p className="text-xs text-chart-3 font-medium">⚠ GitHub account not linked</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      You signed in with email. Link your GitHub account to analyze private repositories and avoid API rate limits. Without linking, only public repos can be analyzed.
                    </p>
                  </div>
                  <a href={getGithubLinkURL()}>
                    <Button className="gap-2" size="sm">
                      {/* <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg> */}
                      Link GitHub Account
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* GitHub App */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.07 }}
        >
          <Card className="border-border bg-card h-full hover:shadow-md hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  ghAppInstalled ? "bg-chart-1/10" : "bg-primary/10"
                )}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="oklch(0.473 0.137 46.201)">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                    GitHub App
                  </CardTitle>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    Install on repos for automatic PR workflows.
                  </p>
                </div>
              </div>
              {ghAppInstalled && (
                <span className="flex items-center gap-1.5 rounded-full bg-chart-1/10 px-2.5 py-1 text-xs font-medium text-chart-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Installed
                </span>
              )}
            </CardHeader>
            <CardContent>
              {ghAppInstalled ? (
                <div className="space-y-3">
                  <p className="text-xs text-chart-1/80">
                    The Nexus GitHub App is installed. PRs on connected repos will automatically trigger workflows.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                    onClick={() => {
                      const slug = import.meta.env.VITE_GITHUB_APP_SLUG
                      if (slug) {
                        window.open(`https://github.com/apps/${slug}/installations/new`, "_blank")
                      }
                    }}
                  >
                    Manage or add repos
                  </Button>
                </div>
              ) : (
                <div className="space-y-[8%]">
                  <p className="text-xs text-muted-foreground">
                    Installing the app grants Nexus read-only access to pull requests on selected repos. When a PR is opened, Nexus automatically runs the agent pipeline and sends alerts to your mapped Slack channels.
                  </p>
                  <Button
                    className="gap-2"
                    size="sm"
                    onClick={() => {
                      const slug = import.meta.env.VITE_GITHUB_APP_SLUG
                      if (slug) {
                        window.location.href = `https://github.com/apps/${slug}/installations/new`
                      }
                    }}
                  >
                    Install GitHub App
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Custom Webhooks — full width */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.09 }}
          className="md:col-span-2"
        >
          <Card className="border-border bg-card hover:shadow-md hover:shadow-primary/5 transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Webhook className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                    Custom Webhooks
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Send pipeline results to any URL — Discord, Teams, PagerDuty, or your own API.
                  </p>
                </div>
              </div>
              {customWebhooks.data && customWebhooks.data.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-[hsl(270,60%,25%)]/15 px-2.5 py-1 text-xs font-medium text-[hsl(270,60%,70%)]">
                  {customWebhooks.data.filter((w) => w.is_active).length} active
                </span>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Existing webhooks */}
              {customWebhooks.data?.map((wh) => (
                <div
                  key={wh.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors",
                    wh.is_active
                      ? "border-border bg-muted/20"
                      : "border-border/50 bg-muted/5 opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        wh.is_active ? "bg-chart-1" : "bg-muted-foreground",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{wh.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[300px]">
                        {wh.url}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-xs text-muted-foreground"
                      disabled={testWebhookMutation.isPending}
                      onClick={() => {
                        testWebhookMutation.mutate(wh.id, {
                          onSuccess: (res) => {
                            setTestResult({ id: wh.id, ...res })
                            setTimeout(() => setTestResult(null), 4000)
                          },
                        })
                      }}
                    >
                      {testWebhookMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Test"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-xs text-muted-foreground"
                      onClick={() =>
                        toggleWebhookMutation.mutate({
                          id: wh.id,
                          is_active: !wh.is_active,
                        })
                      }
                    >
                      {wh.is_active ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteWebhookMutation.mutate(wh.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Test result toast */}
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs",
                    testResult.ok
                      ? "bg-chart-1/10 text-chart-1"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {testResult.ok
                    ? `✓ Test delivered (HTTP ${testResult.status_code})`
                    : `✕ Failed: ${testResult.error || `HTTP ${testResult.status_code}`}`}
                </motion.div>
              )}

              {/* Add new webhook form */}
              {showWebhookForm ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Name</label>
                    <Input
                      placeholder="e.g. Discord Notifications"
                      value={webhookName}
                      onChange={(e) => setWebhookName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Webhook URL</label>
                    <Input
                      placeholder="https://discord.com/api/webhooks/..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Signing Secret{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      placeholder="HMAC-SHA256 secret for signature verification"
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={!webhookName.trim() || !webhookUrl.trim() || createWebhookMutation.isPending}
                      onClick={() => {
                        createWebhookMutation.mutate(
                          {
                            name: webhookName.trim(),
                            url: webhookUrl.trim(),
                            secret: webhookSecret.trim() || undefined,
                          },
                          {
                            onSuccess: () => {
                              setWebhookName("")
                              setWebhookUrl("")
                              setWebhookSecret("")
                              setShowWebhookForm(false)
                            },
                          },
                        )
                      }}
                    >
                      {createWebhookMutation.isPending ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : null}
                      Save Webhook
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowWebhookForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowWebhookForm(true)}
                >
                  Add Webhook
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Repo → Channel Mappings */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="md:col-span-2"
          >
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                      Repo → Channel Mappings
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Route GitHub PR notifications to specific channels across any connected workspace.
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Add new mapping form */}
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Repo input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Repository</label>
                      <div className="relative mt-2">
                        <GitBranch className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="owner/repo"
                          value={newRepo}
                          onChange={(e) => setNewRepo(e.target.value)}
                          className="pl-9 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Workspace picker */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Workspace</label>
                      <div className="relative mt-2">
                        <Building2 className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <select
                          value={selectedInstallation}
                          onChange={(e) => {
                            setSelectedInstallation(e.target.value)
                            setSelectedChannel("")
                          }}
                          className={cn(
                            "h-9 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-10 text-xs",
                            "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30",
                            !selectedInstallation && "text-muted-foreground",
                          )}
                        >
                          <option value="">Select workspace...</option>
                          {installations.map((inst: SlackInstallation) => (
                            <option key={inst.id} value={inst.id}>
                              {inst.team_name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    {/* Channel picker */}
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Channel</label>
                      <div className="relative mt-2">
                        <Hash className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <select
                          value={selectedChannel}
                          onChange={(e) => setSelectedChannel(e.target.value)}
                          disabled={!selectedInstallation || channelsQuery.isLoading}
                          className={cn(
                            "h-9 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-10 text-xs",
                            "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            !selectedChannel && "text-muted-foreground",
                          )}
                        >
                          <option value="" >
                            {!selectedInstallation
                              ? "Pick a workspace first..."
                              : channelsQuery.isLoading
                                ? "Loading channels..."
                                : "Select channel..."}
                          </option>
                          {channelsQuery.data?.channels.map((ch) => (
                            <option key={ch.id} value={ch.id}>
                              #{ch.name} {ch.is_private ? "🔒" : ""}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={handleAddMapping}
                      disabled={
                        !newRepo.trim() ||
                        !selectedInstallation ||
                        !selectedChannel ||
                        addMappingMutation.isPending
                      }
                      className="h-9 gap-2"
                    >
                      {addMappingMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <></>
                      )}
                      Add Mapping
                    </Button>
                  </div>

                  {addMappingMutation.isError && (
                    <p className="text-xs text-destructive">{addMappingMutation.error.message}</p>
                  )}
                </div>

                <Separator />

                {/* Existing mappings */}
                {mappings.isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (mappings.data?.mappings.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    {mappings.data?.mappings.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground">
                            {m.repo_full_name}
                          </code>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className="flex items-center gap-1 text-xs text-foreground">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            {m.channel_name}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {m.workspace_name}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteMappingMutation.mutate(m.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      No repo mappings yet. Add one above to start receiving automated PR notifications.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}


// ── Workspace Row Component ──

function WorkspaceRow({
  installation,
  onDisconnect,
  onSetDefault,
  isDisconnecting,
  isSettingDefault,
}: {
  installation: SlackInstallation
  onDisconnect: () => void
  onSetDefault: (channelId: string, channelName: string) => void
  isDisconnecting: boolean
  isSettingDefault: boolean
}) {
  const [showDefaultPicker, setShowDefaultPicker] = useState(false)
  const channelsQuery = useSlackChannelsForInstallation(
    installation.id,
    showDefaultPicker,
  )

  function handleSetDefault(channelId: string) {
    const channel = channelsQuery.data?.channels.find((c) => c.id === channelId)
    if (!channel) return
    onSetDefault(channel.id, channel.name)
    setShowDefaultPicker(false)
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{installation.team_name}</p>
            {installation.default_channel_name && (
              <p className="text-[10px] text-muted-foreground">
                Default: <span className="text-chart-1">#{installation.default_channel_name}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="xs"
            className="text-xs text-muted-foreground"
            onClick={() => setShowDefaultPicker(!showDefaultPicker)}
          >
            {showDefaultPicker ? "Cancel" : "Set Default"}
          </Button>
          <Button
            variant="outline"
            size="xs"
            className="text-destructive hover:text-destructive text-xs"
            onClick={onDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Disconnect
          </Button>
        </div>
      </div>

      {/* Default channel picker */}
      {showDefaultPicker && (
        <div className="flex items-center gap-2 pt-1">
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value=""
            onChange={(e) => handleSetDefault(e.target.value)}
            disabled={channelsQuery.isLoading}
            className={cn(
              "h-8 flex-1 rounded-md border border-input bg-background pl-2 pr-3 text-xs",
              "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30",
            )}
          >
            <option value="">
              {channelsQuery.isLoading ? "Loading..." : "Pick a default channel..."}
            </option>
            {channelsQuery.data?.channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name} {ch.is_private ? "🔒" : ""}
              </option>
            ))}
          </select>
          {isSettingDefault && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  )
}