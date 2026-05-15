import { useState, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

export function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Sidebar drawer */}
          <div className="relative z-10 h-full w-64 animate-in slide-in-from-left duration-200">
            <Sidebar
              collapsed={false}
              onNavClick={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => {
            // On mobile: toggle overlay
            // On desktop: toggle collapse
            if (window.innerWidth < 1024) {
              setMobileSidebarOpen(!mobileSidebarOpen)
            } else {
              setSidebarCollapsed(!sidebarCollapsed)
            }
          }}
        />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
