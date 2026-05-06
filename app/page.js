'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

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

  useEffect(() => {
    buildWeek()
    loadSessions()
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

  const foxDate = new Date('2026-05-23')
  const today = new Date()
  const daysToFox = Math.ceil((foxDate - today) / (1000 * 60 * 60 * 24))

  return (
    <div className="px-5 pt-14 pb-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">GymBot</p>
        <h1 className="text-3xl font-bold text-white">This week</h1>
      </div>

      {/* Fox countdown */}
      <div className="mb-6 rounded-2xl bg-zinc-900 border border-zinc-800 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 mb-1">The Fox 20K</p>
          <p className="text-white font-semibold">May 23 · Surrey UK</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">{daysToFox}</p>
          <p className="text-xs text-zinc-500">days</p>
        </div>
      </div>

      {/* Week */}
      <div className="space-y-3 mb-6">
        {loading ? (
          <div className="text-zinc-600 text-sm py-8 text-center">Loading...</div>
        ) : week.map(d => {
          const session = getSessionForDate(d.date)
          return (
            <button
              key={d.date}
              onClick={() => openSession(d.date)}
              className={`w-full rounded-2xl p-4 flex items-center justify-between transition-all active:scale-95 ${
                d.isToday
                  ? 'bg-white text-black'
                  : session
                  ? 'bg-zinc-900 border border-zinc-700 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-left w-10">
                  <p className={`text-xs font-medium ${d.isToday ? 'text-zinc-600' : 'text-zinc-500'}`}>{d.label}</p>
                  <p className={`text-xl font-bold ${d.isToday ? 'text-black' : 'text-white'}`}>{d.day}</p>
                </div>
                <div className="text-left">
                  {session ? (
                    <>
                      <p className="font-semibold text-sm">{FOCUS_EMOJI[session.focus] || '💪'} {session.focus}</p>
                      <p className={`text-xs ${d.isToday ? 'text-zinc-600' : 'text-zinc-500'}`}>Tap to open</p>
                    </>
                  ) : (
                    <p className="text-sm">Rest · tap to start</p>
                  )}
                </div>
              </div>
              {session && (
                <div className={`w-2 h-2 rounded-full ${d.isToday ? 'bg-black' : 'bg-zinc-400'}`} />
              )}
            </button>
          )
        })}
      </div>

      {/* Plan week button */}
      <button
        onClick={() => setShowPlanner(true)}
        className="w-full rounded-2xl border border-zinc-700 border-dashed p-4 text-zinc-500 text-sm font-medium active:scale-95 transition-all"
      >
        + Plan this week
      </button>

      {/* Planner modal */}
      {showPlanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-zinc-800">
            <h2 className="text-2xl font-bold">Plan this week</h2>
            <button onClick={() => setShowPlanner(false)} className="text-zinc-500 text-sm">Cancel</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {week.map(d => (
              <div key={d.date}>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{d.label} {d.day} May</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPlannerDays(p => ({ ...p, [d.date]: null }))}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${!plannerDays[d.date] ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                  >
                    😴 Rest
                  </button>
                  {FOCUS_OPTIONS.map(f => (
                    <button
                      key={f}
                      onClick={() => setPlannerDays(p => ({ ...p, [d.date]: f }))}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${plannerDays[d.date] === f ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}
                    >
                      {FOCUS_EMOJI[f]} {f}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-8 pt-4 border-t border-zinc-800">
            <button
              onClick={planWeek}
              className="w-full bg-white text-black rounded-2xl py-4 font-bold text-base active:scale-95 transition-all"
            >
              Save week
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
