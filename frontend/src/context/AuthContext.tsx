import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchCurrentUser, login as apiLogin, register as apiRegister } from '../api'
import type { User } from '../types'

const TOKEN_KEY = 'thesis_auth_token'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false

    fetchCurrentUser(token)
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const persistSession = useCallback((accessToken: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    setToken(accessToken)
    setUser(nextUser)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiLogin(email, password)
      persistSession(response.access_token, response.user)
    },
    [persistSession],
  )

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const response = await apiRegister(email, password, name)
      persistSession(response.access_token, response.user)
    },
    [persistSession],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
    }),
    [user, token, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
