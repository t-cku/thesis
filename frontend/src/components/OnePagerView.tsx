import { useMemo } from 'react'
import { METRIC_CONFIG, formatMetricValue, metricTone } from '../metrics'
import type { OnePager } from '../types'
import { normalizeCompetitor } from '../tickers'
import { AnalystRatingsTable } from './AnalystRatingsTable'
import { NewsList } from './NewsList'
import { RiskBadge } from './RiskBadge'
import { ScannableProse } from './ScannableProse'

interface OnePagerViewProps {
  result: OnePager
  onAnalyzeTicker?: (ticker: string) => void
}

function sentimentClass(sentiment: OnePager['external_signals']['sentiment']): string {
  return `sentimentChip sentimentChip--${sentiment}`
}

export function OnePagerView({ result, onAnalyzeTicker }: OnePagerViewProps) {
  const generatedTime = useMemo(() => {
    if (!result.generated_at) return null
    return new Date(result.generated_at).toLocaleString()
  }, [result.generated_at])

  const financialMetrics = useMemo(() => {
    return METRIC_CONFIG.map((metric) => ({
      ...metric,
      value: result.financial_health.metrics[metric.key],
    })).filter((metric) => metric.value !== undefined)
  }, [result.financial_health.metrics])

  const competitors = useMemo(
    () => result.industry_competitors.key_competitors.map(normalizeCompetitor),
    [result.industry_competitors.key_competitors],
  )

  return (
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
        <p className="subsectionLabel">Key competitors</p>
        <ul className="competitorList">
          {competitors.map((competitor, index) => {
            const key = `${competitor.name || 'competitor'}-${index}`
            if (!competitor.name) return null

            return (
              <li key={key}>
                {competitor.ticker && onAnalyzeTicker ? (
                  <button
                    type="button"
                    className="linkButton"
                    onClick={() => onAnalyzeTicker(competitor.ticker!)}
                  >
                    {competitor.name} ({competitor.ticker})
                  </button>
                ) : (
                  <span>{competitor.name}</span>
                )}
                {competitor.description ? <span>{` — ${competitor.description}`}</span> : null}
              </li>
            )
          })}
        </ul>
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
  )
}
