'use client'

// Shared dashboard primitives + formatters. Everything uses the same warm-paper
// CSS variables as the reader, so the command center feels of a piece with it.

export function fmtDuration(seconds) {
  const s = Math.round(seconds || 0)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtRelative(iso) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (isNaN(then)) return '—'
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return fmtDate(iso)
}

export function Card({ children, className = '', style, ...rest }) {
  return (
    <div className={`panel rounded-2xl ${className}`} style={style} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-3 mt-1 flex items-baseline justify-between">
      <h3 className="font-display text-lg" style={{ color: 'var(--ink)' }}>
        {children}
      </h3>
      {hint && (
        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

export function StatCard({ label, value, sub, emoji }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--ink-soft)' }}>
          {label}
        </span>
        {emoji && <span className="text-sm opacity-70">{emoji}</span>}
      </div>
      <div className="mt-1 font-display text-3xl leading-tight" style={{ color: 'var(--ink)' }}>
        {value}
      </div>
      {sub != null && (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
          {sub}
        </div>
      )}
    </Card>
  )
}

export function Badge({ children, color, title }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
      style={{ background: 'var(--paper-edge)', color: color || 'var(--ink-soft)' }}
    >
      {children}
    </span>
  )
}

export function TierBadge({ tier, score }) {
  if (!tier) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: 'var(--paper-edge)', color: tier.color }}
    >
      <span>{tier.emoji}</span>
      <span>{tier.label}</span>
      {score != null && <span className="opacity-60">· {score}</span>}
    </span>
  )
}

export function Avatar({ name, size = 40 }) {
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-display"
      style={{
        width: size,
        height: size,
        background: 'var(--paper-edge)',
        color: 'var(--accent)',
        fontSize: size * 0.4,
      }}
    >
      {initials || '?'}
    </div>
  )
}

export function EmptyState({ emoji = '🌱', title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-3xl opacity-70">{emoji}</div>
      <p className="mt-3 font-display text-base" style={{ color: 'var(--ink)' }}>
        {title}
      </p>
      {hint && (
        <p className="mt-1 max-w-xs text-sm" style={{ color: 'var(--ink-soft)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

// A labelled horizontal bar list (heat maps, time-per-chapter, etc.).
export function BarList({ items, color = 'var(--accent)', emptyHint }) {
  const max = Math.max(1, ...items.map((i) => i.value || 0))
  if (!items.length) return <EmptyState title="Nothing here yet" hint={emptyHint} />
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-xs" style={{ color: 'var(--ink-soft)' }} title={it.label}>
            {it.label}
          </div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--rule)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${((it.value || 0) / max) * 100}%`, background: it.color || color }}
            />
          </div>
          <div className="w-14 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--ink)' }}>
            {it.display != null ? it.display : it.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// Tiny SVG line chart with optional second series. points: [{label, y, y2}].
export function LineChart({ points, height = 120, color = 'var(--accent)', color2 }) {
  if (!points || points.length === 0) return <EmptyState title="No trend yet" />
  const w = 600
  const h = height
  const pad = 8
  const ys = points.flatMap((p) => [p.y, p.y2].filter((v) => v != null))
  const maxY = Math.max(1, ...ys)
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const xy = (i, y) => [pad + i * stepX, h - pad - (y / maxY) * (h - pad * 2)]
  const line = (key) =>
    points
      .map((p, i) => {
        if (p[key] == null) return null
        const [x, y] = xy(i, p[key])
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .filter(Boolean)
      .join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {color2 && <polyline fill="none" stroke={color2} strokeWidth="2" strokeOpacity="0.5" points={line('y2')} />}
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={line('y')} />
        {points.map((p, i) => {
          const [x, y] = xy(i, p.y)
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--ink-soft)' }}>
        {points.map((p, i) => (
          <span key={i} className={points.length > 8 && i % 2 ? 'opacity-0' : ''}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Vertical retention bars (one per chapter).
export function RetentionBars({ chapters }) {
  if (!chapters.length) return <EmptyState title="No retention data yet" />
  return (
    <div className="flex items-end gap-1.5" style={{ height: 140 }}>
      {chapters.map((c) => (
        <div key={c.number} className="flex h-full flex-1 flex-col items-center justify-end" title={`${c.title}: ${c.retentionPct}%`}>
          <div className="mb-1 text-[10px] tabular-nums" style={{ color: 'var(--ink-soft)' }}>
            {c.retentionPct}%
          </div>
          <div
            className="w-full rounded-t"
            style={{
              height: `${Math.max(2, c.retentionPct)}%`,
              background: 'var(--accent)',
              opacity: 0.35 + (c.retentionPct / 100) * 0.65,
            }}
          />
          <div className="mt-1 text-[10px]" style={{ color: 'var(--ink-soft)' }}>
            {c.number}
          </div>
        </div>
      ))}
    </div>
  )
}

export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
