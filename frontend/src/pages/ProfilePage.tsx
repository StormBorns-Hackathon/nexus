import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  User,
  Mail,
  Building2,
  Globe,
  LogOut,
  Pencil,
  X,
  Check,
  Trash2,
  AlertTriangle,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { useAuth, getGithubLinkURL } from "@/lib/auth-context"
import { updateProfile } from "@/lib/api"

export function ProfilePage() {
  const { user, logout, hasGithub, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name ?? "")
  const [email] = useState(user?.email ?? "")
  const [org, setOrg] = useState(user?.organization ?? "")
  const [role, setRole] = useState(user?.role ?? "")

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Stash original values for cancel
  const [origName, setOrigName] = useState(name)
  const [origOrg, setOrigOrg] = useState(org)
  const [origRole, setOrigRole] = useState(role)

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  // Logout dialog
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  function handleEditToggle() {
    if (editing) {
      // Cancel — restore originals
      setName(origName)
      setOrg(origOrg)
      setRole(origRole)
    } else {
      // Enter edit — stash current values
      setOrigName(name)
      setOrigOrg(org)
      setOrigRole(role)
    }
    setEditing(!editing)
    setSaved(false)
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await updateProfile({
        name: name.trim(),
        organization: org.trim(),
        role: role.trim(),
      })
      await refreshUser()
      setEditing(false)
      setSaved(true)
      setOrigName(name)
      setOrigOrg(org)
      setOrigRole(role)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    logout()
    navigate("/signin")
  }

  function handleDeleteAccount() {
    logout()
    navigate("/signin")
  }

  const confirmationTarget = user?.email ?? user?.name ?? ""
  const canDelete =
    deleteConfirmation.trim().toLowerCase() ===
    confirmationTarget.trim().toLowerCase()

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </motion.div>

      <div className="mt-8 flex max-w-4xl flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Profile Overview Card — left column */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:w-1/3 lg:shrink-0"
        >
          <Card className="h-full border-border bg-card">
            <CardContent className="flex h-full flex-col items-center py-8">
              <Avatar className="h-16 w-16">
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={user.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 font-heading text-base font-semibold text-card-foreground">
                {user?.name}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {user?.email}
              </p>
              {user?.github_id ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-chart-1/10 px-2.5 py-0.5 text-[10px] font-medium text-chart-1">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  @{user?.github_username || "linked"}
                </span>
              ) : (
                <a href={getGithubLinkURL()} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-chart-3/10 px-2.5 py-1 text-[10px] font-medium text-chart-3 hover:bg-chart-3/15 transition-colors">
                  <AlertTriangle className="h-3 w-3" />
                  Link GitHub
                </a>
              )}

              <Separator className="my-6" />

              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium text-card-foreground">
                    {org}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium text-card-foreground">
                    {role}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Auth method</span>
                  <span className="font-medium text-card-foreground">
                    {user?.github_id ? "GitHub" : "Email"}
                  </span>
                </div>
              </div>

              {/* Push sign out button to the bottom */}
              <div className="mt-auto w-full pt-6">
                <Separator className="mb-6" />
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:text-destructive"
                  onClick={() => setShowLogoutDialog(true)}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column — stacked cards */}
        <div className="flex flex-1 flex-col gap-6">
          {/* Account Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
          <Card className="border-border bg-card pb-10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                Account Details
              </CardTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleEditToggle}
                className={
                  editing
                    ? "text-destructive hover:text-destructive"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {editing ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="profile-name"
                    className="text-xs font-medium text-foreground"
                  >
                    Full name
                  </label>
                  <div className="relative">
                    <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="profile-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!editing}
                      className={`pl-10 ${!editing ? "opacity-60" : ""}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="profile-email"
                    className="text-xs font-medium text-foreground"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="profile-email"
                      type="email"
                      value={email}
                      disabled
                      className="pl-10 opacity-60"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="profile-org"
                    className="text-xs font-medium text-foreground"
                  >
                    Organization
                  </label>
                  <div className="relative">
                    <Building2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="profile-org"
                      type="text"
                      value={org}
                      onChange={(e) => setOrg(e.target.value)}
                      disabled={!editing}
                      className={`pl-10 ${!editing ? "opacity-60" : ""}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="profile-role"
                    className="text-xs font-medium text-foreground"
                  >
                    Role
                  </label>
                  <div className="relative">
                    <Globe className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="profile-role"
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={!editing}
                      className={`pl-10 ${!editing ? "opacity-60" : ""}`}
                    />
                  </div>
                </div>
              </div>

              {/* Save button — only visible in edit mode */}
              <AnimatePresence>
                {editing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Separator className="my-5" />
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleSave}
                        className="gap-2"
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {saving ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleEditToggle}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </div>
                    {saveError && (
                      <p className="mt-2 text-xs text-destructive">{saveError}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Saved confirmation */}
              <AnimatePresence>
                {saved && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-4 rounded-lg border border-chart-1/20 bg-chart-1/5 px-3 py-2 text-xs text-chart-1"
                  >
                    Profile updated successfully.
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
          </motion.div>

          {/* GitHub Connection Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.17 }}
          >
            <Card className={hasGithub ? "border-border bg-card" : "border-chart-3/20 bg-card"}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${hasGithub ? "bg-chart-1/10" : "bg-chart-3/10"}`}>
                    <GitBranch className={`h-4 w-4 ${hasGithub ? "text-chart-1" : "text-chart-3"}`} />
                  </div>
                  <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                    GitHub Connection
                  </CardTitle>
                </div>
                {hasGithub ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-chart-1/10 px-2.5 py-1 text-[10px] font-medium text-chart-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-chart-3/10 px-2.5 py-1 text-[10px] font-medium text-chart-3">
                    <AlertTriangle className="h-3 w-3" />
                    Not linked
                  </span>
                )}
              </CardHeader>
              <CardContent>
                {hasGithub ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                      <svg className="h-4 w-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-foreground">@{user?.github_username || user?.github_id}</p>
                        <p className="text-[10px] text-muted-foreground">Linked GitHub account</p>
                      </div>
                    </div>
                    <a href={getGithubLinkURL()}>
                      <Button variant="outline" size="sm" className="gap-2 text-xs">
                        <ExternalLink className="h-3 w-3" />
                        Re-link Account
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Link your GitHub account to analyze private repos and enable the full PR workflow pipeline. Without it, only public repos are accessible.
                    </p>
                    <a href={getGithubLinkURL()}>
                      <Button size="sm" className="gap-2">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        Link GitHub Account
                      </Button>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="border-destructive/20 bg-card py-10">
            <CardHeader>
              <CardTitle className="font-heading text-base font-semibold text-destructive">
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
              <Button
                variant="destructive"
                className="mt-4 gap-2"
                size="sm"
                onClick={() => {
                  setDeleteConfirmation("")
                  setShowDeleteDialog(true)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Account
              </Button>
            </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Delete account confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="font-heading text-card-foreground">
              Delete your account?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will permanently delete your account, all workflows, and
              trace data. This action <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">
              To confirm, type{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                {confirmationTarget}
              </span>{" "}
              below:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={confirmationTarget}
              className="font-mono text-sm"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canDelete}
              onClick={handleDeleteAccount}
              className="gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logout confirmation dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="border-border bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-card-foreground">
              Sign out?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground my-2">
              Are you sure you want to sign out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="gap-2 mx-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
