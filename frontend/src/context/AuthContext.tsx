import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  deleteAccount as apiDeleteAccount,
  fetchCurrentUser,
  login as apiLogin,
  register as apiRegister,
  resendVerification as apiResendVerification,
  verifyEmail as apiVerifyEmail,
} from '../api'
import type { User } from '../types'

const TOKEN_KEY = 'thesis_auth_token'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  authMessage: string | null
  verificationUrl: string | null
  clearAuthMessage: () => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  verifyEmail: (token: string) => Promise<void>
  resendVerification: () => Promise<string>
  deleteAccount: (password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null)

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

  const persistSession = useCallback(
    (
      accessToken: string,
      nextUser: User,
      extras?: { message?: string | null; verification_url?: string | null },
    ) => {
      localStorage.setItem(TOKEN_KEY, accessToken)
      setToken(accessToken)
      setUser(nextUser)
      setAuthMessage(extras?.message ?? null)
      setVerificationUrl(extras?.verification_url ?? null)
    },
    [],
  )

  const clearAuthMessage = useCallback(() => {
    setAuthMessage(null)
    setVerificationUrl(null)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiLogin(email, password)
      persistSession(response.access_token, response.user, response)
    },
    [persistSession],
  )

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const response = await apiRegister(email, password, name)
      persistSession(response.access_token, response.user, response)
    },
    [persistSession],
  )

  const verifyEmail = useCallback(
    async (verificationToken: string) => {
      const response = await apiVerifyEmail(verificationToken)
      persistSession(response.access_token, response.user, {
        message: response.message,
        verification_url: null,
      })
    },
    [persistSession],
  )

  const resendVerification = useCallback(async () => {
    if (!token) throw new Error('Not authenticated')
    const response = await apiResendVerification(token)
    const match = response.message.match(/https?:\/\/\S+/)
    if (match) {
      setVerificationUrl(match[0])
    }
    setAuthMessage(response.message)
    return response.message
  }, [token])

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!token) throw new Error('Not authenticated')
      await apiDeleteAccount(token, password)
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      setAuthMessage('Your account has been deleted.')
      setVerificationUrl(null)
    },
    [token],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    setAuthMessage(null)
    setVerificationUrl(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authMessage,
      verificationUrl,
      clearAuthMessage,
      login,
      register,
      verifyEmail,
      resendVerification,
      deleteAccount,
      logout,
    }),
    [
      user,
      token,
      loading,
      authMessage,
      verificationUrl,
      clearAuthMessage,
      login,
      register,
      verifyEmail,
      resendVerification,
      deleteAccount,
      logout,
    ],
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
