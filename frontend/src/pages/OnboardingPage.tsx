import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Building2,
  Globe,
  ArrowRight,
  Zap,
  Loader2,
  SkipForward,
} from "lucide-react"
import { useAuth, getGithubLinkURL } from "@/lib/auth-context"
import { updateProfile } from "@/lib/api"

const ROLE_OPTIONS = [
  "Engineering Lead",
  "Software Engineer",
  "DevOps / SRE",
  "Engineering Manager",
  "Product Manager",
  "CTO / VP Engineering",
  "Other",
]

export function OnboardingPage() {
  const { user, hasGithub, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [org, setOrg] = useState("")
  const [role, setRole] = useState("")
  const [customRole, setCustomRole] = useState("")
  const [saving, setSaving] = useState(false)

  const totalSteps = 3

  async function handleSaveProfile() {
    setSaving(true)
    try {
      await updateProfile({
        organization: org.trim(),
        role: role === "Other" ? customRole.trim() : role,
      })
      await refreshUser()
      setStep(3)
    } catch {
      // silently move forward even on failure
      setStep(3)
    } finally {
      setSaving(false)
    }
  }

  function handleFinish() {
    navigate("/dashboard", { replace: true })
  }

  function handleSkip() {
    navigate("/dashboard", { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary glow-primary-sm">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-foreground">
            Welcome to Nexus{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Let&apos;s get your workspace set up in a few quick steps.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full overflow-hidden bg-muted"
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{
                  width: i < step ? "100%" : "0%",
                }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              />
            </div>
          ))}
        </div>

        {/* Step 1: Organization & Role */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Tell us about yourself
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                This helps us personalize your experience.
              </p>
            </div>

            <div className="space-y-4">
              {/* Organization */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  Organization
                </label>
                <div className="relative">
                  <Building2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="e.g. Acme Corp"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">
                  Your Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                        role === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {role === "Other" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                  >
                    <div className="relative mt-2">
                      <Globe className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Your role title"
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-xs text-muted-foreground gap-1.5"
              >
                <SkipForward className="h-3 w-3" />
                Skip for now
              </Button>
              <Button
                onClick={() => {
                  if (org.trim() || role) {
                    handleSaveProfile()
                  } else {
                    setStep(2)
                  }
                }}
                disabled={saving}
                className="gap-2"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Connect GitHub */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Connect GitHub
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Link your GitHub account to analyze private repos and enable full PR workflows.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <svg className="h-7 w-7 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>

              {hasGithub ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-chart-1">✓ GitHub Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Signed in as @{user?.github_username || user?.github_id}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Without GitHub, you can only analyze public repos with rate limits.
                  </p>
                  <a href={getGithubLinkURL()}>
                    <Button className="gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      Link GitHub Account
                    </Button>
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs text-muted-foreground"
              >
                ← Back
              </Button>
              <Button onClick={() => setStep(3)} className="gap-2">
                {hasGithub ? "Continue" : "Skip for now"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: All done */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-6 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-chart-1/10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <Zap className="h-8 w-8 text-chart-1" />
              </motion.div>
            </div>

            <div>
              <h2 className="font-heading text-xl font-bold text-foreground">
                You&apos;re all set!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your workspace is ready. Start by triggering your first PR analysis
                or connecting Slack for notifications.
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleFinish}
              className="gap-2"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
