import { useState, type FormEvent } from 'react'
import { analyzeTicker, saveThesis } from './api'
import { AuthPanel } from './components/AuthPanel'
import { OnePagerView } from './components/OnePagerView'
import { SavedThesesList } from './components/SavedThesesList'
import { useAuth } from './context/AuthContext'
import type { OnePager } from './types'

type View = 'analyze' | 'saved'

function formatRequestError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Cannot reach the backend. From the project root, run ./run.sh (port 8001), keep that terminal open, then try again.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

function App() {
  const { token, user } = useAuth()
  const [view, setView] = useState<View>('analyze')
  const [ticker, setTicker] = useState('AAPL')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [result, setResult] = useState<OnePager | null>(null)
  const [viewingSavedThesis, setViewingSavedThesis] = useState(false)

  async function runAnalysis(symbol: string) {
    const normalized = symbol.trim().toUpperCase()
    if (!normalized) return

    setTicker(normalized)
    setView('analyze')
    setLoading(true)
    setError(null)
    setSaveMessage(null)

    try {
      const payload = await analyzeTicker(normalized)
      setResult(payload)
    } catch (requestError) {
      setError(formatRequestError(requestError))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze(event: FormEvent) {
    event.preventDefault()
    await runAnalysis(ticker)
  }

  async function handleSave() {
    if (!result || !token) return

    setSaving(true)
    setSaveMessage(null)
    setError(null)

    try {
      await saveThesis(token, result)
      setSaveMessage(`Saved ${result.ticker} to your account.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save thesis')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Thesis</h1>
        <p>Structured stock research one-pager for busy investors.</p>
        <p className="buildLabel">Build: saved-theses + ticker-links (Jul 2026)</p>
      </header>

      <AuthPanel />

      <nav className="viewNav">
        <button
          type="button"
          className={view === 'analyze' ? 'navTab active' : 'navTab'}
          onClick={() => setView('analyze')}
        >
          Analyze
        </button>
        <button
          type="button"
          className={view === 'saved' ? 'navTab active' : 'navTab'}
          onClick={() => setView('saved')}
        >
          Saved theses
        </button>
      </nav>

      {view === 'analyze' ? (
        <>
          <form className="search" onSubmit={handleAnalyze}>
            <label htmlFor="ticker">Ticker</label>
            <div className="searchRow">
              <input
                id="ticker"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                placeholder="AAPL"
                maxLength={10}
              />
              <button type="submit" disabled={loading || !ticker.trim()}>
                {loading ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>
          </form>

          {error && <p className="error">{error}</p>}
          {saveMessage && <p className="success">{saveMessage}</p>}

          {result && (
            <>
              <div className="resultActions">
                {token && user?.email_verified ? (
                  <button type="button" onClick={() => void handleSave()} disabled={saving}>
                    {saving ? 'Saving...' : 'Save to my account'}
                  </button>
                ) : token ? (
                  <p className="muted">Verify your email to save this analysis.</p>
                ) : (
                  <p className="muted">Log in to save this analysis to your account.</p>
                )}
              </div>
              <OnePagerView result={result} onAnalyzeTicker={(symbol) => void runAnalysis(symbol)} />
            </>
          )}
        </>
      ) : (
        <SavedThesesList
          onViewingChange={setViewingSavedThesis}
          onAnalyzeTicker={(symbol) => void runAnalysis(symbol)}
        />
      )}

      {view === 'saved' && !viewingSavedThesis && (
        <p className="muted footerHint">Open a saved thesis to review the full one-pager.</p>
      )}
    </main>
  )
}

export default App
