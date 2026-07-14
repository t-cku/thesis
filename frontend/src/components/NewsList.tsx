import { inferNewsTone } from '../formatting'
import type { NewsItem } from '../types'

interface NewsListProps {
  items: NewsItem[]
}

function formatNewsDate(value: string): string {
  // Prefer date-only parsing to avoid timezone shifting calendar days.
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function NewsList({ items }: NewsListProps) {
  if (items.length === 0) return null

  return (
    <ul className="newsList">
      {items.map((item) => {
        const tone = inferNewsTone(item.text)
        const attribution = `${item.source}, ${formatNewsDate(item.date)}`
        return (
          <li key={`${item.source}-${item.date}-${item.text}`} className={`newsItem newsItem--${tone}`}>
            <span className="newsToneIcon" aria-hidden="true">
              {tone === 'positive' ? '▲' : tone === 'negative' ? '▼' : '•'}
            </span>
            <div className="newsBody">
              <span className="newsText">{item.text}</span>
              <span className="newsMeta">{attribution}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
