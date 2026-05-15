import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Home, LogOut, PanelLeft } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function Header({ sidebarCollapsed, onToggleSidebar }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isProfile = location.pathname === "/profile"
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  function handleLogout() {
    logout()
    setShowLogoutDialog(false)
    navigate("/signin")
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-2">
          {/* Sidebar toggle */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleSidebar}
                  className="text-muted-foreground"
                />
              }
            >
              <PanelLeft className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="border-border bg-card text-card-foreground"
            >
              <p className="text-xs">Toggle sidebar</p>
            </TooltipContent>
          </Tooltip>

          {/* Home */}
          <Link to="/">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
              <Home className="h-4 w-4" />
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground">/ app</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sign out with tooltip + confirm */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setShowLogoutDialog(true)}
                />
              }
            >
              <LogOut className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="border-border bg-card text-card-foreground"
            >
              <p className="text-xs">Sign out</p>
            </TooltipContent>
          </Tooltip>

          {/* Avatar with profile pic or initial */}
          <Link to="/profile">
            <Avatar
              className={cn(
                "h-7 w-7 transition-all",
                isProfile
                  ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
                  : "hover:ring-2 hover:ring-primary/20 hover:ring-offset-1 hover:ring-offset-background"
              )}
            >
              {user?.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user?.name ?? "User"} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* Logout confirmation dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="border-border bg-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-card-foreground">
              Sign out?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground my-2">
              Are you sure you want to sign out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="gap-2 mx-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
