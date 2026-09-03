'use client'

import { useEffect, useState } from 'react'
import { loadDashboardData } from '../../lib/dashboard-data'
import OverviewTab from './OverviewTab'
import QuestionsTab from './QuestionsTab'
import AnswersTab from './AnswersTab'
import ReadersTab from './ReadersTab'
import StoryInsightsTab from './StoryInsightsTab'
import FanbaseTab from './FanbaseTab'


const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'readers', label: 'Readers' },
  { key: 'story', label: 'Story insights' },
  { key: 'fanbase', label: 'Fanbase & growth' },
  { key: 'questions', label: 'Vragen' },
  { key: 'answers', label: 'Antwoorden' },
]

const EMPTY_DATA = {
  overview: {
    total: 0, newThisWeek: 0, readingCount: 0, finishedCount: 0, notStartedCount: 0,
    avgCompletion: 0, totalHighlights: 0, totalComments: 0, totalLikes: 0,
    subscriberCount: 0, optInRate: 0, timesShared: 0, referralReach: 0,
    openQuestions: 0, totalQuestions: 0, surveyCount: 0, eventCount: 0,
  },
  activity: [], people: [], chaptersInsight: [], buckets: [], dropOff: null,
  topPassages: [], growth: [], subscribers: [], topSharers: [], referralChains: [],
  questions: [], surveys: [], totalLocations: 1,
  totals: { readers: 0 },
}

export default function Dashboard({ chapters = [], bookTitle = 'The Book' }) {
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('br_dash') === '1') setUnlocked(true)
  }, [])

  const refresh = () => {
    setLoading(true)
    loadDashboardData()
      .then((r) => {
        if (r && r.locked) {
          sessionStorage.removeItem('br_dash')
          setUnlocked(false)
          return
        }
        setResult(r)
      })
      .catch((e) => setResult({ configured: true, missingTables: [], data: EMPTY_DATA, error: e?.message }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (unlocked) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked])

  const questionAction = async (id, action) => {
    try {
      await fetch('/api/dashboard/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, action }),
      })
      refresh()
    } catch {
      /* ignore */
    }
  }

  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />

  const data = (result && result.data) || EMPTY_DATA
  const configured = result ? result.configured : false
  const missing = (result && result.missingTables) || []

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl" style={{ color: 'var(--ink)' }}>
              Fanbase Command Center
            </h1>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              {bookTitle} · {data.overview.total} reader{data.overview.total === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="rounded-full px-3 py-2 text-sm" style={{ border: '1px solid var(--rule)', color: 'var(--ink)' }}>
              ↻ Refresh
            </button>
            <button
              onClick={async () => {
                sessionStorage.removeItem('br_dash')
                try {
                  await fetch('/api/dashboard/login', { method: 'DELETE', credentials: 'same-origin' })
                } catch {
                  /* ignore */
                }
                setUnlocked(false)
              }}
              className="rounded-full px-3 py-2 text-sm"
              style={{ border: '1px solid var(--rule)', color: 'var(--ink-soft)' }}
            >
              Lock
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--rule)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="whitespace-nowrap px-4 py-2.5 text-sm transition-colors"
              style={{
                color: tab === t.key ? 'var(--ink)' : 'var(--ink-soft)',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: tab === t.key ? 600 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {!configured && (
        <Notice emoji="🔌" tone="info">
          Supabase isn&rsquo;t configured, so there&rsquo;s no data yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then run <code>supabase/schema.sql</code>. Everything below shows
          empty states meanwhile.
        </Notice>
      )}
      {configured && missing.length > 0 && (
        <Notice emoji="⚠️" tone="warn">
          Some tables are missing ({missing.join(', ')}). Run the latest <code>supabase/schema.sql</code> to enable
          highlights, feedback, subscribers and sharing.
        </Notice>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>Loading your fanbase…</p>
      ) : (
        <>
          {tab === 'overview' && <OverviewTab data={data} />}
          {tab === 'readers' && <ReadersTab data={data} />}
          {tab === 'story' && <StoryInsightsTab data={data} />}
          {tab === 'fanbase' && <FanbaseTab data={data} />}
          {tab === 'questions' && <QuestionsTab data={data} onAction={questionAction} />}
          {tab === 'answers' && <AnswersTab data={data} />}
        </>
      )}
    </main>
  )
}

function Notice({ children, emoji, tone }) {
  return (
    <div
      className="mb-5 flex items-start gap-2 rounded-xl p-3 text-sm"
      style={{
        background: 'var(--panel)',
        border: `1px solid ${tone === 'warn' ? 'var(--accent)' : 'var(--rule)'}`,
        color: 'var(--ink-soft)',
      }}
    >
      <span>{emoji}</span>
      <span>{children}</span>
    </div>
  )
}

function Gate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  // The password is checked on the server; the cookie it sets is httpOnly, so
  // the browser never holds either the password or a readable session token.
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/dashboard/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: value }),
      })
      if (res.ok) {
        sessionStorage.setItem('br_dash', '1')
        onUnlock()
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    }
    setBusy(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="panel w-full max-w-sm rounded-2xl p-7">
        <h1 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>Command Center</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>Enter the dashboard password.</p>
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(e) => { setValue(e.target.value); setError(false) }}
          className="mt-4 w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{ background: 'var(--paper)', border: `1px solid ${error ? '#c0532f' : 'var(--rule)'}`, color: 'var(--ink)' }}
          placeholder="Password"
        />
        {error && <p className="mt-2 text-xs text-[#c0532f]">Incorrect password.</p>}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-full py-2.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
          {busy ? 'Bezig…' : 'Unlock'}
        </button>
      </form>
    </main>
  )
}
