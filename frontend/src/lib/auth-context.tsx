import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { apiUrl } from "@/lib/api"

// ──────────────── Types ────────────────

interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  github_id: string | null
  github_username: string | null
  organization: string | null
  role: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  /** True if the user has linked a GitHub account */
  hasGithub: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  loginWithGithubCode: (code: string) => Promise<void>
  linkGithub: (code: string) => Promise<void>
  logout: () => void
  /** Refresh user data from /me endpoint */
  refreshUser: () => Promise<void>
  error: string | null
  clearError: () => void
}

// ──────────────── Context ────────────────

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = "nexus_token"

const GITHUB_CLIENT_ID = "Ov23li2BuSs5rKzxj1yI"

export function getGithubOAuthURL() {
  const redirectUri = `${window.location.origin}/auth/github/callback`
  const scope = encodeURIComponent("repo user:email")
  return `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`
}

/** OAuth URL specifically for linking GitHub to an existing account */
export function getGithubLinkURL() {
  const redirectUri = `${window.location.origin}/auth/github/callback`
  const scope = encodeURIComponent("repo user:email")
  return `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=link`
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

  // Fetch user from /me
  const fetchMe = useCallback(async (currentToken: string) => {
    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers: { Authorization: `Bearer ${currentToken}` },
      })
      if (!res.ok) throw new Error("Session expired")
      const data = await res.json()
      setUser(data)
    } catch {
      setToken(null)
      setUser(null)
    }
  }, [])

  // Fetch user on mount / token change
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      try {
        const res = await fetch(apiUrl("/api/auth/me"), {
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

    init()
    return () => {
      cancelled = true
    }
  }, [token])

  // ──── Auth methods ────

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    const res = await fetch(apiUrl("/api/auth/signin"), {
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
      const res = await fetch(apiUrl("/api/auth/signup"), {
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
    const res = await fetch(apiUrl("/api/auth/github"), {
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

  const linkGithub = useCallback(async (code: string) => {
    setError(null)
    if (!token) {
      setError("You must be signed in to link GitHub")
      throw new Error("Not authenticated")
    }
    const res = await fetch(apiUrl("/api/auth/link-github"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = data.detail || "Failed to link GitHub account"
      setError(msg)
      throw new Error(msg)
    }
    // Update user with the linked data
    setUser(data.user)
  }, [token])

  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchMe(token)
    }
  }, [token, fetchMe])

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
        hasGithub: !!user?.github_id,
        login,
        signup,
        loginWithGithubCode,
        linkGithub,
        logout,
        refreshUser,
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
