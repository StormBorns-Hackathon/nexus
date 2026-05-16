import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/lib/auth-context"
import { Home } from "@/pages/Home"
import { SignIn } from "@/pages/SignIn"
import { SignUp } from "@/pages/SignUp"
import { GithubCallback } from "@/pages/GithubCallback"
import { SlackCallback } from "@/pages/SlackCallback"
import { Dashboard } from "@/pages/Dashboard"
import { WorkflowDetail } from "@/pages/WorkflowDetail"
import { TriggerPage } from "@/pages/TriggerPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { IntegrationsPage } from "@/pages/IntegrationsPage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { Layout } from "@/components/layout/Layout"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Routes>
              {/* Public pages — no sidebar/header */}
              <Route path="/" element={<Home />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/auth/github/callback" element={<GithubCallback />} />
              <Route path="/integrations/slack/callback" element={<SlackCallback />} />
              <Route path="/onboarding" element={<OnboardingPage />} />

            {/* App pages — protected + layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/workflow/:id" element={<WorkflowDetail />} />
                <Route path="/trigger" element={<TriggerPage />} />
                <Route path="/integrations" element={<IntegrationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
