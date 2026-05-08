'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

const TAGS = ['experienced', 'casual', 'beginner']
const TAG_LABELS = { experienced: 'Experienced', casual: 'Casual', beginner: 'Beginner' }

const STATUS_COLORS = {
  watching: 'var(--gb-text-quiet)',
  active: 'var(--gb-success)',
  inactive: 'var(--gb-text-secondary)',
  removed: 'var(--gb-destructive)',
}
const STATUS_LABELS = { watching: 'Watching', active: 'Active', inactive: 'Inactive', removed: 'Removed' }
const CATEGORY_LABELS = { bug: 'Bug', idea: 'Idea', confusion: 'Confused', other: 'Other' }

export default function Admin() {
  const router = useRouter()
  const [testers, setTesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  useEffect(() => { loadTesters() }, [])

  async function loadTesters() {
    const { data } = await supabase
      .from('priority_testers')
      .select('*')
      .order('created_at')
    setTesters(data || [])
    setLoading(false)
  }

  async function createTester() {
    const { data } = await supabase
      .from('priority_testers')
      .insert({ tester_tag: 'experienced', status: 'watching' })
      .select()
      .single()
    if (data) setTesters(t => [...t, data])
  }

  async function deleteTester(id) {
    await supabase.from('priority_testers').delete().eq('id', id)
    setTesters(t => t.filter(x => x.id !== id))
  }

  function updateTester(id, field, value) {
    setTesters(t => t.map(x => x.id === id ? { ...x, [field]: value } : x))
  }

  async function saveTester(id) {
    const tester = testers.find(t => t.id === id)
    if (!tester) return
    setSaving(s => ({ ...s, [id]: true }))
    await supabase
      .from('priority_testers')
      .update({ email: tester.email, tester_name: tester.tester_name, tester_tag: tester.tester_tag, notes: tester.notes })
      .eq('id', id)
    setSaving(s => ({ ...s, [id]: false }))
  }

  const active = testers.filter(t => t.status === 'active').length

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>← Back</button>
        <span className="topbar-title">Admin</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gb-text-primary)', margin: 0 }}>
          Priority testers
        </h1>
        <p style={{ fontSize: 13, color: 'var(--gb-text-secondary)', margin: '4px 0 0' }}>
          {active} active
        </p>
      </div>

      <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <p style={{ color: 'var(--gb-text-quiet)', fontSize: 14, padding: '16px 0' }}>Loading…</p>
        ) : (
          <>
            {testers.map(tester => (
              <div key={tester.id} style={{ background: 'var(--gb-bg-card)', borderRadius: 'var(--gb-radius-lg)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: STATUS_COLORS[tester.status] }}>
                    {STATUS_LABELS[tester.status]}
                  </span>
                  {tester.linked_user_id && (
                    <span style={{ fontSize: 10, color: 'var(--gb-success)' }}>● linked</span>
                  )}
                </div>

                <input
                  value={tester.tester_name || ''}
                  onChange={e => updateTester(tester.id, 'tester_name', e.target.value)}
                  onBlur={() => saveTester(tester.id)}
                  placeholder="Name"
                  style={{ background: 'none', border: 'none', outline: 'none', padding: 0, color: tester.tester_name ? 'var(--gb-text-primary)' : 'var(--gb-text-quiet)', fontSize: 15, width: '100%', marginBottom: 4 }}
                />
                <input
                  value={tester.email || ''}
                  onChange={e => updateTester(tester.id, 'email', e.target.value)}
                  onBlur={() => saveTester(tester.id)}
                  placeholder="Email address"
                  type="email"
                  style={{ background: 'none', border: 'none', outline: 'none', padding: 0, color: tester.email ? 'var(--gb-text-secondary)' : 'var(--gb-text-quiet)', fontSize: 13, width: '100%', marginBottom: 4 }}
                />
                <input
                  value={tester.notes || ''}
                  onChange={e => updateTester(tester.id, 'notes', e.target.value)}
                  onBlur={() => saveTester(tester.id)}
                  placeholder="Notes"
                  style={{ background: 'none', border: 'none', outline: 'none', padding: 0, color: tester.notes ? 'var(--gb-text-secondary)' : 'var(--gb-text-quiet)', fontSize: 13, width: '100%', marginBottom: 8 }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <select
                    value={tester.tester_tag || 'experienced'}
                    onChange={e => { updateTester(tester.id, 'tester_tag', e.target.value); saveTester(tester.id) }}
                    style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--gb-text-secondary)', fontSize: 12, padding: 0 }}
                  >
                    {TAGS.map(t => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}
                  </select>
                  <button
                    onClick={() => deleteTester(tester.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gb-destructive)', fontSize: 12, padding: '4px 0' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={createTester}
              style={{ background: 'none', border: '1px dashed var(--gb-border)', borderRadius: 'var(--gb-radius-lg)', padding: '14px 16px', color: 'var(--gb-text-quiet)', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
            >
              + Add priority tester
            </button>
          </>
        )}
      </div>

      <FeedbackSection priorityTesterEmails={testers.map(t => t.email).filter(Boolean)} />
    </div>
  )
}

function FeedbackSection({ priorityTesterEmails }) {
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterPriority, setFilterPriority] = useState(false)

  useEffect(() => { loadFeedback() }, [])

  async function loadFeedback() {
    const supabase = createClient()
    const { data } = await supabase
      .from('feedback_messages')
      .select('*, profiles(display_name, tester_profile)')
      .order('created_at', { ascending: false })
    setFeedback(data || [])
    setLoading(false)
  }

  async function toggleRead(id, current) {
    const supabase = createClient()
    await supabase.from('feedback_messages').update({ read_by_admin: !current }).eq('id', id)
    setFeedback(f => f.map(item => item.id === id ? { ...item, read_by_admin: !current } : item))
  }

  const displayed = filterPriority
    ? feedback.filter(f => priorityTesterEmails.includes(f.profiles?.email))
    : feedback

  const unread = feedback.filter(f => !f.read_by_admin).length

  return (
    <div style={{ padding: '0 16px 48px' }}>
      <div style={{ padding: '8px 4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--gb-text-secondary)', margin: 0 }}>
          FEEDBACK {unread > 0 && <span style={{ color: 'var(--gb-warn)' }}>· {unread} unread</span>}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterPriority}
            onChange={e => setFilterPriority(e.target.checked)}
            style={{ accentColor: 'var(--gb-accent)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--gb-text-secondary)' }}>Priority only</span>
        </label>
      </div>

      {loading ? (
        <p style={{ color: 'var(--gb-text-quiet)', fontSize: 14 }}>Loading…</p>
      ) : displayed.length === 0 ? (
        <p style={{ color: 'var(--gb-text-quiet)', fontSize: 14 }}>No feedback yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(item => (
            <div
              key={item.id}
              style={{
                background: item.read_by_admin ? 'var(--gb-bg-card)' : '#1a1a2e',
                borderRadius: 'var(--gb-radius-lg)',
                padding: '12px 16px',
                borderLeft: item.read_by_admin ? 'none' : '3px solid var(--gb-accent)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--gb-text-primary)' }}>
                    {item.profiles?.display_name || 'Unknown'}
                  </span>
                  {item.category && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--gb-text-secondary)', background: 'var(--gb-bg-elevated)', borderRadius: 4, padding: '2px 6px' }}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--gb-text-quiet)' }}>
                  {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--gb-text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
                {item.message}
              </p>
              <button
                onClick={() => toggleRead(item.id, item.read_by_admin)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: 'var(--gb-text-quiet)' }}
              >
                {item.read_by_admin ? 'Mark as unread' : 'Mark as read'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
