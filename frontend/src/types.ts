import type { RiskCategory } from './formatting'

export type Sentiment = 'bullish' | 'bearish' | 'neutral' | 'mixed'

export interface NewsItem {
  text: string
  source: string
  date: string
}

export interface OnePager {
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
    key_competitors: Array<string | { name?: string; company?: string; ticker?: string | null; description?: string | null }>
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
    recent_news: NewsItem[]
    notable_endorsements_or_criticism: string[]
  }
}

export interface User {
  id: number
  email: string
  name: string | null
  email_verified: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
  message?: string | null
  verification_url?: string | null
}

export interface SavedThesisSummary {
  id: number
  ticker: string
  company_name: string
  generated_at: string
  saved_at: string
}

export interface SavedThesisDetail {
  id: number
  ticker: string
  company_name: string
  saved_at: string
  one_pager: OnePager
}
