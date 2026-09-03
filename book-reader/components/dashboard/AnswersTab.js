'use client'

import { Card, SectionTitle, EmptyState, BarList, fmtRelative } from './ui'

// Survey results, chapter by chapter: average rating, how well it was followed,
// and every open answer in full.
export default function AnswersTab({ data }) {
  const withResponses = data.chaptersInsight.filter((c) => c.survey && c.survey.responses > 0)

  if (!withResponses.length) {
    return (
      <Card className="p-5">
        <EmptyState
          emoji="📝"
          title="Nog geen antwoorden"
          hint="Aan het eind van elk hoofdstuk krijgt de lezer een kort kaartje met een cijfer, 'was alles te volgen?' en een open vraag."
        />
      </Card>
    )
  }

  const ratingBars = withResponses.map((c) => ({
    label: `${c.number}. ${c.title}`,
    value: c.survey.avgRating || 0,
    display: c.survey.avgRating ? `${c.survey.avgRating}/5` : '—',
  }))

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle hint="gemiddeld cijfer per hoofdstuk">Waardering</SectionTitle>
        <BarList items={ratingBars} />
      </Card>

      {withResponses.map((c) => {
        const s = c.survey
        const totalComp = Object.values(s.comprehension).reduce((a, b) => a + b, 0)
        return (
          <Card key={c.number} className="p-5">
            <SectionTitle hint={`${s.responses} ${s.responses === 1 ? 'antwoord' : 'antwoorden'}`}>
              {c.number}. {c.title}
            </SectionTitle>

            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                  Cijfer
                </p>
                <p className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
                  {s.avgRating != null ? `${s.avgRating}` : '—'}
                  <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>/5</span>
                </p>
              </div>

              <div className="min-w-[12rem] flex-1">
                <p className="mb-1.5 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                  Was alles te volgen?
                </p>
                {totalComp === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>—</p>
                ) : (
                  <div className="flex h-3 overflow-hidden rounded-full" style={{ background: 'var(--rule)' }}>
                    {[
                      { key: 'ja', color: '#7d9b6a' },
                      { key: 'grotendeels', color: 'var(--accent)' },
                      { key: 'niet_echt', color: '#c0532f' },
                    ].map((seg) => {
                      const n = s.comprehension[seg.key] || 0
                      if (!n) return null
                      return (
                        <div
                          key={seg.key}
                          title={`${seg.key}: ${n}`}
                          style={{ width: `${(n / totalComp) * 100}%`, background: seg.color }}
                        />
                      )
                    })}
                  </div>
                )}
                <div className="mt-1.5 flex gap-3 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  <span>ja {s.comprehension.ja || 0}</span>
                  <span>grotendeels {s.comprehension.grotendeels || 0}</span>
                  <span>niet echt {s.comprehension.niet_echt || 0}</span>
                </div>
              </div>
            </div>

            {s.open.length > 0 && (
              <div className="mt-4 space-y-2">
                {s.open.map((text, i) => (
                  <p
                    key={i}
                    className="rounded-xl p-3 text-sm italic"
                    style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  >
                    “{text}”
                  </p>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
