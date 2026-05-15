import { useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useConnectSlack } from "@/lib/queries"

export function SlackCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const connectMutation = useConnectSlack()
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const code = searchParams.get("code")
    if (!code) {
      navigate("/integrations", { replace: true })
      return
    }

    const redirectUri = `${window.location.origin}/integrations/slack/callback`

    connectMutation.mutate(
      { code, redirectUri },
      {
        onSuccess: () => {
          navigate("/integrations", { replace: true })
        },
        onError: () => {
          navigate("/integrations", { replace: true })
        },
      },
    )
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting Slack...</p>
      </div>
    </div>
  )
}
