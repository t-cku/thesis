import { parseAnalystRating } from '../formatting'

interface AnalystRatingsTableProps {
  items: string[]
}

export function AnalystRatingsTable({ items }: AnalystRatingsTableProps) {
  if (items.length === 0) return null

  const rows = items.map(parseAnalystRating)

  return (
    <div className="ratingsWrap">
      <p className="subsectionLabel">Analyst ratings</p>
      <table className="ratingsTable">
        <thead>
          <tr>
            <th scope="col">Firm</th>
            <th scope="col">Rating</th>
            <th scope="col">Price Target</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.raw}>
              <td data-label="Firm">{row.firm}</td>
              <td data-label="Rating">{row.rating}</td>
              <td data-label="Price Target">{row.priceTarget}</td>
              <td data-label="Date">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
