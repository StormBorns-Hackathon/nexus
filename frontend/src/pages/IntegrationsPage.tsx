import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  // Plug,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Plus,
  Hash,
  GitBranch,
  Building2,
  Zap,
} from "lucide-react"
import {
  useSlackStatus,
  useSlackChannelsForInstallation,
  useRepoMappings,
  useDisconnectSlackInstallation,
  useAddMapping,
  useDeleteMapping,
  useSetDefaultChannel,
} from "@/lib/queries"
import { getSlackAuthUrl } from "@/lib/api"
import type { SlackInstallation } from "@/lib/api"
import { cn } from "@/lib/utils"

export function IntegrationsPage() {
  const slackStatus = useSlackStatus()
  const isConnected = slackStatus.data?.connected ?? false
  const installations = slackStatus.data?.installations ?? []
  const mappings = useRepoMappings()
  const disconnectMutation = useDisconnectSlackInstallation()
  const addMappingMutation = useAddMapping()
  const deleteMappingMutation = useDeleteMapping()
  const setDefaultMutation = useSetDefaultChannel()

  const [newRepo, setNewRepo] = useState("")
  const [selectedInstallation, setSelectedInstallation] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("")

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
        <div className="flex items-center gap-3">
          {/* <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Plug className="h-4 w-4 text-primary" />
          </div> */}
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Integrations
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Connect services to receive automated PR alerts and notifications.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="mt-8 max-w-3xl space-y-6">
        {/* Slack Workspaces Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Card className="border-border bg-card">
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
              {/* Connected workspaces */}
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

              {/* Connect another workspace button */}
              <Button
                onClick={handleConnectSlack}
                variant={isConnected ? "outline" : "default"}
                className="gap-2"
                size="sm"
              >
                {/* <Plus className="h-3.5 w-3.5" /> */}
                {isConnected ? "Connect Another Workspace" : "Connect Slack"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Repo → Channel Mappings */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-chart-3" />
                  <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                    Repo → Channel Mappings
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Route GitHub PR notifications to specific channels across any connected workspace.
                  One repo can alert multiple channels and workspaces.
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Add new mapping */}
                <div className="space-y-3">
                  <div className="flex items-end gap-3">
                    {/* Repo input */}
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Repository</label>
                      <div className="relative">
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
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Workspace</label>
                      <div className="relative">
                        <Building2 className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <select
                          value={selectedInstallation}
                          onChange={(e) => {
                            setSelectedInstallation(e.target.value)
                            setSelectedChannel("") // Reset channel when workspace changes
                          }}
                          className={cn(
                            "h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs",
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
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end gap-3">
                    {/* Channel picker */}
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Channel</label>
                      <div className="relative">
                        <Hash className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <select
                          value={selectedChannel}
                          onChange={(e) => setSelectedChannel(e.target.value)}
                          disabled={!selectedInstallation || channelsQuery.isLoading}
                          className={cn(
                            "h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs",
                            "focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            !selectedChannel && "text-muted-foreground",
                          )}
                        >
                          <option value="">
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
                      className="h-9 gap-1.5"
                    >
                      {addMappingMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      Add Mapping
                    </Button>
                  </div>
                </div>

                {addMappingMutation.isError && (
                  <p className="text-xs text-destructive">{addMappingMutation.error.message}</p>
                )}

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
                        <div className="flex items-center gap-3 flex-wrap">
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