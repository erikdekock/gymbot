'use client'

import { useState } from 'react'
import { Card, SectionTitle, EmptyState, Badge, fmtRelative, fmtDateTime } from './ui'

// The questions inbox. Reply is a plain mailto: — the author answers from their
// own mail client, and the thread stays where they already live.
export default function QuestionsTab({ data, onAction }) {
  const [filter, setFilter] = useState('open')
  const [busy, setBusy] = useState(null)

  const rows = data.questions.filter((q) =>
    filter === 'all' ? true : filter === 'open' ? q.status !== 'answered' : q.status === 'answered'
  )

  const act = async (id, action) => {
    setBusy(id)
    await onAction(id, action)
    setBusy(null)
  }

  const FILTERS = [
    { key: 'open', label: `Open (${data.questions.filter((q) => q.status !== 'answered').length})` },
    { key: 'answered', label: 'Beantwoord' },
    { key: 'all', label: 'Alles' },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="rounded-full px-3 py-1.5 text-xs transition-colors"
            style={{
              background: filter === f.key ? 'var(--accent)' : 'var(--panel)',
              color: filter === f.key ? '#fff' : 'var(--ink-soft)',
              border: '1px solid var(--rule)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card className="p-5">
          <EmptyState emoji="❓" title="Nog geen vragen" hint="Lezers kunnen een passage selecteren en er een vraag bij stellen. Die komt hier en in je mail." />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((q) => {
            const subject = encodeURIComponent(`Re: je vraag bij hoofdstuk ${q.chapter_number}`)
            const body = encodeURIComponent(`\n\n---\nJe vroeg:\n"${q.question}"\n`)
            return (
              <Card key={q.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-display text-[15px]" style={{ color: 'var(--ink)' }}>
                    {q.readerName}
                    <span className="ml-2 text-xs" style={{ color: 'var(--ink-soft)' }}>{q.readerEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.email_failed && <Badge color="#c0532f" title={q.email_error || ''}>mail mislukt</Badge>}
                    <Badge color={q.status === 'answered' ? '#5f7d52' : 'var(--accent)'}>
                      {q.status === 'answered' ? 'beantwoord' : 'open'}
                    </Badge>
                    <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{fmtRelative(q.created_at)}</span>
                  </div>
                </div>

                <p className="mt-1 text-[11px]" style={{ color: 'var(--accent)' }}>
                  Hoofdstuk {q.chapter_number} · {q.chapterTitle} · locatie {q.location ?? '—'} van{' '}
                  {data.totalLocations} · {q.percent}% door het boek
                </p>

                {q.selected_text && (
                  <blockquote className="mt-3 border-l-2 pl-3 text-sm italic" style={{ borderColor: 'var(--accent)', color: 'var(--ink-soft)' }}>
                    {q.selected_text}
                  </blockquote>
                )}

                <p className="mt-3 whitespace-pre-wrap text-sm" style={{ color: 'var(--ink)' }}>
                  {q.question}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a
                    href={`mailto:${q.readerEmail}?subject=${subject}&body=${body}`}
                    className="rounded-full px-4 py-1.5 text-xs text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    Antwoord per mail
                  </a>
                  <button
                    onClick={() => act(q.id, q.status === 'answered' ? 'reopen' : 'answer')}
                    disabled={busy === q.id}
                    className="rounded-full px-3 py-1.5 text-xs disabled:opacity-50"
                    style={{ border: '1px solid var(--rule)', color: 'var(--ink-soft)' }}
                  >
                    {q.status === 'answered' ? 'Heropen' : 'Markeer beantwoord'}
                  </button>
                  {q.email_failed && (
                    <button
                      onClick={() => act(q.id, 'retry_email')}
                      disabled={busy === q.id}
                      className="rounded-full px-3 py-1.5 text-xs disabled:opacity-50"
                      style={{ border: '1px solid var(--rule)', color: 'var(--ink-soft)' }}
                    >
                      Verstuur mail opnieuw
                    </button>
                  )}
                  {q.answered_at && (
                    <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      beantwoord {fmtDateTime(q.answered_at)}
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
