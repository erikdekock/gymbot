'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

const supabase = createClient()

const CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'confusion', label: 'Confused about something' },
  { value: 'other', label: 'Other' },
]

export default function FeedbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!message.trim()) { setError('Please write something before submitting.'); return }
    setSubmitting(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/welcome'); return }

    const { error: err } = await supabase.from('feedback_messages').insert({
      user_id: user.id,
      message: message.trim(),
      category: category || null,
    })

    if (err) {
      setError('Could not send feedback. Try again.')
      setSubmitting(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="topbar-back" onClick={() => router.push('/profile')}>← Back</button>
          <span className="topbar-title">Feedback</span>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--gb-text-primary)', margin: '0 0 8px' }}>
            Thanks — we read everything.
          </p>
          <p style={{ fontSize: 14, color: 'var(--gb-text-secondary)', margin: 0 }}>
            Your feedback has been sent.
          </p>
          <button
            className="auth-btn"
            style={{ marginTop: 32 }}
            onClick={() => router.push('/profile')}
          >
            Back to profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>← Back</button>
        <span className="topbar-title">Send feedback</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ padding: '8px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Category picker */}
        <div>
          <p className="section-label" style={{ padding: 0, margin: '0 0 8px' }}>CATEGORY (OPTIONAL)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(category === c.value ? null : c.value)}
                style={{
                  background: category === c.value ? 'var(--gb-text-primary)' : 'var(--gb-bg-card)',
                  color: category === c.value ? '#000' : 'var(--gb-text-secondary)',
                  border: 'none', borderRadius: 20, padding: '6px 14px',
                  fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <p className="section-label" style={{ padding: 0, margin: '0 0 8px' }}>MESSAGE</p>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setError('') }}
            placeholder="What's on your mind? Be as specific as you can."
            rows={6}
            style={{
              width: '100%', background: 'var(--gb-bg-card)', border: '1px solid var(--gb-border)',
              borderRadius: 12, padding: '14px 16px', fontSize: 15, color: 'var(--gb-text-primary)',
              outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
          {error && <p className="auth-error" style={{ marginTop: 4 }}>{error}</p>}
        </div>

        <button
          className="auth-btn"
          disabled={!message.trim() || submitting}
          onClick={submit}
        >
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
    </div>
  )
}
