import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { Zap, CheckCircle2 } from "lucide-react"

export function GithubCallback() {
  const [searchParams] = useSearchParams()
  const { loginWithGithubCode, linkGithub, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const exchanged = useRef(false)

  const isLinkMode = searchParams.get("state") === "link"

  useEffect(() => {
    if (exchanged.current) return
    const code = searchParams.get("code")
    if (!code) {
      setError("No authorization code received from GitHub")
      return
    }

    exchanged.current = true

    if (isLinkMode && isAuthenticated) {
      // Linking GitHub to existing account
      linkGithub(code)
        .then(() => {
          setSuccess(true)
          setTimeout(() => navigate("/integrations", { replace: true }), 1500)
        })
        .catch((err) => setError(err.message || "Failed to link GitHub account"))
    } else {
      // Normal login/signup flow
      loginWithGithubCode(code)
        .then(() => navigate("/dashboard", { replace: true }))
        .catch((err) => setError(err.message || "GitHub authentication failed"))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
            <Zap className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isLinkMode ? "GitHub Linking Failed" : "Authentication Failed"}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{error}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(isLinkMode ? "/integrations" : "/signin", { replace: true })}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {isLinkMode ? "Back to Integrations" : "Back to Sign In"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-1/10">
            <CheckCircle2 className="h-6 w-6 text-chart-1" />
          </div>
          <p className="text-sm font-medium text-chart-1">
            GitHub account linked successfully!
          </p>
          <p className="text-xs text-muted-foreground">
            Redirecting to Integrations…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary animate-pulse">
          <img src="/logo.svg" alt="Nexus" className="h-10 w-10" />
        </div>
        <p className="text-xs text-muted-foreground">
          {isLinkMode ? "Linking your GitHub account…" : "Completing GitHub sign in…"}
        </p>
      </div>
    </div>
  )
}