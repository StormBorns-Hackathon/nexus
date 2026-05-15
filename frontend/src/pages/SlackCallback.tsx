import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2, AlertCircle } from "lucide-react"
import { connectSlack } from "@/lib/api"

export function SlackCallback() {
  const [searchParams] = useSearchParams()
  const didRun = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const code = searchParams.get("code")
    if (!code) {
      window.location.href = "/integrations"
      return
    }

    const redirectUri = `${window.location.origin}/integrations/slack/callback`

    connectSlack(code, redirectUri)
      .then(() => {
        window.location.href = "/integrations"
      })
      .catch((err) => {
        console.error("Slack connect failed:", err)
        setError(err.message || "Failed to connect Slack")
        setTimeout(() => {
          window.location.href = "/integrations"
        }, 3000)
      })
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {error ? (
          <>
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground">Redirecting...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Connecting Slack...</p>
          </>
        )}
      </div>
    </div>
  )
}
