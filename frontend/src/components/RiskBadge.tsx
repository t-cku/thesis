import type { RiskCategory } from '../formatting'
import { RISK_CATEGORY_LABELS } from '../formatting'

interface RiskBadgeProps {
  category: RiskCategory
}

export function RiskBadge({ category }: RiskBadgeProps) {
  return (
    <span className={`riskBadge riskBadge--${category}`}>{RISK_CATEGORY_LABELS[category]}</span>
  )
}
