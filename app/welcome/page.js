'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

export default function Welcome() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canSubmit = isValidEmail && agreed && !loading

  async function handleSubmit() {
    if (!canSubmit) {
      if (!isValidEmail) setError('Please check the email address — that format isn\'t valid.')
      else if (!agreed) setError('Please accept the notice to continue.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (err) {
        if (err.name === 'AuthRetryableFetchError') {
          setError('No connection right now. Check your network — we\'ll send the link when you\'re back online.')
        } else if (err.status === 429 || err.code === 'over_email_send_rate_limit') {
          setError('Too many sign-in attempts in a row. Wait a few minutes before trying again.')
        } else {
          setError('Something failed on our end and the link wasn\'t sent. Try again in a few minutes. If it keeps failing, email us at hello@reprise.coach.')
        }
        setLoading(false)
      } else {
        router.push(`/check-email?email=${encodeURIComponent(email)}`)
      }
    } catch (e) {
      setError('No connection right now. Check your network — we\'ll send the link when you\'re back online.')
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
      <div>
        <p className="auth-wordmark">GYMBOT</p>
        <div style={{ marginTop: 48 }}>
          <h1 className="auth-tagline">Personal training,<br />simplified.</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <p className="auth-error">{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--gb-text-secondary)' }}>Email</label>
          <input
            className="auth-input"
            type="email"
            placeholder="your email address"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            autoComplete="email"
            inputMode="email"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => { setAgreed(e.target.checked); setError('') }}
            style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--gb-accent)' }}
          />
          <span style={{ fontSize: 13, color: 'var(--gb-text-secondary)', lineHeight: 1.4 }}>
            I agree to the{' '}
            <a
              href="/terms-alpha"
              target="_blank"
              style={{ color: 'var(--gb-text-tertiary)', textDecoration: 'underline' }}
            >
              terms and privacy notice
            </a>
          </span>
        </label>

        <button
          className="auth-btn"
          style={{ marginTop: 8 }}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {loading ? 'Sending…' : 'Send me the link'}
        </button>

        <button className="auth-btn-ghost" onClick={() => router.push('/login')}>
          I already have an account
        </button>
      </div>
    </div>
  )
}
