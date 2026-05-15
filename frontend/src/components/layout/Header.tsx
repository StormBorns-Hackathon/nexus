import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Home, User, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

export function Header() {
  const location = useLocation()
  const isProfile = location.pathname === "/profile"

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
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
              isProfile
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            J
          </div>
        </Link>
      </div>
    </header>
  )
}
