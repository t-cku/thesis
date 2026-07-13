export interface CompetitorInfo {
  name: string
  ticker: string | null
  description: string | null
}

const KNOWN_TICKERS: Record<string, string | null> = {
  apple: 'AAPL',
  microsoft: 'MSFT',
  google: 'GOOGL',
  alphabet: 'GOOGL',
  amazon: 'AMZN',
  'amazon web services': 'AMZN',
  aws: 'AMZN',
  nvidia: 'NVDA',
  tesla: 'TSLA',
  'meta platforms': 'META',
  meta: 'META',
  facebook: 'META',
  netflix: 'NFLX',
  'advanced micro devices': 'AMD',
  amd: 'AMD',
  intel: 'INTC',
  salesforce: 'CRM',
  oracle: 'ORCL',
  ibm: 'IBM',
  qualcomm: 'QCOM',
  broadcom: 'AVGO',
  adobe: 'ADBE',
  spotify: 'SPOT',
  marvell: 'MRVL',
  samsung: '005930.KS',
  huawei: null,
  xiaomi: 'XIACF',
  palantir: 'PLTR',
  snowflake: 'SNOW',
  servicenow: 'NOW',
  uber: 'UBER',
  airbnb: 'ABNB',
  shopify: 'SHOP',
  paypal: 'PYPL',
  block: 'SQ',
  square: 'SQ',
}

const TICKER_BLOCKLIST = new Set([
  'AI',
  'AR',
  'VR',
  'MR',
  'XR',
  'IT',
  'US',
  'UK',
  'EU',
  'CEO',
  'CFO',
  'IPO',
  'ETF',
  'OS',
  'PC',
  'TV',
  'EV',
  'IOT',
  'LLM',
  'ML',
  'TPU',
  'AWS',
  'ASIC',
  'GPU',
  'CPU',
  'FPGA',
  'SOC',
  'HPC',
  'CDN',
  'SaaS',
  'API',
  'NPU',
  'DPU',
])

function lookupKnownTicker(text: string): string | null {
  const lower = text.toLowerCase()
  const entries = Object.entries(KNOWN_TICKERS)
    .filter(([, ticker]) => ticker)
    .sort(([a], [b]) => b.length - a.length)

  for (const [name, ticker] of entries) {
    if (name.length <= 3) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(text)) return ticker
    } else if (lower.includes(name)) {
      return ticker
    }
  }

  return null
}

function resolveTicker(name: string, apiTicker?: string | null): string | null {
  const fromApi = String(apiTicker ?? '').trim().toUpperCase()
  if (fromApi && !TICKER_BLOCKLIST.has(fromApi)) return fromApi

  const parenMatch = name.match(/\(([A-Z]{1,5}(?:\.[A-Z]+)?)\)\s*$/)
  if (parenMatch && !TICKER_BLOCKLIST.has(parenMatch[1])) {
    return parenMatch[1]
  }

  return lookupKnownTicker(name)
}

function toDisplayString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map(toDisplayString).filter(Boolean).join(' ')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['text', 'title', 'headline', 'name', 'company', 'description']) {
      const nested = record[key]
      if (typeof nested === 'string' && nested.trim()) return nested.trim()
    }
  }
  return ''
}

export function normalizeCompetitor(raw: unknown): CompetitorInfo {
  if (typeof raw === 'string') {
    const str = raw.trim()
    const name = str.replace(/\s*\([^)]*\)\s*$/, '').trim()
    return {
      name,
      ticker: resolveTicker(str, null),
      description: str.replace(name, '').replace(/\(\s*\)/, '').trim() || null,
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>
    const name = toDisplayString(record.name ?? record.company)
    const description = toDisplayString(record.description ?? record.context) || null
    const ticker = resolveTicker(name, typeof record.ticker === 'string' ? record.ticker : null)
    return { name, ticker, description }
  }

  return { name: toDisplayString(raw), ticker: null, description: null }
}
