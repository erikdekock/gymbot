'use client'

import { Card, StatCard, SectionTitle, EmptyState, fmtRelative } from './ui'

export default function OverviewTab({ data }) {
  const o = data.overview
  const cards = [
    { label: 'Total readers', value: o.total, sub: o.newThisWeek ? `+${o.newThisWeek} this week` : 'no new readers this week', emoji: '👥' },
    { label: 'Currently reading', value: o.readingCount, sub: `${o.notStartedCount} not started`, emoji: '📖' },
    { label: 'Finished', value: o.finishedCount, sub: `${o.total ? Math.round((o.finishedCount / o.total) * 100) : 0}% of readers`, emoji: '🏁' },
    { label: 'Avg. completion', value: `${o.avgCompletion}%`, sub: 'across all readers', emoji: '📊' },
    { label: 'Highlights', value: o.totalHighlights, sub: `${o.totalComments} comments · ${o.totalLikes} likes`, emoji: '✨' },
    { label: 'Het Zal subscribers', value: o.subscriberCount, sub: `${o.optInRate}% opt-in rate`, emoji: '✉️' },
    { label: 'Times shared', value: o.timesShared, sub: `${o.referralReach} arrived via referral`, emoji: '↗️' },
    { label: 'Engaged + superfans', value: data.people.filter((p) => p.engagement.score >= 40).length, sub: 'readers worth nurturing', emoji: '🔥' },
    { label: 'Open vragen', value: o.openQuestions, sub: `${o.totalQuestions} in totaal`, emoji: '❓' },
    { label: 'Survey-antwoorden', value: o.surveyCount, sub: 'per hoofdstuk verzameld', emoji: '📝' },
    { label: 'Events', value: o.eventCount, sub: 'gedragssignalen', emoji: '📡' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <Card className="p-5">
        <SectionTitle hint="latest first">Activity</SectionTitle>
        {data.activity.length === 0 ? (
          <EmptyState emoji="🌱" title="No activity yet" hint="As people read, highlight, subscribe and share, it'll show up here." />
        ) : (
          <ul className="space-y-1">
            {data.activity.map((e, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-2" style={{ borderBottom: i < data.activity.length - 1 ? '1px solid var(--rule)' : 'none' }}>
                <span className="text-base">{e.icon}</span>
                <span className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>
                  {e.text}
                </span>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--ink-soft)' }}>
                  {fmtRelative(e.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
