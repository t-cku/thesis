import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'login' | 'register'

export function AuthPanel() {
  const {
    user,
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
  } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('verify')
    if (!token) return

    let cancelled = false
    setSubmitting(true)
    setError(null)

    verifyEmail(token)
      .then(() => {
        if (!cancelled) {
          setInfo('Email verified successfully.')
          const url = new URL(window.location.href)
          url.searchParams.delete('verify')
          window.history.replaceState({}, '', url.pathname + url.search)
        }
      })
      .catch((verifyError) => {
        if (!cancelled) {
          setError(verifyError instanceof Error ? verifyError.message : 'Verification failed')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSubmitting(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [verifyEmail])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    clearAuthMessage()

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name.trim() || undefined)
      }
      setPassword('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setSubmitting(true)
    setError(null)
    try {
      const message = await resendVerification()
      setInfo(message)
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend verification')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAccount(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await deleteAccount(deletePassword)
      setDeletePassword('')
      setShowDelete(false)
      setInfo('Your account and saved theses were deleted.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete account')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <section className="authPanel">Loading account...</section>
  }

  if (user) {
    return (
      <section className="authPanel">
        <div className="authUserRow">
          <div>
            <p className="authLabel">Signed in as</p>
            <p className="authEmail">{user.name ? `${user.name} (${user.email})` : user.email}</p>
            <p className={user.email_verified ? 'verifiedBadge' : 'unverifiedBadge'}>
              {user.email_verified ? 'Email verified' : 'Email not verified'}
            </p>
          </div>
          <button type="button" className="secondaryButton" onClick={logout}>
            Log out
          </button>
        </div>

        {!user.email_verified && (
          <div className="verifyBox">
            <p>
              Verify your email to save theses. Check your inbox, or use the local verify link if SMTP
              is not configured.
            </p>
            {(verificationUrl || authMessage) && (
              <p className="muted">
                {verificationUrl ? (
                  <>
                    Local verify link:{' '}
                    <a href={verificationUrl}>{verificationUrl}</a>
                  </>
                ) : (
                  authMessage
                )}
              </p>
            )}
            <button type="button" className="secondaryButton" onClick={() => void handleResend()} disabled={submitting}>
              Resend verification
            </button>
          </div>
        )}

        {(info || authMessage) && user.email_verified && (
          <p className="success">{info ?? authMessage}</p>
        )}
        {info && !user.email_verified && <p className="success">{info}</p>}
        {error && <p className="error">{error}</p>}

        <div className="dangerZone">
          {!showDelete ? (
            <button type="button" className="dangerButton" onClick={() => setShowDelete(true)}>
              Delete account
            </button>
          ) : (
            <form className="authForm" onSubmit={handleDeleteAccount}>
              <p className="muted">
                This permanently deletes your account and all saved theses. Enter your password to
                confirm.
              </p>
              <label>
                Password
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <div className="savedActions">
                <button type="submit" className="dangerButton" disabled={submitting}>
                  {submitting ? 'Deleting...' : 'Confirm delete'}
                </button>
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => {
                    setShowDelete(false)
                    setDeletePassword('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="authPanel">
      <div className="authTabs">
        <button
          type="button"
          className={mode === 'login' ? 'authTab active' : 'authTab'}
          onClick={() => setMode('login')}
        >
          Log in
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'authTab active' : 'authTab'}
          onClick={() => setMode('register')}
        >
          Create account
        </button>
      </div>

      <form className="authForm" onSubmit={handleSubmit}>
        {mode === 'register' && (
          <label>
            Name (optional)
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
            required
            minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <p className="error">{error}</p>}
        {info && <p className="success">{info}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </section>
  )
}
