import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'login' | 'register'

export function AuthPanel() {
  const { user, loading, login, register, logout } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

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
          </div>
          <button type="button" className="secondaryButton" onClick={logout}>
            Log out
          </button>
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

        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </section>
  )
}
