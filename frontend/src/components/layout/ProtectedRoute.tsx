import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"
import { Zap } from "lucide-react"

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary animate-pulse">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />
  }

  return <Outlet />
}
