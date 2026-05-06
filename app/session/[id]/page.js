'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const SESSION_TEMPLATES = {
  'Lower Posterior': {
    prep: ['Cossack Squat', 'Jefferson Curl', 'Dead Hang'],
    supersets: [
      { label: 'A', type: 'Primary Compound', exerciseA: 'RDL', exerciseB: 'Hip Thrust', setsTarget: 4, repsA: 8, repsB: 10 },
      { label: 'B', type: 'Unilateral / Core', exerciseA: 'Bulgarian Split Squat', exerciseB: 'Copenhagen Plank', setsTarget: 3, repsA: 10, repsB: 45 },
      { label: 'C', type: 'Pump / Finisher', exerciseA: 'Hamstring Curl', exerciseB: 'Ab Roll-Out', setsTarget: 3, repsA: 12, repsB: 10 },
    ]
  },
  'Upper Push/Pull': {
    prep: ['Scap Push-Up', 'Band Pull-Apart', 'Hang Hold'],
    supersets: [
      { label: 'A', type: 'Primary Compound', exerciseA: 'Incline DB Press', exerciseB: '1-Arm Row', setsTarget: 4, repsA: 10, repsB: 10 },
      { label: 'B', type: 'Unilateral / Pull', exerciseA: 'Pull-ups', exerciseB: 'Lateral Raise', setsTarget: 3, repsA: 10, repsB: 15 },
      { label: 'C', type: 'Pump / Finisher', exerciseA: 'EZ Curl', exerciseB: 'Skull Crusher', setsTarget: 3, repsA: 12, repsB: 12 },
    ]
  },
  'Upper + Core': {
    prep: ['Scap Push-Up', 'Thoracic Rotation', 'Dead Hang'],
    supersets: [
      { label: 'A', type: 'Primary Compound', exerciseA: 'Bench Press', exerciseB: 'Barbell Row', setsTarget: 4, repsA: 10, repsB: 10 },
      { label: 'B', type: 'Unilateral / Core', exerciseA: 'Pull-ups', exerciseB: 'Ab Roll-Out', setsTarget: 3, repsA: 10, repsB: 10 },
      { label: 'C', type: 'Pump / Finisher', exerciseA: 'Lateral Raise', exerciseB: 'Hanging Leg Raise', setsTarget: 3, repsA: 15, repsB: 12 },
    ]
  },
  'Lower Anterior': {
    prep: ['Deep Squat Hold', 'Hip Flexor Stretch', 'Ankle Circles'],
    supersets: [
      { label: 'A', type: 'Primary Compound', exerciseA: 'Front Squat', exerciseB: 'Leg Press', setsTarget: 4, repsA: 8, repsB: 12 },
      { label: 'B', type: 'Unilateral / Core', exerciseA: 'Lunge', exerciseB: 'Hanging Leg Raise', setsTarget: 3, repsA: 10, repsB: 12 },
      { label: 'C', type: 'Pump / Finisher', exerciseA: 'Leg Extension', exerciseB: 'Ab Crunch', setsTarget: 3, repsA: 15, repsB: 20 },
    ]
  },
  'Full Body': {
    prep: ['Cossack Squat', 'Band Pull-Apart', 'Hip Hinge Drill'],
    supersets: [
      { label: 'A', type: 'Complex', exerciseA: 'Front Squat', exerciseB: 'Push Press', setsTarget: 4, repsA: 6, repsB: 6 },
      { label: 'B', type: 'Unilateral', exerciseA: 'Bulgarian Split Squat', exerciseB: '1-Arm Row', setsTarget: 3, repsA: 10, repsB: 10 },
      { label: 'C', type: 'Finisher', exerciseA: 'Hip Thrust', exerciseB: 'Pull-ups', setsTarget: 3, repsA: 10, repsB: 10 },
    ]
  },
  'Mobility': {
    prep: ['90/90 Hip Flow', 'Thoracic Rotation', 'Ankle Circles'],
    supersets: [
      { label: 'A', type: 'Hip Flow', exerciseA: 'Cossack Squat', exerciseB: '90/90 Transition', setsTarget: 3, repsA: 10, repsB: 10 },
      { label: 'B', type: 'Loaded Mobility', exerciseA: 'Jefferson Curl', exerciseB: 'Hip Flexor Stretch', setsTarget: 3, repsA: 10, repsB: 30 },
      { label: 'C', type: 'End-Range', exerciseA: 'PAILs/RAILs', exerciseB: 'Isometric Hold', setsTarget: 2, repsA: 30, repsB: 30 },
    ]
  },
  'Run': {
    prep: ['5 min walk warm-up', 'Ankle circles', 'Leg swings'],
    supersets: [
      { label: 'A', type: 'Zone 2', exerciseA: 'Run', exerciseB: 'HR Monitor', setsTarget: 1, repsA: 0, repsB: 0 },
    ]
  },
}

