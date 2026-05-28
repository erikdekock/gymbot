'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import GoalCard from '../components/GoalCard'
import { activeGoal } from '../lib/season'
import { timePercent, readinessPercent } from '../lib/readiness'

const supabase = createClient()

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FOCUS_OPTIONS = ['Lower Posterior', 'Upper Push/Pull', 'Lower Anterior', 'Upper + Core', 'Full Body', 'Mobility', 'Run']
const FOCUS_EMOJI = {
  'Lower Posterior': '🦵', 'Upper Push/Pull': '💪', 'Lower Anterior': '🦿',
  'Upper + Core': '🏋️', 'Full Body': '⚡', 'Mobility': '🧘', 'Run': '🏃'
}

export default function Home() {
  const router = useRouter()
  const [sessions, setSessions] = useState([])
  const [week, setWeek] = useState([])
  const [showPlanner, setShowPlanner] = useState(false)
  const [plannerDays, setPlannerDays] = useState({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    buildWeek()
    loadSessions()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  function buildWeek() {
    const today = new Date()
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      days.push({
        date: d.toISOString().split('T')[0],
        label: DAYS[d.getDay()],
        day: d.getDate(),
        isToday: i === 0
      })
    }
    setWeek(days)
  }

  async function loadSessions() {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', nextWeek.toISOString().split('T')[0])
      .order('date')
    setSessions(data || [])
    setLoading(false)
  }

  function getSessionForDate(date) {
    return sessions.find(s => s.date === date)
  }

  async function planWeek() {
    const entries = Object.entries(plannerDays)
    for (const [date, focus] of entries) {
      if (!focus) continue
      const existing = getSessionForDate(date)
      if (!existing) {
        await supabase.from('sessions').insert({ date, type: 'Gym', focus })
      }
    }
    setShowPlanner(false)
    loadSessions()
  }

  async function openSession(date) {
    const existing = getSessionForDate(date)
    if (existing) {
      router.push(`/session/${existing.id}`)
    } else {
      const { data } = await supabase
        .from('sessions')
        .insert({ date, type: 'Gym', focus: 'Lower Posterior' })
        .select()
        .single()
      if (data) router.push(`/session/${data.id}`)
    }
  }

  const today = new Date()
  const daysRemaining = Math.ceil((activeGoal.raceDate - today) / (1000 * 60 * 60 * 24))
  const timePct = Math.round(timePercent(activeGoal.seasonStart, activeGoal.raceDate, today))
  const readinessPct = Math.round(readinessPercent(activeGoal))

  // 15a minimum-viable rebrand: paper surface, REPRISE wordmark, paper-themed
  // day-list. GoalCard and planner modal redesign deferred to ticket 13.
  return (
    <div className="rep-surface">
      <div className="px-5 pt-14 pb-10" style={{ maxWidth: 430, margin: '0 auto', width: '100%' }}>
        <div className="mb-8" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <span className="rep-wordmark rep-wordmark--small" style={{ marginBottom: 6, display: 'inline-block' }}>
              REPRISE
            </span>
            <h1 className="rep-heading" style={{ margin: 0 }}>This week</h1>
          </div>
          <button
            onClick={() => router.push("/profile")}
            aria-label="Go to profile"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--paper-90)', color: 'var(--graphite-10)',
              border: '1px solid var(--paper-80)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              marginTop: 4,
            }}
          >
            {user?.email ? user.email[0].toUpperCase() : "?"}
          </button>
        </div>

        <GoalCard
          seasonType={activeGoal.seasonType}
          name={activeGoal.name}
          meta={activeGoal.meta}
          daysRemaining={daysRemaining}
          timePercent={timePct}
          readinessPercent={readinessPct}
        />

        <div className="space-y-3 mb-6">
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--graphite-30)', fontSize: 14 }}>
              Loading...
            </div>
          ) : week.map(d => {
            const session = getSessionForDate(d.date)
            const cardStyle = d.isToday
              ? { background: 'var(--sage)', color: 'var(--paper-100)', border: '1.5px solid var(--sage)' }
              : session
              ? { background: 'var(--paper-100)', color: 'var(--graphite-10)', border: '1px solid var(--paper-70)' }
              : { background: 'var(--paper-100)', color: 'var(--graphite-30)', border: '1px solid var(--paper-80)' }
            return (
              <button
                key={d.date}
                onClick={() => openSession(d.date)}
                className="w-full rounded-2xl p-4 flex items-center justify-between transition-all active:scale-95"
                style={cardStyle}
              >
                <div className="flex items-center gap-4">
                  <div className="text-left w-10">
                    <p style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>{d.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{d.day}</p>
                  </div>
                  <div className="text-left">
                    {session ? (
                      <>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>
                          {FOCUS_EMOJI[session.focus] || '💪'} {session.focus}
                        </p>
                        <p style={{ fontSize: 12, opacity: 0.7 }}>Tap to open</p>
                      </>
                    ) : (
                      <p style={{ fontSize: 14 }}>Rest · tap to start</p>
                    )}
                  </div>
                </div>
                {session && (
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: d.isToday ? 'var(--paper-100)' : 'var(--graphite-30)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setShowPlanner(true)}
          className="w-full rounded-2xl p-4 active:scale-95 transition-all"
          style={{
            border: '1px dashed var(--paper-70)',
            background: 'transparent',
            color: 'var(--graphite-30)',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          + Plan this week
        </button>

        {showPlanner && (
          <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: 'var(--paper-95)', color: 'var(--graphite-10)' }}
          >
            <div
              className="flex items-center justify-between px-5 pt-14 pb-4"
              style={{ borderBottom: '1px solid var(--paper-80)' }}
            >
              <h2 className="rep-heading" style={{ margin: 0 }}>Plan this week</h2>
              <button
                onClick={() => setShowPlanner(false)}
                style={{ background: 'none', border: 'none', color: 'var(--graphite-30)', fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {week.map(d => (
                <div key={d.date}>
                  <p style={{
                    fontFamily: 'var(--rep-font-mono)', fontSize: 11,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--graphite-30)', marginBottom: 12,
                  }}>
                    {d.label} {d.day} May
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPlannerDays(p => ({ ...p, [d.date]: null }))}
                      className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                      style={!plannerDays[d.date]
                        ? { background: 'var(--graphite-10)', color: 'var(--paper-100)', border: '1px solid var(--graphite-10)' }
                        : { background: 'var(--paper-100)', color: 'var(--graphite-30)', border: '1px solid var(--paper-80)' }}
                    >
                      😴 Rest
                    </button>
                    {FOCUS_OPTIONS.map(f => (
                      <button
                        key={f}
                        onClick={() => setPlannerDays(p => ({ ...p, [d.date]: f }))}
                        className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                        style={plannerDays[d.date] === f
                          ? { background: 'var(--sage)', color: 'var(--paper-100)', border: '1px solid var(--sage)' }
                          : { background: 'var(--paper-100)', color: 'var(--graphite-20)', border: '1px solid var(--paper-80)' }}
                      >
                        {FOCUS_EMOJI[f]} {f}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="px-5 pb-8 pt-4"
              style={{ borderTop: '1px solid var(--paper-80)' }}
            >
              <button
                onClick={planWeek}
                className="rep-btn rep-btn--primary"
              >
                Save week
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
