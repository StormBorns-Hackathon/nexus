import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Mail, Building2, Globe, Save, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name ?? "")
  const [email] = useState(user?.email ?? "")
  const [org, setOrg] = useState("Nexus Platform")
  const [role, setRole] = useState("Engineering Lead")
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleLogout() {
    logout()
    navigate("/signin")
  }

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

      <div className="mt-8 grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Overview Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-1"
        >
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center py-8">
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
              <p className="mt-0.5 text-xs text-muted-foreground">{user?.email}</p>
              {user?.github_id && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub linked
                </span>
              )}

              <Separator className="my-6" />

              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium text-card-foreground">{org}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Auth method</span>
                  <span className="font-medium text-card-foreground">
                    {user?.github_id ? "GitHub" : "Email"}
                  </span>
                </div>
              </div>

              <Separator className="my-6" />

              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit Profile Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="lg:col-span-2"
        >
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="font-heading text-base font-semibold text-card-foreground">
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="profile-name" className="text-xs font-medium text-foreground">
                      Full name
                    </label>
                    <div className="relative">
                      <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="profile-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="profile-email" className="text-xs font-medium text-foreground">
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
                    <label htmlFor="profile-org" className="text-xs font-medium text-foreground">
                      Organization
                    </label>
                    <div className="relative">
                      <Building2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="profile-org"
                        type="text"
                        value={org}
                        onChange={(e) => setOrg(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="profile-role" className="text-xs font-medium text-foreground">
                      Role
                    </label>
                    <div className="relative">
                      <Globe className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="profile-role"
                        type="text"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Button type="submit" className="gap-2">
                    <Save className="h-3.5 w-3.5" />
                    {saved ? "Saved!" : "Save Changes"}
                  </Button>
                  {saved && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs text-chart-1"
                    >
                      Profile updated successfully.
                    </motion.span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="mt-6 border-destructive/20 bg-card">
            <CardHeader>
              <CardTitle className="font-heading text-base font-semibold text-destructive">
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button variant="destructive" className="mt-4 gap-2" size="sm">
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
