'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const TAGS = ['Experienced', 'Casual', 'Beginner']
const TOTAL_SLOTS = 6

const STATUS_COLORS = {
  'Not yet sent': 'var(--gb-text-quiet)',
  'Invite sent': 'var(--gb-warn)',
  'Signed up': 'var(--gb-success)',
}

export default function Admin() {
  const router = useRouter()
  const [slots, setSlots] = useState(
    Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
      id: i + 1,
      name: '',
      tag: 'Experienced',
      status: 'Not yet sent',
      token: Math.random().toString(36).slice(2, 10),
    }))
  )
  const [copied, setCopied] = useState(null)

  const signedUp = slots.filter(s => s.status === 'Signed up').length

  function updateSlot(id, field, value) {
    setSlots(s => s.map(slot => slot.id === id ? { ...slot, [field]: value } : slot))
  }

  async function copyLink(slot) {
    const url = `${window.location.origin}/welcome?invite=${slot.token}`
    await navigator.clipboard.writeText(url)
    setCopied(slot.id)
    setTimeout(() => setCopied(null), 2000)
    if (slot.status === 'Not yet sent') {
      updateSlot(slot.id, 'status', 'Invite sent')
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>
          ← Back
        </button>
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
        {slots.map(slot => (
          <div
            key={slot.id}
            style={{
              background: 'var(--gb-bg-card)',
              borderRadius: 'var(--gb-radius-lg)',
              padding: '12px 16px',
            }}
          >
            <p style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--gb-text-quiet)', margin: '0 0 8px', fontWeight: 600 }}>
              SLOT {slot.id}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <input
                  value={slot.name}
                  onChange={e => updateSlot(slot.id, 'name', e.target.value)}
                  placeholder="Tap to add name"
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    color: slot.name ? 'var(--gb-text-primary)' : 'var(--gb-text-quiet)',
                    fontSize: 15, width: '100%', padding: 0,
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <select
                    value={slot.tag}
                    onChange={e => updateSlot(slot.id, 'tag', e.target.value)}
                    style={{
                      background: 'none', border: 'none', outline: 'none',
                      color: 'var(--gb-text-secondary)', fontSize: 12, padding: 0,
                    }}
                  >
                    {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: STATUS_COLORS[slot.status] }}>
                    {slot.status}
                  </span>
                </div>
              </div>
              <button
                aria-label="Copy invite link"
                onClick={() => copyLink(slot)}
                style={{
                  background: 'var(--gb-bg-elevated)', border: 'none', borderRadius: 8,
                  padding: '8px 12px', cursor: 'pointer',
                  color: copied === slot.id ? 'var(--gb-success)' : 'var(--gb-text-secondary)',
                  fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                }}
              >
                {copied === slot.id ? '✓ Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
