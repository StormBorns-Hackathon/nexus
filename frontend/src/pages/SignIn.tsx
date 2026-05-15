import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Zap, Mail, Lock, ArrowRight } from "lucide-react"

export function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
              Nexus
            </span>
          </Link>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-xl font-bold text-card-foreground">
              Welcome back
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="signin-email" className="text-xs font-medium text-foreground">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="signin-password" className="text-xs font-medium text-foreground">
                    Password
                  </label>
                  <button type="button" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Sign In
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/60">
          By signing in you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  )
}
