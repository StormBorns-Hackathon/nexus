import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"

// ──────────────── Types ────────────────

interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  github_id: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  loginWithGithubCode: (code: string) => Promise<void>
  logout: () => void
  error: string | null
  clearError: () => void
}

// ──────────────── Context ────────────────

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = "nexus_token"

const GITHUB_CLIENT_ID = "Ov23li2BuSs5rKzxj1yI"

export function getGithubOAuthURL() {
  const redirectUri = `${window.location.origin}/auth/github/callback`
  return `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`
}

// ──────────────── Provider ────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  // Persist token
  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [token])

  // Fetch user on mount / token change
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error("Session expired")
        const data = await res.json()
        if (!cancelled) setUser(data)
      } catch {
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchMe()
    return () => {
      cancelled = true
    }
  }, [token])

  // ──── Auth methods ────

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.detail || "Sign in failed")
      throw new Error(data.detail)
    }
    setToken(data.access_token)
    setUser(data.user)
  }, [])

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null)
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || "Sign up failed")
        throw new Error(data.detail)
      }
      setToken(data.access_token)
      setUser(data.user)
    },
    [],
  )

  const loginWithGithubCode = useCallback(async (code: string) => {
    setError(null)
    const res = await fetch("/api/auth/github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.detail || "GitHub login failed")
      throw new Error(data.detail)
    }
    setToken(data.access_token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        loginWithGithubCode,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ──────────────── Hook ────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}