const BODYWEIGHT_EXERCISES = [
  'Pull-ups', 'Dips', 'Hanging Leg Raise', 'Hanging Knee Raise', 'Ab Roll-Out',
  'Copenhagen Plank', 'Push-ups', 'Chin-ups', 'Muscle-ups', 'L-sit',
  'PAILs/RAILs', 'Isometric Hold', '90/90 Transition', 'Hip Flexor Stretch'
]

const isBodyweight = (name) => BODYWEIGHT_EXERCISES.some(bw => name?.toLowerCase().includes(bw.toLowerCase()))

const FEELING_OPTIONS = ['💪 Strong', '😊 Good', '😐 Okay', '😓 Tired', '😩 Rough']
const RPE_COLORS = { 6: 'text-green-400', 7: 'text-green-400', 8: 'text-yellow-400', 9: 'text-orange-400', 10: 'text-red-400' }

export default function SessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id

  const [session, setSession] = useState(null)
  const [template, setTemplate] = useState(null)
  const [sets, setSets] = useState({}) // { "A-0": [{kgA, repsA, kgB, repsB, feeling}] }
  const [activeSuperset, setActiveSuperset] = useState('A')
  const [rpe, setRpe] = useState(7)
  const [notes, setNotes] = useState('')
  const [currentInput, setCurrentInput] = useState({})
  const [saved, setSaved] = useState(false)
  const [showPrep, setShowPrep] = useState(true)
  const [lastWeights, setLastWeights] = useState({})

  useEffect(() => {
    loadSession()
  }, [sessionId])

  async function loadLastWeights(focus) {
    const { data } = await supabase
      .from('exercises')
      .select('name, kg')
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) {
      const weights = {}
      data.forEach(e => {
        if (!weights[e.name] && e.kg > 0) weights[e.name] = e.kg
      })
      setLastWeights(weights)
    }
  }

  async function loadSession() {
    const { data } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
    if (data) {
      setSession(data)
      setRpe(data.rpe || 7)
      setNotes(data.notes || '')
      const t = SESSION_TEMPLATES[data.focus] || SESSION_TEMPLATES['Upper + Core']
      setTemplate(t)
      loadSets(data.id, t)
      loadLastWeights(data.focus)
    }
  }

  async function loadSets(sid, t) {
    const { data } = await supabase.from('exercises').select('*').eq('session_id', sid).order('created_at')
    if (data && data.length > 0) {
      const grouped = {}
      data.forEach(e => {
        const key = e.notes || 'A'
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(e)
      })
      setSets(grouped)
    }
  }

  async function logSet(supersetLabel) {
    const ss = template.supersets.find(s => s.label === supersetLabel)
    if (!ss) return
    const input = currentInput[supersetLabel] || {}
    const kgA = parseFloat(input.kgA) || 0
    const repsA = parseInt(input.repsA) || ss.repsA
    const kgB = parseFloat(input.kgB) || 0
    const repsB = parseInt(input.repsB) || ss.repsB
    const feeling = input.feeling || '😊 Good'

    const existing = sets[supersetLabel] || []
    const setNum = existing.length + 1

    await supabase.from('exercises').insert([
      { session_id: sessionId, name: ss.exerciseA, set_number: setNum, kg: kgA, reps: repsA, notes: supersetLabel },
      { session_id: sessionId, name: ss.exerciseB, set_number: setNum, kg: kgB, reps: repsB, notes: supersetLabel + '_B' },
    ])

    const newEntry = { kgA, repsA, kgB, repsB, feeling, setNum }
    setSets(prev => ({ ...prev, [supersetLabel]: [...(prev[supersetLabel] || []), newEntry] }))
    setCurrentInput(prev => ({ ...prev, [supersetLabel]: { kgA: String(kgA), repsA: String(repsA), kgB: String(kgB), repsB: String(repsB), feeling } }))
  }

  async function finishSession() {
    await supabase.from('sessions').update({ rpe, notes }).eq('id', sessionId)
    setSaved(true)
    setTimeout(() => router.push('/'), 1200)
  }

  if (!session || !template) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-zinc-600 text-sm">Loading session...</div>
    </div>
  )

  const date = new Date(session.date + 'T12:00:00')
  const dateLabel = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="px-5 pt-12 pb-32">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push('/')} className="text-xs text-zinc-500 mb-2 block">← Week</button>
        <p className="text-xs text-zinc-500 capitalize">{dateLabel}</p>
        <h1 className="text-2xl font-bold text-white">{session.focus}</h1>
        <p className="text-xs text-zinc-500 mt-1">RPE target: 7 · 20–30s rest between exercises</p>
      </div>

      {/* Movement Prep */}
      <button
        onClick={() => setShowPrep(!showPrep)}
        className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 p-4 mb-4 flex items-center justify-between"
      >
        <div className="text-left">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-0.5">Movement Prep · 5–10 min</p>
          <p className="text-sm text-zinc-300">{template.prep.join(' · ')}</p>
        </div>
        <span className="text-zinc-600">{showPrep ? '▲' : '▼'}</span>
      </button>

      {/* Superset Tabs */}
      <div className="flex gap-2 mb-4">
        {template.supersets.map(ss => {
          const doneSets = (sets[ss.label] || []).length
          return (
            <button
              key={ss.label}
              onClick={() => setActiveSuperset(ss.label)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all relative ${
                activeSuperset === ss.label ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              {ss.label}
              {doneSets > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center ${activeSuperset === ss.label ? 'bg-black text-white' : 'bg-zinc-600 text-white'}`}>
                  {doneSets}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active Superset */}
      {template.supersets.filter(ss => ss.label === activeSuperset).map(ss => {
        const doneSets = sets[ss.label] || []
        const input = currentInput[ss.label] || {}
        const lastSet = doneSets[doneSets.length - 1]

        return (
          <div key={ss.label}>
            {/* Superset Info */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 mb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{ss.type}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 mb-1">Exercise A</p>
                  <p className="text-white font-semibold text-sm">{ss.exerciseA}</p>
                  <p className="text-xs text-zinc-500 mt-1">Target: {ss.repsA} reps</p>
                  {lastWeights[ss.exerciseA] && <p className="text-xs text-zinc-400 mt-0.5">Last: {lastWeights[ss.exerciseA]}kg</p>}
                </div>
                <div className="bg-zinc-800 rounded-xl p-3">
                  <p className="text-xs text-zinc-500 mb-1">Exercise B</p>
                  <p className="text-white font-semibold text-sm">{ss.exerciseB}</p>
                  <p className="text-xs text-zinc-500 mt-1">Target: {ss.repsB} reps</p>
                  {lastWeights[ss.exerciseB] && <p className="text-xs text-zinc-400 mt-0.5">Last: {lastWeights[ss.exerciseB]}kg</p>}
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-3">{doneSets.length} / {ss.setsTarget} sets done</p>
            </div>

            {/* Logged Sets */}
            {doneSets.length > 0 && (
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 mb-3 overflow-hidden">
                <div className="px-4 pt-3 pb-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Logged sets</p>
                </div>
                {doneSets.map((s, i) => (
                  <div key={i} className="flex items-center px-4 py-2.5 border-t border-zinc-800 gap-2">
                    <span className="text-xs text-zinc-600 w-6">#{i + 1}</span>
                    <div className="flex-1">
                      <span className="text-white text-sm font-medium">{s.kgA || 0}kg × {s.repsA || 0}</span>
                      <span className="text-zinc-600 text-xs mx-2">↔</span>
                      <span className="text-white text-sm font-medium">{s.kgB || 0}kg × {s.repsB || 0}</span>
                    </div>
                    <span className="text-sm mr-1">{s.feeling?.split(' ')[0]}</span>
                    <button
                      onClick={async () => {
                        setSets(prev => ({ ...prev, [ss.label]: prev[ss.label].filter((_, idx) => idx !== i) }))
                      }}
                      className="text-zinc-600 text-xs px-2 py-1 rounded-lg active:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4 mb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Log set {doneSets.length + 1}</p>

              {/* Exercise A */}
              <p className="text-xs text-zinc-400 mb-2 font-medium">{ss.exerciseA} {isBodyweight(ss.exerciseA) && <span className="text-zinc-600">(bodyweight)</span>}</p>
              <div className="flex gap-2 mb-3">
                {!isBodyweight(ss.exerciseA) && (
                  <div className="flex-1">
                    <p className="text-xs text-zinc-600 mb-1">KG</p>
                    <input
                      type="number" inputMode="decimal"
                      placeholder={lastSet ? String(lastSet.kgA) : (lastWeights[ss.exerciseA] ? String(lastWeights[ss.exerciseA]) : '0')}
                      value={input.kgA || ''}
                      onChange={e => setCurrentInput(p => ({ ...p, [ss.label]: { ...p[ss.label], kgA: e.target.value } }))}
                      className="w-full bg-zinc-800 rounded-xl px-3 py-3 text-white text-lg font-bold text-center border border-zinc-700 focus:border-white outline-none"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs text-zinc-600 mb-1">Reps</p>
                  <input
                    type="number" inputMode="numeric"
                    placeholder={lastSet ? String(lastSet.repsA) : String(ss.repsA)}
                    value={input.repsA || ''}
                    onChange={e => setCurrentInput(p => ({ ...p, [ss.label]: { ...p[ss.label], repsA: e.target.value } }))}
                    className="w-full bg-zinc-800 rounded-xl px-3 py-3 text-white text-lg font-bold text-center border border-zinc-700 focus:border-white outline-none"
                  />
                </div>
              </div>

              {/* Exercise B */}
              <p className="text-xs text-zinc-400 mb-2 font-medium">{ss.exerciseB} {isBodyweight(ss.exerciseB) && <span className="text-zinc-600">(bodyweight)</span>}</p>
              <div className="flex gap-2 mb-4">
                {!isBodyweight(ss.exerciseB) && (
                  <div className="flex-1">
                    <p className="text-xs text-zinc-600 mb-1">KG</p>
                    <input
                      type="number" inputMode="decimal"
                      placeholder={lastSet ? String(lastSet.kgB) : (lastWeights[ss.exerciseB] ? String(lastWeights[ss.exerciseB]) : '0')}
                      value={input.kgB || ''}
                      onChange={e => setCurrentInput(p => ({ ...p, [ss.label]: { ...p[ss.label], kgB: e.target.value } }))}
                      className="w-full bg-zinc-800 rounded-xl px-3 py-3 text-white text-lg font-bold text-center border border-zinc-700 focus:border-white outline-none"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs text-zinc-600 mb-1">Reps</p>
                  <input
                    type="number" inputMode="numeric"
                    placeholder={lastSet ? String(lastSet.repsB) : String(ss.repsB)}
                    value={input.repsB || ''}
                    onChange={e => setCurrentInput(p => ({ ...p, [ss.label]: { ...p[ss.label], repsB: e.target.value } }))}
                    className="w-full bg-zinc-800 rounded-xl px-3 py-3 text-white text-lg font-bold text-center border border-zinc-700 focus:border-white outline-none"
                  />
                </div>
              </div>

              {/* Feeling */}
              <p className="text-xs text-zinc-600 mb-2">How did it feel?</p>
              <div className="flex gap-2 flex-wrap mb-4">
                {FEELING_OPTIONS.map(f => (
                  <button
                    key={f}
                    onClick={() => setCurrentInput(p => ({ ...p, [ss.label]: { ...p[ss.label], feeling: f } }))}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${input.feeling === f ? 'bg-white text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                onClick={() => logSet(ss.label)}
                className="w-full bg-white text-black rounded-xl py-3.5 font-bold text-sm active:scale-95 transition-all"
              >
                + Log Set {doneSets.length + 1}
              </button>
            </div>

            {/* Next superset hint */}
            {doneSets.length >= ss.setsTarget && activeSuperset !== template.supersets[template.supersets.length - 1].label && (
              <button
                onClick={() => {
                  const idx = template.supersets.findIndex(s => s.label === activeSuperset)
                  setActiveSuperset(template.supersets[idx + 1].label)
                }}
                className="w-full rounded-2xl border border-zinc-700 border-dashed p-3 text-zinc-400 text-sm font-medium active:scale-95 mb-3"
              >
                ✓ Superset {activeSuperset} done · Move to {template.supersets[template.supersets.findIndex(s => s.label === activeSuperset) + 1]?.label} →
              </button>
            )}
          </div>
        )
      })}

      {/* RPE */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 mb-3 mt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Session RPE</p>
          <p className={`text-2xl font-bold ${RPE_COLORS[rpe] || 'text-white'}`}>{rpe}</p>
        </div>
        <input type="range" min="1" max="10" value={rpe}
          onChange={e => setRpe(Number(e.target.value))}
          className="w-full accent-white"
        />
        <div className="flex justify-between text-xs text-zinc-600 mt-1">
          <span>1 Easy</span><span>10 Max</span>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 mb-4">
        <p className="text-sm font-medium mb-2">Notes</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="How did it feel? Anything to note?"
          rows={3}
          className="w-full bg-transparent text-zinc-300 text-sm outline-none resize-none placeholder-zinc-600"
        />
      </div>

      {/* Finish */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto px-5 pb-8 pt-4 bg-gradient-to-t from-black">
        <button
          onClick={finishSession}
          className={`w-full rounded-2xl py-4 font-bold text-base transition-all active:scale-95 ${saved ? 'bg-zinc-700 text-zinc-400' : 'bg-white text-black'}`}
        >
          {saved ? '✓ Saved' : 'Finish Session'}
        </button>
      </div>
    </div>
  )
}
