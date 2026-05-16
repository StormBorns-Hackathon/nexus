import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/lib/auth-context"

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden animate-pulse">
            <img src="/logo.svg" alt="Nexus" className="h-10 w-10" />
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
