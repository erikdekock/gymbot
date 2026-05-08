'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

const TAGS = ['experienced', 'casual', 'beginner']
const TAG_LABELS = { experienced: 'Experienced', casual: 'Casual', beginner: 'Beginner' }
const TOTAL_SLOTS = 6

const STATUS_COLORS = {
  not_yet_sent: 'var(--gb-text-quiet)',
  invite_sent: 'var(--gb-warn)',
  signed_up: 'var(--gb-success)',
}
const STATUS_LABELS = {
  not_yet_sent: 'Not yet sent',
  invite_sent: 'Invite sent',
  signed_up: 'Signed up',
}

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function Admin() {
  const router = useRouter()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)
  const [saving, setSaving] = useState({})
  const [duplicateEmails, setDuplicateEmails] = useState({})

  useEffect(() => {
    loadSlots()
  }, [])

  async function loadSlots() {
    const { data, error } = await supabase
      .from('invite_slots')
      .select('*')
      .order('created_at')
    if (!error) setSlots(data || [])
    setLoading(false)
  }

  async function createSlot() {
    if (slots.length >= TOTAL_SLOTS) return
    const token = generateToken()
    const { data, error } = await supabase
      .from('invite_slots')
      .insert({ token, tester_tag: 'experienced' })
      .select()
      .single()
    if (!error && data) setSlots(s => [...s, data])
  }

  async function deleteSlot(id) {
    const { error } = await supabase.from('invite_slots').delete().eq('id', id)
    if (!error) setSlots(s => s.filter(slot => slot.id !== id))
  }

  async function updateSlot(id, field, value) {
    // Check for duplicate email
    if (field === 'email' && value) {
      const isDuplicate = slots.some(s => s.id !== id && s.email === value)
      setDuplicateEmails(d => ({ ...d, [id]: isDuplicate }))
    } else if (field === 'email') {
      setDuplicateEmails(d => ({ ...d, [id]: false }))
    }

    // Optimistic update
    setSlots(s => s.map(slot => slot.id === id ? { ...slot, [field]: value } : slot))
  }

  async function saveSlot(id) {
    const slot = slots.find(s => s.id === id)
    if (!slot || slot.status === 'signed_up') return
    setSaving(s => ({ ...s, [id]: true }))
    await supabase
      .from('invite_slots')
      .update({
        email: slot.email,
        tester_name: slot.tester_name,
        tester_tag: slot.tester_tag,
        status: slot.status,
      })
      .eq('id', id)
    setSaving(s => ({ ...s, [id]: false }))
  }

  async function markAsSent(id) {
    setSlots(s => s.map(slot => slot.id === id ? { ...slot, status: 'invite_sent' } : slot))
    await supabase.from('invite_slots').update({ status: 'invite_sent' }).eq('id', id)
  }

  async function copyLink(slot) {
    const url = `${window.location.origin}/welcome?invite=${slot.token}`
    await navigator.clipboard.writeText(url)
    setCopied(slot.id)
    setTimeout(() => setCopied(null), 2000)
    if (slot.status === 'not_yet_sent') {
      await markAsSent(slot.id)
    }
  }

  const signedUp = slots.filter(s => s.status === 'signed_up').length

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>← Back</button>
        <span className="topbar-title">Admin</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gb-text-primary)', margin: 0 }}>
          Alpha invites
        </h1>
        <p style={{ fontSize: 13, color: 'var(--gb-text-secondary)', margin: '4px 0 0' }}>
          {signedUp} of {TOTAL_SLOTS} signed up
        </p>
      </div>

      <div style={{ padding: '8px 16px 48px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <p style={{ color: 'var(--gb-text-quiet)', fontSize: 14, padding: '16px 0' }}>Loading…</p>
        ) : (
          <>
            {slots.map(slot => (
              <div
                key={slot.id}
                style={{
                  background: 'var(--gb-bg-card)',
                  borderRadius: 'var(--gb-radius-lg)',
                  padding: '12px 16px',
                  opacity: slot.status === 'signed_up' ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--gb-text-quiet)', margin: 0, fontWeight: 600 }}>
                    {slot.token}
                  </p>
                  <span style={{ fontSize: 11, color: STATUS_COLORS[slot.status] }}>
                    {STATUS_LABELS[slot.status]}
                  </span>
                </div>

                <input
                  value={slot.tester_name || ''}
                  onChange={e => updateSlot(slot.id, 'tester_name', e.target.value)}
                  onBlur={() => saveSlot(slot.id)}
                  placeholder="Name"
                  disabled={slot.status === 'signed_up'}
                  style={{
                    background: 'none', border: 'none', outline: 'none', padding: 0,
                    color: slot.tester_name ? 'var(--gb-text-primary)' : 'var(--gb-text-quiet)',
                    fontSize: 15, width: '100%', marginBottom: 4,
                  }}
                />

                <input
                  value={slot.email || ''}
                  onChange={e => updateSlot(slot.id, 'email', e.target.value)}
                  onBlur={() => saveSlot(slot.id)}
                  placeholder="Email address"
                  type="email"
                  disabled={slot.status === 'signed_up'}
                  style={{
                    background: 'none', border: 'none', outline: 'none', padding: 0,
                    color: slot.email ? 'var(--gb-text-secondary)' : 'var(--gb-text-quiet)',
                    fontSize: 13, width: '100%', marginBottom: 4,
                  }}
                />

                {duplicateEmails[slot.id] && (
                  <p style={{ fontSize: 11, color: 'var(--gb-warn)', margin: '0 0 4px' }}>
                    This email already has an invite slot.
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <select
                    value={slot.tester_tag || 'experienced'}
                    onChange={e => { updateSlot(slot.id, 'tester_tag', e.target.value); saveSlot(slot.id) }}
                    disabled={slot.status === 'signed_up'}
                    style={{
                      background: 'none', border: 'none', outline: 'none',
                      color: 'var(--gb-text-secondary)', fontSize: 12, padding: 0,
                    }}
                  >
                    {TAGS.map(t => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}
                  </select>

                  <div style={{ display: 'flex', gap: 8 }}>
                    {slot.status !== 'signed_up' && (
                      <button
                        onClick={() => deleteSlot(slot.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--gb-destructive)', fontSize: 12, padding: '4px 0',
                        }}
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => copyLink(slot)}
                      style={{
                        background: 'var(--gb-bg-elevated)', border: 'none', borderRadius: 8,
                        padding: '6px 12px', cursor: 'pointer',
                        color: copied === slot.id ? 'var(--gb-success)' : 'var(--gb-text-secondary)',
                        fontSize: 12, fontWeight: 500,
                      }}
                    >
                      {copied === slot.id ? '✓ Copied' : 'Copy link'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {slots.length < TOTAL_SLOTS && (
              <button
                onClick={createSlot}
                style={{
                  background: 'none', border: '1px dashed var(--gb-border)',
                  borderRadius: 'var(--gb-radius-lg)', padding: '14px 16px',
                  color: 'var(--gb-text-quiet)', fontSize: 14, cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                + Create invite slot ({TOTAL_SLOTS - slots.length} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
