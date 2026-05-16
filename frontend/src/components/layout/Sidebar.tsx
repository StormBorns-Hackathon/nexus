import { Link, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  LayoutDashboard,
  Radio,
  Plug,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Trigger", href: "/trigger", icon: Radio },
]

interface SidebarProps {
  collapsed: boolean
  /** Called when a nav link is clicked — used to close mobile sidebar */
  onNavClick?: () => void
}

export function Sidebar({ collapsed, onNavClick }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuth()

  const isProfileActive = location.pathname === "/profile"
  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "px-4"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md overflow-hidden">
            <img src="/logo.svg" alt="Nexus" className="h-7 w-7" />
          </div>
          {!collapsed && (
            <span className="font-heading text-base font-semibold tracking-tight">
              Nexus
            </span>
          )}
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href)
          return (
            <Link key={item.href} to={item.href} onClick={onNavClick}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Profile at bottom */}
      <div className="border-t border-border p-2">
        <Link to="/profile" onClick={onNavClick}>
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              collapsed && "justify-center px-0",
              isProfileActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Avatar className="h-5 w-5 shrink-0">
              {user?.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={user?.name ?? ""} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-[8px] font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="truncate">{user?.name ?? "Profile"}</span>
            )}
          </div>
        </Link>
      </div>
    </aside>
  )
}
