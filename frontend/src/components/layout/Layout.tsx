import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
