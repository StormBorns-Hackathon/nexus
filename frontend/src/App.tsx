import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/lib/auth-context"
import { Home } from "@/pages/Home"
import { SignIn } from "@/pages/SignIn"
import { SignUp } from "@/pages/SignUp"
import { GithubCallback } from "@/pages/GithubCallback"
import { Dashboard } from "@/pages/Dashboard"
import { WorkflowDetail } from "@/pages/WorkflowDetail"
import { TriggerPage } from "@/pages/TriggerPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { Layout } from "@/components/layout/Layout"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages — no sidebar/header */}
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/auth/github/callback" element={<GithubCallback />} />

          {/* App pages — protected + layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/workflow/:id" element={<WorkflowDetail />} />
              <Route path="/trigger" element={<TriggerPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
