import { splitScannableProse } from '../formatting'

interface ScannableProseProps {
  text: string
}

export function ScannableProse({ text }: ScannableProseProps) {
  const { paragraphs, bullets } = splitScannableProse(text)

  if (paragraphs.length === 0 && bullets.length === 0) {
    return null
  }

  return (
    <div className="scannableProse">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {bullets.length > 0 && (
        <ul className="scanBullets">
          {bullets.map((bullet) => (
            <li key={`${bullet.label}-${bullet.text}`}>
              {bullet.label ? (
                <>
                  <strong>{bullet.label}:</strong> {bullet.text}
                </>
              ) : (
                bullet.text
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
