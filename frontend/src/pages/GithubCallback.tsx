import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { Zap } from "lucide-react"

export function GithubCallback() {
  const [searchParams] = useSearchParams()
  const { loginWithGithubCode } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    const code = searchParams.get("code")
    if (!code) {
      setError("No authorization code received from GitHub")
      return
    }

    exchanged.current = true
    loginWithGithubCode(code)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch((err) => setError(err.message || "GitHub authentication failed"))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <Zap className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-sm font-medium text-destructive">{error}</p>
          <button
            onClick={() => navigate("/signin", { replace: true })}
            className="text-xs text-primary hover:underline"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary animate-pulse">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          Completing GitHub sign in…
        </p>
      </div>
    </div>
  )
}
