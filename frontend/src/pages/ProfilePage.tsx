import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, Mail, Building2, Globe, Save, LogOut } from "lucide-react"
import { Link } from "react-router-dom"

export function ProfilePage() {
  const [name, setName] = useState("Jane Doe")
  const [email, setEmail] = useState("jane@nexus-platform.com")
  const [org, setOrg] = useState("Nexus Platform")
  const [role, setRole] = useState("Engineering Lead")
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const initials = name
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
              <Avatar size="lg" className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 font-heading text-base font-semibold text-card-foreground">
                {name}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>

              <Separator className="my-6" />

              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium text-card-foreground">{org}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Workflows run</span>
                  <span className="font-medium text-card-foreground">47</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="font-medium text-card-foreground">May 2026</span>
                </div>
              </div>

              <Separator className="my-6" />

              <Link to="/signin" className="w-full">
                <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              </Link>
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
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
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
