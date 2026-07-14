import { useMemo } from 'react'
import { METRIC_CONFIG, formatMetricValue, metricTone } from '../metrics'
import type { OnePager } from '../types'
import { normalizeCompetitor } from '../tickers'
import { AnalystRatingsTable } from './AnalystRatingsTable'
import { NewsList } from './NewsList'
import { RiskBadge } from './RiskBadge'
import { ScannableProse } from './ScannableProse'
import { SectionNav } from './SectionNav'

interface OnePagerViewProps {
  result: OnePager
  onAnalyzeTicker?: (ticker: string) => void
}

function sentimentClass(sentiment: OnePager['external_signals']['sentiment']): string {
  return `sentimentChip sentimentChip--${sentiment}`
}

function splitLeadIn(text: string): { lead: string; rest: string } {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.+?[.!?])(\s+[\s\S]*)?$/)
  if (!match) {
    return { lead: trimmed, rest: '' }
  }
  return {
    lead: match[1].trim(),
    rest: (match[2] ?? '').trim(),
  }
}

function CaseBullet({ text }: { text: string }) {
  const { lead, rest } = splitLeadIn(text)
  return (
    <li>
      <strong>{lead}</strong>
      {rest ? <> {rest}</> : null}
    </li>
  )
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

      <SectionNav />

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

      <article id="section-financial-health" className="card sectionAnchor">
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

      <article id="section-bull-bear" className="card sectionAnchor">
        <h3>4. Bull / bear case</h3>
        <div className="split bullBearSplit">
          <div className="caseColumn caseColumn--bull">
            <h4>Bull case</h4>
            <ul className="caseList">
              {result.bull_bear.bull.map((item) => (
                <CaseBullet key={`bull-${item}`} text={item} />
              ))}
            </ul>
          </div>
          <div className="caseColumn caseColumn--bear">
            <h4>Bear case</h4>
            <ul className="caseList">
              {result.bull_bear.bear.map((item) => (
                <CaseBullet key={`bear-${item}`} text={item} />
              ))}
            </ul>
          </div>
        </div>
      </article>

      <article id="section-risks" className="card sectionAnchor">
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

      <article id="section-external-signals" className="card sectionAnchor">
        <h3>6. External signals</h3>
        <p>
          <strong>Sentiment:</strong> {result.external_signals.sentiment}
        </p>
        <ScannableProse text={result.external_signals.summary} />
        <AnalystRatingsTable items={result.external_signals.notable_endorsements_or_criticism} />
        <div id="section-recent-news" className="sectionAnchor">
          <p className="subsectionLabel">Recent news</p>
          <NewsList items={result.external_signals.recent_news} />
        </div>
      </article>
    </section>
  )
}
