'use client'

import { Card, SectionTitle, LineChart, EmptyState, Avatar, Badge, fmtDate, downloadCsv } from './ui'

export default function FanbaseTab({ data }) {
  const subs = data.subscribers
  const growth = data.growth

  const exportSubs = () => {
    const rows = [['name', 'email', 'book', 'subscribed_at']]
    subs.forEach((s) => rows.push([s.name || '', s.email || '', s.book_title || '', s.subscribed_at || '']))
    downloadCsv(`het-zal-subscribers-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const growthPoints = growth.map((g) => ({ label: g.label, y: g.newReaders, y2: g.newSubscribers }))
  const optInPoints = growth.map((g) => ({ label: g.label, y: g.optInRate }))

  return (
    <div className="space-y-6">
      {/* Growth */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle hint="readers ● / subscribers ○ per week">New readers over time</SectionTitle>
          <LineChart points={growthPoints} color="var(--accent)" color2="#9a7b53" />
        </Card>
        <Card className="p-5">
          <SectionTitle hint="cumulative % subscribed">Opt-in rate over time</SectionTitle>
          <LineChart points={optInPoints} color="#7d9b6a" />
        </Card>
      </div>

      {/* Subscribers */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <SectionTitle hint={`${subs.length} subscriber${subs.length === 1 ? '' : 's'}`}>Het Zal subscribers</SectionTitle>
          </div>
          {subs.length > 0 && (
            <button onClick={exportSubs} className="rounded-full px-3 py-1.5 text-xs text-white" style={{ background: 'var(--accent)' }}>
              Export CSV
            </button>
          )}
        </div>
        {subs.length === 0 ? (
          <EmptyState emoji="✉️" title="No subscribers yet" hint="Readers opt in from the welcome screen. Each opt-in lands here with their email." />
        ) : (
          <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--rule)' }}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
                  <th className="px-3 py-2 font-normal">Name</th>
                  <th className="px-3 py-2 font-normal">Email</th>
                  <th className="hidden px-3 py-2 font-normal sm:table-cell">Book</th>
                  <th className="px-3 py-2 font-normal">Date</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.reader_id} style={{ borderTop: '1px solid var(--rule)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--ink)' }}>{s.name || 'Anonymous'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--ink-soft)' }}>{s.email || '—'}</td>
                    <td className="hidden px-3 py-2 sm:table-cell" style={{ color: 'var(--ink-soft)' }}>{s.book_title || '—'}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--ink-soft)' }}>{fmtDate(s.subscribed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Sharing & referrals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle hint="who drives new readers">Top sharers</SectionTitle>
          {data.topSharers.length === 0 ? (
            <EmptyState emoji="↗️" title="No shares yet" hint="When readers tap Share, their link carries a referral tag so you can see who brings people in." />
          ) : (
            <ul className="space-y-2">
              {data.topSharers.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="w-4 text-center font-display text-sm" style={{ color: 'var(--accent)' }}>{i + 1}</span>
                  <Avatar name={s.name} size={32} />
                  <span className="flex-1 truncate text-sm" style={{ color: 'var(--ink)' }}>{s.name}</span>
                  {s.referred > 0 && <Badge title="Readers referred">👥 {s.referred}</Badge>}
                  {s.shares > 0 && <Badge title="Share actions">↗️ {s.shares}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle hint="who invited whom">Referral chain</SectionTitle>
          {data.referralChains.length === 0 ? (
            <EmptyState emoji="🌿" title="No referrals yet" hint="Referrals appear when a new reader opens a shared link." />
          ) : (
            <ul className="space-y-3">
              {data.referralChains.map((c) => (
                <li key={c.id}>
                  <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{c.name}</div>
                  <div className="mt-1 space-y-1 border-l pl-3" style={{ borderColor: 'var(--rule)' }}>
                    {c.invitees.map((i) => (
                      <div key={i.id} className="text-sm" style={{ color: 'var(--ink-soft)' }}>↳ {i.name}</div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
