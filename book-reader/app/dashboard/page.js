'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase, isAnalyticsEnabled } from '../../lib/supabase'
import { generateReaderId } from '../../lib/reader-id'

const PASSWORD = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || ''

function fmtDuration(seconds) {
  const s = Math.round(seconds || 0)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
//  Password gate
// ---------------------------------------------------------------------------
function Gate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (PASSWORD && value === PASSWORD) {
      sessionStorage.setItem('br_dash', '1')
      onUnlock()
    } else {
      setError(true)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="panel w-full max-w-sm rounded-2xl p-7">
        <h1 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Enter the dashboard password.
        </p>
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          className="mt-4 w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{
            background: 'var(--paper)',
            border: `1px solid ${error ? '#c0532f' : 'var(--rule)'}`,
            color: 'var(--ink)',
          }}
          placeholder="Password"
        />
        {error && <p className="mt-2 text-xs text-[#c0532f]">Incorrect password.</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-full py-2.5 text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          Unlock
        </button>
      </form>
    </main>
  )
}

// ---------------------------------------------------------------------------
//  Reader detail (chapter-by-chapter timeline)
// ---------------------------------------------------------------------------
function ReaderDetail({ reader, stats, onClose }) {
  const rows = useMemo(
    () => stats.filter((s) => s.reader_id === reader.id).sort((a, b) => a.chapter_number - b.chapter_number),
    [stats, reader.id]
  )
  const link =
    typeof window !== 'undefined' ? `${window.location.origin}/read?id=${reader.id}` : ''

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'var(--overlay)' }}
      onClick={onClose}
    >
      <aside
        className="panel h-full w-full max-w-lg overflow-y-auto p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
              {reader.name || reader.email || 'Anonymous reader'}
            </h2>
            {reader.email && reader.name && (
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {reader.email}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ color: 'var(--ink-soft)' }} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Complete" value={`${reader.progress_pct || 0}%`} />
          <Stat label="Finished" value={reader.finished ? 'Yes' : 'No'} />
          <Stat label="Last seen" value={fmtDate(reader.last_seen_at)} />
        </div>

        <p
          className="mb-2 mt-7 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--ink-soft)' }}
        >
          Chapter journey
        </p>
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              No chapter activity yet.
            </p>
          )}
          {rows.map((r) => (
            <div
              key={r.chapter_number}
              className="rounded-xl p-3"
              style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-[15px]" style={{ color: 'var(--ink)' }}>
                  <span style={{ color: 'var(--accent)' }} className="mr-2 text-xs">
                    {String(r.chapter_number).padStart(2, '0')}
                  </span>
                  {r.chapter_title || `Chapter ${r.chapter_number}`}
                </span>
                <span className="text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                  {fmtDuration(r.time_spent_seconds)}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
                <span>Read {Math.round(r.max_scroll_pct || 0)}%</span>
                <span>{r.views || 0} visits</span>
                <span>{r.page_views || 0} page turns</span>
                <span>· {fmtDate(r.last_seen_at)}</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--rule)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, r.max_scroll_pct || 0)}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <p
          className="mb-1 mt-7 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--ink-soft)' }}
        >
          Reader link
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
            style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink-soft)' }}
          />
          <button
            onClick={() => navigator.clipboard?.writeText(link)}
            className="rounded-lg px-3 py-2 text-xs text-white"
            style={{ background: 'var(--accent)' }}
          >
            Copy
          </button>
        </div>
      </aside>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}
    >
      <div className="font-display text-lg" style={{ color: 'var(--ink)' }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>
        {label}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Main dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [readers, setReaders] = useState([])
  const [stats, setStats] = useState([])
  const [selected, setSelected] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [newLink, setNewLink] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('br_dash') === '1') {
      setUnlocked(true)
    }
  }, [])

  useEffect(() => {
    if (!unlocked) return
    if (!isAnalyticsEnabled()) {
      setErrorMsg('Supabase is not configured — set the env vars to see reader data.')
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      const [r, s] = await Promise.all([
        supabase.from('readers').select('*').order('last_seen_at', { ascending: false }),
        supabase.from('chapter_stats').select('*'),
      ])
      if (r.error || s.error) {
        setErrorMsg((r.error || s.error).message)
      } else {
        setReaders(r.data || [])
        setStats(s.data || [])
      }
      setLoading(false)
    })()
  }, [unlocked])

  const totalTimeByReader = useMemo(() => {
    const map = {}
    for (const s of stats) {
      map[s.reader_id] = (map[s.reader_id] || 0) + (s.time_spent_seconds || 0)
    }
    return map
  }, [stats])

  const chaptersStartedByReader = useMemo(() => {
    const map = {}
    for (const s of stats) {
      map[s.reader_id] = (map[s.reader_id] || 0) + 1
    }
    return map
  }, [stats])

  const exportCsv = () => {
    const headers = [
      'name',
      'email',
      'progress_pct',
      'finished',
      'total_time_seconds',
      'chapters_started',
      'last_seen',
      'created',
      'reader_id',
    ]
    const lines = [headers.join(',')]
    for (const r of readers) {
      const row = [
        r.name || '',
        r.email || '',
        r.progress_pct || 0,
        r.finished ? 'yes' : 'no',
        totalTimeByReader[r.id] || 0,
        chaptersStartedByReader[r.id] || 0,
        r.last_seen_at || '',
        r.created_at || '',
        r.id,
      ].map((v) => {
        const str = String(v).replace(/"/g, '""')
        return /[",\n]/.test(str) ? `"${str}"` : str
      })
      lines.push(row.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `readers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const makeLink = () => {
    const id = generateReaderId()
    setNewLink(`${window.location.origin}/read?id=${id}`)
  }

  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl" style={{ color: 'var(--ink)' }}>
            Readers
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            {readers.length} {readers.length === 1 ? 'reader' : 'readers'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={makeLink}
            className="rounded-full px-4 py-2 text-sm"
            style={{ border: '1px solid var(--rule)', color: 'var(--ink)' }}
          >
            New reader link
          </button>
          <button
            onClick={exportCsv}
            className="rounded-full px-4 py-2 text-sm text-white"
            style={{ background: 'var(--accent)' }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {newLink && (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl p-3"
          style={{ background: 'var(--panel)', border: '1px solid var(--rule)' }}
        >
          <input
            readOnly
            value={newLink}
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--ink)' }}
          />
          <button
            onClick={() => navigator.clipboard?.writeText(newLink)}
            className="rounded-lg px-3 py-1.5 text-xs text-white"
            style={{ background: 'var(--accent)' }}
          >
            Copy
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          className="mt-6 rounded-xl p-4 text-sm"
          style={{ background: 'var(--panel)', border: '1px solid var(--rule)', color: 'var(--ink-soft)' }}
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Loading…
        </p>
      ) : (
        !errorMsg && (
          <div className="panel mt-6 overflow-hidden rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--ink-soft)' }} className="text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-normal">Reader</th>
                  <th className="px-4 py-3 font-normal">Progress</th>
                  <th className="px-4 py-3 font-normal">Time</th>
                  <th className="hidden px-4 py-3 font-normal sm:table-cell">Chapters</th>
                  <th className="hidden px-4 py-3 font-normal sm:table-cell">Last seen</th>
                  <th className="px-4 py-3 font-normal">Done</th>
                </tr>
              </thead>
              <tbody>
                {readers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--ink-soft)' }}>
                      No readers yet. Share a <code>/read?id=…</code> link to get started.
                    </td>
                  </tr>
                )}
                {readers.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer transition-colors"
                    style={{ borderTop: '1px solid var(--rule)' }}
                  >
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--ink)' }}>{r.name || 'Anonymous'}</div>
                      {r.email && (
                        <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                          {r.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-20 overflow-hidden rounded-full"
                          style={{ background: 'var(--rule)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${r.progress_pct || 0}%`, background: 'var(--accent)' }}
                          />
                        </div>
                        <span className="tabular-nums text-xs" style={{ color: 'var(--ink-soft)' }}>
                          {r.progress_pct || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--ink)' }}>
                      {fmtDuration(totalTimeByReader[r.id])}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell" style={{ color: 'var(--ink)' }}>
                      {chaptersStartedByReader[r.id] || 0}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell" style={{ color: 'var(--ink-soft)' }}>
                      {fmtDate(r.last_seen_at)}
                    </td>
                    <td className="px-4 py-3">
                      {r.finished ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs text-white"
                          style={{ background: 'var(--accent)' }}
                        >
                          ✓
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {selected && (
        <ReaderDetail reader={selected} stats={stats} onClose={() => setSelected(null)} />
      )}
    </main>
  )
}
