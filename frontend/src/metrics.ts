export type MetricFormat = 'currency' | 'percent' | 'ratio' | 'number'
export type MetricTone = 'positive' | 'warning' | 'negative' | 'neutral'

export const METRIC_CONFIG: Array<{
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

export function formatMetricValue(
  value: number | string | null | undefined,
  format: MetricFormat,
): string {
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

export function metricTone(
  metricKey: string,
  value: number | string | null | undefined,
): MetricTone {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'neutral'

  if (metricKey === 'total_debt') {
    if (value <= 0) return 'positive'
    if (value > 100_000_000_000) return 'negative'
    return 'warning'
  }

  if (
    metricKey === 'pe_ratio' ||
    metricKey === 'forward_pe' ||
    metricKey === 'price_to_sales' ||
    metricKey === 'ev_to_ebitda'
  ) {
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
