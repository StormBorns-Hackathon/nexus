import { Link, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Home, LogOut } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

export function Header() {
  const location = useLocation()
  const { user } = useAuth()
  const isProfile = location.pathname === "/profile"
  const initials = (user?.name ?? user?.email ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Home className="h-4 w-4" />
          </Button>
        </Link>
        <span className="text-xs text-muted-foreground">/ app</span>
      </div>

      <div className="flex items-center gap-2">
        <Link to="/signin">
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        </Link>
        <Link to="/profile">
          <Avatar
            size="sm"
            className={cn(
              "h-7 w-7 transition-colors",
              isProfile
                ? "ring-1 ring-primary/30"
                : "hover:ring-1 hover:ring-primary/30"
            )}
          >
            {user?.avatar_url ? (
              <AvatarImage src={user.avatar_url} alt={user.name} />
            ) : null}
            <AvatarFallback
              className={cn(
                "text-xs font-medium transition-colors",
                isProfile
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}
