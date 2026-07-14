import { useEffect, useState } from 'react'

export const SECTION_NAV_ITEMS = [
  { id: 'section-company-overview', number: 1, label: 'Company overview' },
  { id: 'section-industry-competitors', number: 2, label: 'Industry & competitors' },
  { id: 'section-financial-health', number: 3, label: 'Financial health' },
  { id: 'section-bull-bear', number: 4, label: 'Bull/bear case' },
  { id: 'section-risks', number: 5, label: 'Risks' },
  { id: 'section-external-signals', number: 6, label: 'External signals' },
] as const

export function SectionNav() {
  const [activeId, setActiveId] = useState<string>(SECTION_NAV_ITEMS[0].id)

  useEffect(() => {
    const elements = SECTION_NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    )

    if (elements.length === 0) return

    const visible = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }

        let bestId: string = SECTION_NAV_ITEMS[0].id
        let bestRatio = -1
        for (const item of SECTION_NAV_ITEMS) {
          const ratio = visible.get(item.id) ?? 0
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = item.id
          }
        }

        if (bestRatio <= 0) {
          const offset = window.scrollY + 120
          for (const item of SECTION_NAV_ITEMS) {
            const el = document.getElementById(item.id)
            if (el && el.offsetTop <= offset) {
              bestId = item.id
            }
          }
        }

        setActiveId(bestId)
      },
      {
        root: null,
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    )

    for (const el of elements) {
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  function handleJump(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveId(id)
  }

  return (
    <nav className="sectionNav" aria-label="Section navigation">
      <ul className="sectionNavList">
        {SECTION_NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={activeId === item.id ? 'sectionNavLink active' : 'sectionNavLink'}
              onClick={() => handleJump(item.id)}
            >
              <span className="sectionNavNumber">{item.number}</span>
              <span className="sectionNavLabel">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
