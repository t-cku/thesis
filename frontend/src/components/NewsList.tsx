import { inferNewsTone } from '../formatting'

interface NewsListProps {
  items: string[]
}

export function NewsList({ items }: NewsListProps) {
  if (items.length === 0) return null

  return (
    <ul className="newsList">
      {items.map((item) => {
        const tone = inferNewsTone(item)
        return (
          <li key={item} className={`newsItem newsItem--${tone}`}>
            <span className="newsToneIcon" aria-hidden="true">
              {tone === 'positive' ? '▲' : tone === 'negative' ? '▼' : '•'}
            </span>
            <span>{item}</span>
          </li>
        )
      })}
    </ul>
  )
}
