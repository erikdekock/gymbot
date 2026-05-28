'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import Wordmark from '../onboarding/_components/Wordmark'

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
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top">
          <Wordmark size="primary" />
          <div style={{ marginTop: 48 }}>
            <h1 className="rep-heading">Return to the work.</h1>
          </div>
        </div>

        <div className="rep-screen__bottom">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="rep-field-label" htmlFor="welcome-email">Email</label>
            <input
              id="welcome-email"
              className={`rep-input ${error && !isValidEmail ? 'rep-input--error' : ''}`}
              type="email"
              placeholder="your email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoComplete="email"
              inputMode="email"
            />
            {error && <p className="rep-input-error">{error}</p>}
          </div>

          <label className="rep-check">
            <input
              className="rep-check__input"
              type="checkbox"
              checked={agreed}
              onChange={e => { setAgreed(e.target.checked); setError('') }}
            />
            <span className="rep-check__label">
              I agree to the{' '}
              <a href="/terms-alpha" target="_blank" rel="noopener noreferrer">
                terms and privacy notice
              </a>
            </span>
          </label>

          <button
            className="rep-btn rep-btn--primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {loading ? 'Sending…' : 'Send me the link'}
          </button>

          <button className="rep-btn tertiary" onClick={() => router.push('/login')}>
            I already have an account
          </button>
        </div>
      </div>
    </div>
  )
}
