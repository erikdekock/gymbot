'use client'

import { useMemo, useState } from 'react'
import { Card, Avatar, TierBadge, Badge, EmptyState, SectionTitle, fmtRelative, fmtDateTime, fmtDuration, downloadCsv } from './ui'
import { BREAKDOWN_LABELS } from '../../lib/engagement'

const SORTS = [
  { key: 'engagement', label: 'Most engaged' },
  { key: 'recent', label: 'Recently active' },
  { key: 'progress', label: 'Progress' },
  { key: 'name', label: 'Name' },
]
const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'superfan', label: '🔥 Superfans' },
  { key: 'subscribed', label: '✉️ Subscribed' },
  { key: 'shared', label: '↗️ Shared' },
  { key: 'feedback', label: '💬 Feedback' },
]

export default function ReadersTab({ data }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('engagement')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const people = useMemo(() => {
    let list = data.people.slice()
    const needle = q.trim().toLowerCase()
    if (needle) list = list.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(needle))
    if (filter === 'superfan') list = list.filter((p) => p.engagement.tier.key === 'superfan')
    else if (filter === 'subscribed') list = list.filter((p) => p.subscribed)
    else if (filter === 'shared') list = list.filter((p) => p.shared)
    else if (filter === 'feedback') list = list.filter((p) => p.gaveFeedback)

    list.sort((a, b) => {
      if (sort === 'engagement') return b.engagement.score - a.engagement.score
      if (sort === 'recent') return new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0)
      if (sort === 'progress') return b.progressPct - a.progressPct
      return a.displayName.localeCompare(b.displayName)
    })
    return list
  }, [data.people, q, sort, filter])

  const exportReaders = () => {
    const rows = [['name', 'email', 'engagement_score', 'tier', 'progress_pct', 'finished', 'time', 'highlights', 'comments', 'likes', 'subscribed', 'shared', 'last_seen']]
    data.people.forEach((p) =>
      rows.push([p.name, p.email, p.engagement.score, p.engagement.tier.label, p.progressPct, p.finished ? 'yes' : 'no', fmtDuration(p.timeSpentSeconds), p.counts.highlights, p.counts.comments, p.counts.likes, p.subscribed ? 'yes' : 'no', p.shared ? 'yes' : 'no', p.lastSeen])
    )
    downloadCsv(`readers-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="min-w-[180px] flex-1 rounded-full px-4 py-2 text-sm outline-none"
          style={{ background: 'var(--panel)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-full px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--panel)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button onClick={exportReaders} className="rounded-full px-4 py-2 text-sm text-white" style={{ background: 'var(--accent)' }}>
          Export CSV
        </button>
      </div>

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

      {people.length === 0 ? (
        <EmptyState emoji="👋" title="No readers match" hint="Share a /read?id=… link to start building your fanbase." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <PersonCard key={p.id} p={p} onClick={() => setSelected(p)} />
          ))}
        </div>
      )}

      {selected && <ProfileDrawer p={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function PersonCard({ p, onClick }) {
  return (
    <Card className="cursor-pointer p-4 transition-shadow hover:shadow-lg" onClick={onClick}>
      <div className="flex items-start gap-3">
        <Avatar name={p.displayName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate font-display text-[15px]" style={{ color: 'var(--ink)' }}>
              {p.displayName}
            </div>
            <TierBadge tier={p.engagement.tier} score={p.engagement.score} />
          </div>
          {p.email && p.name && (
            <div className="truncate text-xs" style={{ color: 'var(--ink-soft)' }}>
              {p.email}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--rule)' }}>
              <div className="h-full rounded-full" style={{ width: `${p.progressPct}%`, background: 'var(--accent)' }} />
            </div>
            <span className="text-xs tabular-nums" style={{ color: 'var(--ink-soft)' }}>
              {p.progressPct}%
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            <span>{p.finished ? 'Finished' : `Ch. ${p.currentChapter}`}</span>
            <span>·</span>
            <span>{fmtDuration(p.timeSpentSeconds)}</span>
            <span>·</span>
            <span>{fmtRelative(p.lastSeen)}</span>
            {p.subscribed && <Badge title="Subscribed to Het Zal">✉️</Badge>}
            {p.shared && <Badge title="Shared the book">↗️</Badge>}
            {p.gaveFeedback && <Badge title="Left feedback">💬</Badge>}
          </div>
        </div>
      </div>
    </Card>
  )
}

function ProfileDrawer({ p, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'var(--overlay)' }} onClick={onClose}>
      <aside className="panel h-full w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={p.displayName} size={48} />
            <div>
              <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>
                {p.displayName}
              </h2>
              {p.email && p.name && <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{p.email}</p>}
              <div className="mt-1">
                <TierBadge tier={p.engagement.tier} score={p.engagement.score} />
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--ink-soft)' }}>
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniStat label="Complete" value={`${p.progressPct}%`} />
          <MiniStat label="Time" value={fmtDuration(p.timeSpentSeconds)} />
          <MiniStat label="Last seen" value={fmtRelative(p.lastSeen)} />
        </div>

        {/* Engagement breakdown */}
        <Section title="Engagement breakdown">
          <div className="space-y-1.5">
            {Object.entries(p.engagement.breakdown).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0" style={{ color: 'var(--ink-soft)' }}>{BREAKDOWN_LABELS[k]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--rule)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, v * 2.5)}%`, background: 'var(--accent)' }} />
                </div>
                <span className="w-8 text-right tabular-nums text-xs" style={{ color: 'var(--ink)' }}>+{v}</span>
              </div>
            ))}
            <div className="flex justify-end pt-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Total {p.engagement.score}/100
            </div>
          </div>
        </Section>

        {/* Reading journey */}
        <Section title="Reading journey">
          {p.chapterStats.length === 0 ? (
            <Muted>No chapters opened yet.</Muted>
          ) : (
            <div className="space-y-2">
              {p.chapterStats.map((c) => (
                <div key={c.chapter_number} className="rounded-xl p-3" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[15px]" style={{ color: 'var(--ink)' }}>
                      <span className="mr-2 text-xs" style={{ color: 'var(--accent)' }}>{String(c.chapter_number).padStart(2, '0')}</span>
                      {c.chapter_title || `Chapter ${c.chapter_number}`}
                    </span>
                    <span className="text-sm tabular-nums" style={{ color: 'var(--ink)' }}>{fmtDuration(c.time_spent_seconds)}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
                    <span>Read {Math.round(c.max_scroll_pct || 0)}%</span>
                    <span>{c.views || 0} visits</span>
                    <span>{c.page_views || 0} page turns</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Highlights / comments / likes */}
        <Section title={`Highlights & comments (${p.annotations.length})`}>
          {p.annotations.length === 0 ? (
            <Muted>No highlights, comments or likes yet.</Muted>
          ) : (
            <div className="space-y-2">
              {p.annotations.map((a) => (
                <div key={a.id} className="rounded-xl p-3" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                  <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    <span>{a.kind === 'highlight' ? '✏️ Highlight' : a.kind === 'like' ? '❤️ Like' : '💬 Comment'} · {a.chapter_title || `Chapter ${a.chapter_number}`}</span>
                    <span>{fmtRelative(a.created_at)}</span>
                  </div>
                  {a.passage && <p className="text-sm italic" style={{ color: 'var(--ink)' }}>&ldquo;{a.passage}&rdquo;</p>}
                  {a.note && <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{a.note}</p>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Feedback */}
        {p.feedback.length > 0 && (
          <Section title="Feedback">
            <div className="space-y-2">
              {p.feedback.map((f) => (
                <div key={f.id} className="rounded-xl p-3" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                  {f.rating ? <div className="text-sm" style={{ color: 'var(--accent)' }}>{'★'.repeat(f.rating)}{'☆'.repeat(Math.max(0, 5 - f.rating))}</div> : null}
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{f.message}</p>
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-soft)' }}>{fmtDateTime(f.created_at)}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Membership & referrals */}
        <Section title="Membership & referrals">
          <div className="space-y-1.5 text-sm" style={{ color: 'var(--ink)' }}>
            <Row label="Het Zal">
              {p.subscribed ? <span style={{ color: 'var(--accent)' }}>Subscribed {p.subscription?.subscribed_at ? `· ${fmtDateTime(p.subscription.subscribed_at)}` : ''}</span> : <Muted inline>Not subscribed</Muted>}
            </Row>
            <Row label="Referred by">{p.referrerName ? p.referrerName : <Muted inline>Direct visit</Muted>}</Row>
            <Row label="Invited">
              {p.invitees.length ? `${p.invitees.length} reader${p.invitees.length > 1 ? 's' : ''} — ${p.invitees.map((i) => i.name).join(', ')}` : <Muted inline>No one yet</Muted>}
            </Row>
          </div>
        </Section>
      </aside>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mt-6">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  )
}
function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
      <div className="font-display text-base" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>{label}</div>
    </div>
  )
}
function Row({ label, children }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0" style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  )
}
function Muted({ children, inline }) {
  const C = inline ? 'span' : 'p'
  return <C className="text-sm" style={{ color: 'var(--ink-soft)' }}>{children}</C>
}
