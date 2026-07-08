import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AnalystRatingsTable } from './components/AnalystRatingsTable'
import { NewsList } from './components/NewsList'
import { RiskBadge } from './components/RiskBadge'
import { ScannableProse } from './components/ScannableProse'
import type { RiskCategory } from './formatting'

type Sentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed'

interface OnePager {
  ticker: string
  company_name: string
  generated_at: string
  company_overview: {
    description: string
    differentiation: string
    products_services: string[]
    leadership: string
  }
  industry_competitors: {
    industry: string
    market_landscape: string
    key_competitors: string[]
    competitive_position: string
  }
  financial_health: {
    metrics: Record<string, number | string | null>
    analysis: string
  }
  bull_bear: {
    bull: string[]
    bear: string[]
  }
  risks: Array<{
    category: RiskCategory
    description: string
  }>
  external_signals: {
    sentiment: Sentiment
    summary: string
    recent_news: string[]
    notable_endorsements_or_criticism: string[]
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001'

function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OnePager | null>(null)

  const generatedTime = useMemo(() => {
    if (!result?.generated_at) return null
    return new Date(result.generated_at).toLocaleString()
  }, [result?.generated_at])

  async function handleAnalyze(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: string }
        throw new Error(payload.detail ?? 'Request failed')
      }

      const payload = (await response.json()) as OnePager
      setResult(payload)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unexpected error')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Thesis</h1>
        <p>Structured stock research one-pager for busy investors.</p>
      </header>

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

      {result && (
        <section className="content">
          <div className="titleBlock">
            <h2>
              {result.company_name} ({result.ticker})
            </h2>
            {generatedTime && <p>Generated: {generatedTime}</p>}
          </div>

          <article className="card">
            <h3>1. Company overview</h3>
            <p>{result.company_overview.description}</p>
            <p>
              <strong>Differentiation:</strong> {result.company_overview.differentiation}
            </p>
            <p>
              <strong>Leadership:</strong> {result.company_overview.leadership}
            </p>
          </article>

          <article className="card">
            <h3>2. Industry and competitors</h3>
            <p>
              <strong>Industry:</strong> {result.industry_competitors.industry}
            </p>
            <ScannableProse text={result.industry_competitors.market_landscape} />
            <p>
              <strong>Key competitors:</strong> {result.industry_competitors.key_competitors.join(', ')}
            </p>
            <ScannableProse text={result.industry_competitors.competitive_position} />
          </article>

          <article className="card">
            <h3>3. Financial health</h3>
            <ScannableProse text={result.financial_health.analysis} />
          </article>

          <article className="card split">
            <div>
              <h3>4. Bull case</h3>
              <ul>
                {result.bull_bear.bull.map((item) => (
                  <li key={`bull-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Bear case</h3>
              <ul>
                {result.bull_bear.bear.map((item) => (
                  <li key={`bear-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          </article>

          <article className="card">
            <h3>5. Risks</h3>
            <ul className="riskList">
              {result.risks.map((risk, index) => (
                <li key={`${risk.category}-${index}`} className="riskItem">
                  <RiskBadge category={risk.category} />
                  <span>{risk.description}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h3>6. External signals</h3>
            <p>
              <strong>Sentiment:</strong> {result.external_signals.sentiment}
            </p>
            <ScannableProse text={result.external_signals.summary} />
            <AnalystRatingsTable items={result.external_signals.notable_endorsements_or_criticism} />
            <p className="subsectionLabel">Recent news</p>
            <NewsList items={result.external_signals.recent_news} />
          </article>
        </section>
      )}
    </main>
  )
}

export default App
