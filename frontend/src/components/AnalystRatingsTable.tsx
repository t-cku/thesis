import { parseAnalystRating } from '../formatting'

interface AnalystRatingsTableProps {
  items: string[]
}

export function AnalystRatingsTable({ items }: AnalystRatingsTableProps) {
  if (items.length === 0) return null

  const rows = items.map(parseAnalystRating)
  const structuredRows = rows.filter((row) => row.structured)
  const proseRows = rows.filter((row) => !row.structured)

  return (
    <div className="ratingsWrap">
      {structuredRows.length > 0 && (
        <>
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
              {structuredRows.map((row) => (
                <tr key={row.raw}>
                  <td data-label="Firm">{row.firm}</td>
                  <td data-label="Rating">{row.rating}</td>
                  <td data-label="Price Target">{row.priceTarget}</td>
                  <td data-label="Date">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {proseRows.length > 0 && (
        <>
          <p className="subsectionLabel">
            {structuredRows.length > 0 ? 'Analyst notes' : 'Analyst notes & commentary'}
          </p>
          <ul className="analystNotesList">
            {proseRows.map((row) => (
              <li key={row.raw}>{row.raw}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
