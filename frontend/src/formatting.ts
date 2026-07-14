export type RiskCategory = 'regulatory' | 'competitive' | 'macro' | 'execution' | 'other'

export type NewsTone = 'positive' | 'negative' | 'neutral'

export interface ScannableBlock {
  paragraphs: string[]
  bullets: Array<{ label: string; text: string }>
}

export interface AnalystRatingRow {
  firm: string
  rating: string
  priceTarget: string
  date: string
  raw: string
  structured: boolean
}

const PROSE_LABEL_PATTERN =
  /^((?:Net|Gross|Operating)\s+margin|Revenue(?:\s+growth)?|P\/E(?:\s+ratio)?|Forward\s+P\/E|Valuation(?:\s+is)?|Debt|Cash(?:\s+and\s+equivalents)?|Free\s+cash\s+flow|FCF|Market\s+cap|Balance\s+sheet|Margins?|Growth|Profitability|Liquidity|Leverage|Earnings|Cash\s+flow|EPS|Dividend)(?::|\s+is\b|\s+remains\b|\s+looks\b|\s+appears\b|\s+suggests\b)/i

const RATING_VALUES =
  /\b(Strong\s+Buy|Outperform|Overweight|Buy|Hold|Neutral|Equal[\s-]Weight|Underperform|Underweight|Sell|Positive|Negative|Market\s+Perform)\b/i

const PRICE_TARGET_PATTERN =
  /(?:price\s+target|PT|target(?:\s+price)?)\s*(?:of|:)?\s*[$]?\s*([\d,.]+(?:\s*(?:billion|million|B|M))?)/i

const DATE_PATTERN =
  /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|Q[1-4]\s+\d{4})\b/i

const POSITIVE_NEWS =
  /\b(surge|soar|rally|gain|beat|exceed|upgrade|upgraded|record|growth|bullish|positive|strong|raise|raised|outperform|approval|win|wins|partnership|launch|expansion|profit)\b/i

const NEGATIVE_NEWS =
  /\b(plunge|drop|fall|decline|miss|missed|downgrade|downgraded|lawsuit|investigation|bearish|negative|cut|cuts|layoff|recall|warning|weak|loss|losses|probe|fine|penalty)\b/i

function splitSentences(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  return trimmed
    .split(/(?<=[.!?])\s+(?=[A-Z"(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function extractLabel(sentence: string): { label: string; text: string } | null {
  const colonMatch = sentence.match(/^([^:]{2,40}):\s*(.+)$/s)
  if (colonMatch) {
    return { label: colonMatch[1].trim(), text: colonMatch[2].trim() }
  }

  const labelMatch = sentence.match(PROSE_LABEL_PATTERN)
  if (!labelMatch) return null

  const label = labelMatch[1].trim()
  const remainder = sentence.slice(labelMatch[0].length).replace(/^:\s*/, '').trim()
  const text = remainder || sentence

  return { label, text }
}

export function splitScannableProse(text: string): ScannableBlock {
  const sentences = splitSentences(text)
  if (sentences.length <= 1) {
    return { paragraphs: text.trim() ? [text.trim()] : [], bullets: [] }
  }

  const paragraphs: string[] = []
  const bullets: Array<{ label: string; text: string }> = []

  for (const sentence of sentences) {
    const labeled = extractLabel(sentence)
    if (labeled) {
      bullets.push(labeled)
      continue
    }

    if (bullets.length === 0 && paragraphs.length < 2) {
      paragraphs.push(sentence)
    } else if (bullets.length === 0) {
      bullets.push({ label: '', text: sentence })
    } else {
      bullets.push({ label: '', text: sentence })
    }
  }

  if (paragraphs.length === 0 && bullets.length > 0) {
    const [first, ...rest] = bullets
    if (!first.label) {
      paragraphs.push(first.text)
      bullets.splice(0, 1)
      if (rest.length === 0) {
        return { paragraphs, bullets: [] }
      }
    }
  }

  return { paragraphs, bullets }
}

function extractPriceTarget(text: string): string {
  const match = text.match(PRICE_TARGET_PATTERN)
  if (!match?.[1]) return ''
  return `$${match[1].replace(/^\$/, '')}`
}

function extractDate(text: string): string {
  return text.match(DATE_PATTERN)?.[1]?.trim() ?? ''
}

function extractRating(text: string): string {
  return text.match(RATING_VALUES)?.[1] ?? ''
}

function extractFirm(text: string, rating: string, priceTarget: string, date: string): string {
  let firm = text

  if (date) firm = firm.replace(date, '')
  if (priceTarget) firm = firm.replace(priceTarget, '')
  if (rating) firm = firm.replace(new RegExp(rating, 'i'), '')

  firm = firm
    .replace(PRICE_TARGET_PATTERN, '')
    .replace(/(?:rated|rates|with|at|as of|—|-|:|,|\(|\))/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const commaParts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (commaParts.length >= 2 && !firm) {
    return commaParts[0]
  }

  return firm || text
}

function looksLikePriceTarget(value: string): boolean {
  return /^\$?\s*[\d,.]+/.test(value.trim()) || /price\s+target|PT\b/i.test(value)
}

function looksLikeDate(value: string): boolean {
  return DATE_PATTERN.test(value.trim())
}

function looksLikeRating(value: string): boolean {
  return RATING_VALUES.test(value.trim()) && value.trim().length <= 24
}

export function parseAnalystRating(text: string): AnalystRatingRow {
  const rating = extractRating(text)
  const priceTarget = extractPriceTarget(text)
  const date = extractDate(text)

  // Only treat as a structured rating row when we found real rating/PT signals.
  // Never comma-split free-form commentary into fake columns.
  const structured = Boolean(rating || priceTarget)
  if (structured) {
    const firm = extractFirm(text, rating, priceTarget, date)
    return {
      firm: firm || text,
      rating: rating || '—',
      priceTarget: priceTarget || '—',
      date: date || '—',
      raw: text,
      structured: true,
    }
  }

  const commaParts = text.split(',').map((part) => part.trim()).filter(Boolean)
  if (
    commaParts.length >= 3 &&
    looksLikeRating(commaParts[1] ?? '') &&
    (looksLikePriceTarget(commaParts[2] ?? '') || looksLikeDate(commaParts[2] ?? ''))
  ) {
    return {
      firm: commaParts[0] || text,
      rating: commaParts[1] || '—',
      priceTarget: looksLikePriceTarget(commaParts[2] ?? '') ? commaParts[2] : '—',
      date: commaParts[3] || (looksLikeDate(commaParts[2] ?? '') ? commaParts[2] : '—'),
      raw: text,
      structured: true,
    }
  }

  return { firm: text, rating: '—', priceTarget: '—', date: '—', raw: text, structured: false }
}

export function inferNewsTone(text: string): NewsTone {
  const positive = POSITIVE_NEWS.test(text)
  const negative = NEGATIVE_NEWS.test(text)

  if (positive && !negative) return 'positive'
  if (negative && !positive) return 'negative'
  return 'neutral'
}

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  regulatory: 'Regulatory',
  competitive: 'Competitive',
  macro: 'Macro',
  execution: 'Execution',
  other: 'Other',
}
