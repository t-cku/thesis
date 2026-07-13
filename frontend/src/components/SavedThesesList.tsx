import { useEffect, useState } from 'react'
import { deleteThesis, getThesis, listTheses } from '../api'
import { useAuth } from '../context/AuthContext'
import type { OnePager, SavedThesisSummary } from '../types'
import { OnePagerView } from './OnePagerView'

interface SavedThesesListProps {
  onViewingChange?: (viewing: boolean) => void
  onAnalyzeTicker?: (ticker: string) => void
}

export function SavedThesesList({ onViewingChange, onAnalyzeTicker }: SavedThesesListProps) {
  const { token } = useAuth()
  const [theses, setTheses] = useState<SavedThesisSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<OnePager | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  async function loadTheses() {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const rows = await listTheses(token)
      setTheses(rows)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load saved theses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTheses()
  }, [token])

  useEffect(() => {
    onViewingChange?.(selected !== null)
  }, [selected, onViewingChange])

  async function handleOpen(thesisId: number) {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const detail = await getThesis(token, thesisId)
      setSelected(detail.one_pager)
      setSelectedId(thesisId)
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Failed to open thesis')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(thesisId: number) {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      await deleteThesis(token, thesisId)
      if (selectedId === thesisId) {
        setSelected(null)
        setSelectedId(null)
      }
      await loadTheses()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete thesis')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <section className="savedPanel">
        <h2>Your saved theses</h2>
        <p className="muted">Log in or create an account to save and revisit analyses.</p>
      </section>
    )
  }

  if (selected) {
    return (
      <section className="savedPanel">
        <div className="savedHeader">
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              setSelected(null)
              setSelectedId(null)
            }}
          >
            Back to saved list
          </button>
        </div>
        <OnePagerView result={selected} onAnalyzeTicker={onAnalyzeTicker} />
      </section>
    )
  }

  return (
    <section className="savedPanel">
      <div className="savedHeader">
        <h2>Your saved theses</h2>
        <button type="button" className="secondaryButton" onClick={() => void loadTheses()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && theses.length === 0 ? (
        <p className="muted">Loading saved theses...</p>
      ) : theses.length === 0 ? (
        <p className="muted">No saved theses yet. Analyze a ticker and click Save to keep it here.</p>
      ) : (
        <ul className="savedList">
          {theses.map((thesis) => (
            <li key={thesis.id} className="savedItem">
              <div>
                <p className="savedTitle">
                  {thesis.company_name} ({thesis.ticker})
                </p>
                <p className="muted">
                  Generated {new Date(thesis.generated_at).toLocaleString()} · Saved{' '}
                  {new Date(thesis.saved_at).toLocaleString()}
                </p>
              </div>
              <div className="savedActions">
                <button type="button" onClick={() => void handleOpen(thesis.id)} disabled={loading}>
                  Open
                </button>
                <button
                  type="button"
                  className="dangerButton"
                  onClick={() => void handleDelete(thesis.id)}
                  disabled={loading}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
