'use client'

import { Card, SectionTitle, BarList, RetentionBars, EmptyState, fmtDuration } from './ui'

// The book, not the people — and measured in LOCATIONS, so nothing here
// depends on anyone's screen size.
export default function StoryInsightsTab({ data }) {
  const ch = data.chaptersInsight
  const buckets = data.buckets || []

  if (!ch.length) {
    return (
      <Card className="p-5">
        <EmptyState emoji="📚" title="No chapter data yet" hint="Once readers move through the book, you'll see where attention and highlights cluster." />
      </Card>
    )
  }

  const heat = ch.map((c) => ({ label: `${c.number}. ${c.title}`, value: c.interactions, display: c.interactions }))
  const time = ch.map((c) => ({ label: `${c.number}. ${c.title}`, value: c.avgSeconds, display: fmtDuration(c.avgSeconds) }))
  const stalls = ch.map((c) => ({ label: `${c.number}. ${c.title}`, value: c.stalls, display: c.stalls }))
  const rereads = ch.map((c) => ({ label: `${c.number}. ${c.title}`, value: c.rereads, display: c.rereads }))
  const copies = ch.map((c) => ({ label: `${c.number}. ${c.title}`, value: c.copies, display: c.copies }))
  const slowest = ch.slice().sort((a, b) => b.avgSeconds - a.avgSeconds)[0]

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <SectionTitle hint="% of readers who reached each chapter">Retention</SectionTitle>
        <RetentionBars chapters={ch} />
        {data.dropOff && (
          <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}>
            <span className="mr-1">📉</span>
            Biggest drop-off is around <strong>locatie {data.dropOff.fromLocation}</strong>
            {data.dropOff.chapter ? ` (hoofdstuk ${data.dropOff.chapter})` : ''} — {data.dropOff.lost} reader
            {data.dropOff.lost > 1 ? 's' : ''} stop there.
          </div>
        )}
      </Card>

      {/* Location-resolution maps, finer than per chapter */}
      <Card className="p-5">
        <SectionTitle hint="per location band — taller means more">Stall &amp; reread map</SectionTitle>
        {buckets.length === 0 ? (
          <EmptyState title="No location data yet" hint="Stalls and rereads appear once readers generate events." />
        ) : (
          <>
            <LocationStrip buckets={buckets} field="stalls" color="#c0532f" label="Stalls" />
            <LocationStrip buckets={buckets} field="rereads" color="var(--accent)" label="Rereads" />
            <LocationStrip buckets={buckets} field="copies" color="#5f7d52" label="Copies" />
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle hint="highlights + likes + comments">Chapter heat map</SectionTitle>
          <BarList items={heat} emptyHint="No highlights or likes captured yet." />
        </Card>
        <Card className="p-5">
          <SectionTitle hint={slowest ? `slowest: ${slowest.title}` : ''}>Avg. reading time</SectionTitle>
          <BarList items={time} color="#9a7b53" emptyHint="No reading time recorded yet." />
        </Card>
        <Card className="p-5">
          <SectionTitle hint="where readers get stuck">Stalls by chapter</SectionTitle>
          <BarList items={stalls} color="#c0532f" emptyHint="No stalls detected yet." />
        </Card>
        <Card className="p-5">
          <SectionTitle hint="where readers go back">Rereads by chapter</SectionTitle>
          <BarList items={rereads} emptyHint="No rereads detected yet." />
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle hint="what people copy out">Copy heat map</SectionTitle>
        <BarList items={copies} color="#5f7d52" emptyHint="Nothing copied yet." />
      </Card>

      <Card className="p-5">
        <SectionTitle hint="most highlighted, liked & copied">These sentences land</SectionTitle>
        {data.topPassages.length === 0 ? (
          <EmptyState emoji="✨" title="No highlighted passages yet" hint="When readers highlight, like or copy a sentence, it surfaces here." />
        ) : (
          <ol className="space-y-2">
            {data.topPassages.map((p, i) => (
              <li key={i} className="flex gap-3 rounded-xl p-3" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <span className="font-display text-lg" style={{ color: 'var(--accent)' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm italic" style={{ color: 'var(--ink)' }}>&ldquo;{p.passage}&rdquo;</p>
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    Hoofdstuk {p.chapter} · {p.count}× ({p.highlights} highlights, {p.likes} likes, {p.copies} copies)
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

// A thin strip across the whole book: one cell per location band.
function LocationStrip({ buckets, field, color, label }) {
  const max = Math.max(1, ...buckets.map((b) => b[field]))
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </p>
      <div className="flex gap-[2px]">
        {buckets.map((b, i) => (
          <div
            key={i}
            title={`Locatie ${b.from}–${b.to}: ${b[field]}`}
            className="h-8 flex-1 rounded-sm"
            style={{
              background: b[field] ? color : 'var(--rule)',
              opacity: b[field] ? 0.25 + (b[field] / max) * 0.75 : 0.5,
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--ink-soft)' }}>
        <span>locatie {buckets[0]?.from ?? 1}</span>
        <span>{buckets[buckets.length - 1]?.to ?? ''}</span>
      </div>
    </div>
  )
}
