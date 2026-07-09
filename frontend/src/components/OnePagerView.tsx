import { useMemo } from 'react'
import type { OnePager } from '../types'
import { AnalystRatingsTable } from './AnalystRatingsTable'
import { NewsList } from './NewsList'
import { RiskBadge } from './RiskBadge'
import { ScannableProse } from './ScannableProse'

interface OnePagerViewProps {
  result: OnePager
}

export function OnePagerView({ result }: OnePagerViewProps) {
  const generatedTime = useMemo(() => {
    if (!result.generated_at) return null
    return new Date(result.generated_at).toLocaleString()
  }, [result.generated_at])

  return (
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
  )
}
