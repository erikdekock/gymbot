'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const DEFAULT_EXERCISES = [
  { key: 'squat', label: 'Squat', unit: 'kg' },
  { key: 'deadlift', label: 'Deadlift', unit: 'kg' },
  { key: 'bench_press', label: 'Bench press', unit: 'kg' },
  { key: 'overhead_press', label: 'Overhead press', unit: 'kg' },
  { key: 'romanian_deadlift', label: 'Romanian deadlift', unit: 'kg' },
  { key: 'pull_ups', label: 'Pull-ups', unit: 'bw' },
  { key: 'dips', label: 'Dips', unit: 'bw' },
]

export default function TargetWeights() {
  const router = useRouter()
  const [weights, setWeights] = useState({})
  const [original, setOriginal] = useState({})
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    loadWeights()
  }, [])

  async function loadWeights() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/welcome'); return }
    setUserId(user.id)
    const { data } = await supabase.from('profiles').select('target_weights').eq('id', user.id).single()
    const w = data?.target_weights || {}
    setWeights(w)
    setOriginal(w)
  }

  const hasChanges = JSON.stringify(weights) !== JSON.stringify(original)

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .upsert({ id: userId, target_weights: weights }, { onConflict: 'id' })
    if (error) {
      alert('Couldn't save. Check your connection and try again.')
    } else {
      setOriginal(weights)
    }
    setSaving(false)
  }

  function updateWeight(key, value) {
    setWeights(w => ({ ...w, [key]: value }))
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>
          ← Back
        </button>
        <span className="topbar-title">Target weights</span>
        {hasChanges ? (
          <button className="topbar-action" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        ) : (
          <div style={{ width: 48 }} />
        )}
      </div>

      <div className="grouped-card" style={{ marginTop: 8 }}>
        {DEFAULT_EXERCISES.map(ex => (
          <div key={ex.key} className="list-row">
            <span className="list-row-label">{ex.label}</span>
            {ex.unit === 'bw' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13, color: 'var(--gb-text-quiet)' }}>BW ×</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={weights[ex.key] || ''}
                  onChange={e => updateWeight(ex.key, e.target.value)}
                  placeholder="0"
                  style={{
                    width: 48, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--gb-text-primary)', fontSize: 15, textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--gb-text-quiet)' }}>reps</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weights[ex.key] || ''}
                  onChange={e => updateWeight(ex.key, e.target.value)}
                  placeholder="0"
                  style={{
                    width: 56, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--gb-text-primary)', fontSize: 15, textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--gb-text-quiet)' }}>kg</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
