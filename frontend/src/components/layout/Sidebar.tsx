import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  Radio,
  Zap,
  ChevronLeft,
  ChevronRight,
  User,
  Plug,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Trigger", href: "/trigger", icon: Radio },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Profile", href: "/profile", icon: User },
]

export function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
          <Zap className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-heading text-base font-semibold tracking-tight">
            Nexus
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.href)
          return (
            <Link key={item.href} to={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
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

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full text-muted-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  )
}
