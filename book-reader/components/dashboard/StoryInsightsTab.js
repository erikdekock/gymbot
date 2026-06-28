'use client'

import { Card, SectionTitle, BarList, RetentionBars, EmptyState, fmtDuration } from './ui'

export default function StoryInsightsTab({ data }) {
  const ch = data.chaptersInsight
  const hasData = ch.length > 0

  if (!hasData) {
    return (
      <Card className="p-5">
        <EmptyState emoji="📚" title="No chapter data yet" hint="Once readers move through the book, you'll see where attention and highlights cluster." />
      </Card>
    )
  }

  const heat = ch.map((c) => ({
    label: `${c.number}. ${c.title}`,
    value: c.interactions,
    display: c.interactions,
    color: 'var(--accent)',
  }))
  const time = ch.map((c) => ({ label: `${c.number}. ${c.title}`, value: c.avgSeconds, display: fmtDuration(c.avgSeconds) }))

  const slowest = ch.slice().sort((a, b) => b.avgSeconds - a.avgSeconds)[0]

  return (
    <div className="space-y-6">
      {/* Drop-off / retention */}
      <Card className="p-5">
        <SectionTitle hint="% of readers who reached each chapter">Retention curve</SectionTitle>
        <RetentionBars chapters={ch} />
        {data.dropOff && (
          <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}>
            <span className="mr-1">📉</span>
            Biggest drop-off is <strong>after Chapter {data.dropOff.afterChapter}</strong> ({data.dropOff.afterTitle}) —{' '}
            {data.dropOff.lost} reader{data.dropOff.lost > 1 ? 's' : ''} stop there. That&rsquo;s the place to tighten.
          </div>
        )}
      </Card>

      {/* Heat map */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle hint="highlights + likes + comments">Chapter heat map</SectionTitle>
          <BarList items={heat} emptyHint="No highlights or likes captured yet." />
        </Card>

        <Card className="p-5">
          <SectionTitle hint={slowest ? `slowest: ${slowest.title}` : ''}>Avg. reading time</SectionTitle>
          <BarList items={time} color="#9a7b53" emptyHint="No reading time recorded yet." />
        </Card>
      </div>

      {/* Most-resonant passages */}
      <Card className="p-5">
        <SectionTitle hint="most highlighted & liked">These sentences land</SectionTitle>
        {data.topPassages.length === 0 ? (
          <EmptyState emoji="✨" title="No highlighted passages yet" hint="When readers highlight or like sentences, the lines that resonate most will surface here." />
        ) : (
          <ol className="space-y-2">
            {data.topPassages.map((p, i) => (
              <li key={i} className="flex gap-3 rounded-xl p-3" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
                <span className="font-display text-lg" style={{ color: 'var(--accent)' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm italic" style={{ color: 'var(--ink)' }}>&ldquo;{p.passage}&rdquo;</p>
                  <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                    Chapter {p.chapter} · {p.count} reader{p.count > 1 ? 's' : ''} ({p.highlights} highlights, {p.likes} likes)
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
