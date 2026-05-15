import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Home } from "@/pages/Home"
import { SignIn } from "@/pages/SignIn"
import { SignUp } from "@/pages/SignUp"
import { Dashboard } from "@/pages/Dashboard"
import { WorkflowDetail } from "@/pages/WorkflowDetail"
import { TriggerPage } from "@/pages/TriggerPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { Layout } from "@/components/layout/Layout"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages — no sidebar/header */}
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* App pages — with sidebar + header layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workflow/:id" element={<WorkflowDetail />} />
          <Route path="/trigger" element={<TriggerPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
