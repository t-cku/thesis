import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AnalystRatingsTable } from './components/AnalystRatingsTable'
import { NewsList } from './components/NewsList'
import { RiskBadge } from './components/RiskBadge'
import { ScannableProse } from './components/ScannableProse'
import type { RiskCategory } from './formatting'

type Sentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed'
type MetricFormat = 'currency' | 'percent' | 'ratio' | 'number'

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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function analyzeEndpoint(): string {
  return API_BASE_URL ? `${API_BASE_URL}/analyze` : '/analyze'
}

function formatRequestError(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Cannot reach the backend. From the project root, run ./run.sh (port 8001), keep that terminal open, then try again.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

const METRIC_CONFIG: Array<{
  key: string
  label: string
  format: MetricFormat
}> = [
  { key: 'market_cap', label: 'Market cap', format: 'currency' },
  { key: 'revenue', label: 'Revenue', format: 'currency' },
  { key: 'revenue_growth_yoy', label: 'Revenue growth YoY', format: 'percent' },
  { key: 'gross_margin', label: 'Gross margin', format: 'percent' },
  { key: 'operating_margin', label: 'Operating margin', format: 'percent' },
  { key: 'net_margin', label: 'Net margin', format: 'percent' },
  { key: 'total_debt', label: 'Total debt', format: 'currency' },
  { key: 'cash_and_equivalents', label: 'Cash & equivalents', format: 'currency' },
  { key: 'free_cash_flow', label: 'Free cash flow', format: 'currency' },
  { key: 'pe_ratio', label: 'P/E ratio', format: 'ratio' },
  { key: 'forward_pe', label: 'Forward P/E', format: 'ratio' },
  { key: 'price_to_sales', label: 'Price to sales', format: 'ratio' },
  { key: 'ev_to_ebitda', label: 'EV / EBITDA', format: 'ratio' },
]

function formatMetricValue(value: number | string | null | undefined, format: MetricFormat): string {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return 'N/A'

  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }

  if (format === 'percent') {
    return `${(value * 100).toFixed(1)}%`
  }

  if (format === 'ratio') {
    return `${value.toFixed(1)}x`
  }

  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function sentimentClass(sentiment: Sentiment): string {
  return `sentimentChip sentimentChip--${sentiment}`
}

function metricTone(metricKey: string, value: number | string | null | undefined): 'positive' | 'warning' | 'negative' | 'neutral' {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'neutral'

  if (metricKey === 'total_debt') {
    if (value <= 0) return 'positive'
    if (value > 100_000_000_000) return 'negative'
    return 'warning'
  }

  if (metricKey === 'pe_ratio' || metricKey === 'forward_pe' || metricKey === 'price_to_sales' || metricKey === 'ev_to_ebitda') {
    if (value <= 18) return 'positive'
    if (value <= 32) return 'warning'
    return 'negative'
  }

  if (metricKey === 'gross_margin') {
    if (value >= 0.45) return 'positive'
    if (value >= 0.25) return 'warning'
    return 'negative'
  }

  if (metricKey === 'operating_margin' || metricKey === 'net_margin') {
    if (value >= 0.2) return 'positive'
    if (value >= 0.08) return 'warning'
    return 'negative'
  }

  if (metricKey === 'revenue_growth_yoy' || metricKey === 'free_cash_flow') {
    if (value > 0) return 'positive'
    if (value === 0) return 'warning'
    return 'negative'
  }

  if (metricKey === 'cash_and_equivalents' || metricKey === 'market_cap' || metricKey === 'revenue') {
    return 'positive'
  }

  return 'neutral'
}

function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OnePager | null>(null)

  const generatedTime = useMemo(() => {
    if (!result?.generated_at) return null
    return new Date(result.generated_at).toLocaleString()
  }, [result?.generated_at])

  const financialMetrics = useMemo(() => {
    if (!result?.financial_health?.metrics) return []
    return METRIC_CONFIG.map((metric) => ({
      ...metric,
      value: result.financial_health.metrics[metric.key],
    })).filter((metric) => metric.value !== undefined)
  }, [result?.financial_health?.metrics])

  async function handleAnalyze(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(analyzeEndpoint(), {
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
      setError(formatRequestError(requestError))
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
            <div className="titleLine">
              <h2>
                {result.company_name} ({result.ticker})
              </h2>
              <span className={sentimentClass(result.external_signals.sentiment)}>
                {result.external_signals.sentiment}
              </span>
            </div>
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
            <div className="metricsGrid">
              {financialMetrics.map((metric) => (
                <div
                  key={metric.key}
                  className={`metricCard metricCard--${metricTone(metric.key, metric.value)}`}
                >
                  <p className="metricLabel">{metric.label}</p>
                  <p className="metricValue">{formatMetricValue(metric.value, metric.format)}</p>
                </div>
              ))}
            </div>
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
