'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import Wordmark from '../onboarding/_components/Wordmark'

const supabase = createClient()

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleSubmit() {
    if (!isValidEmail) { setError('That does not look like a valid email.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setError('We could not send the link. Try again.')
      setLoading(false)
    } else {
      router.push(`/check-email?email=${encodeURIComponent(email)}`)
    }
  }

  return (
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top">
          <Wordmark size="primary" />
          <div style={{ marginTop: 48 }}>
            <h1 className="rep-heading">Welcome back.</h1>
            <p className="rep-helper">
              Enter your email and we&apos;ll send you a link.
            </p>
          </div>
        </div>

        <div className="rep-screen__bottom">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="rep-field-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className={`rep-input ${error ? 'rep-input--error' : ''}`}
              type="email"
              placeholder="your email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              autoComplete="email"
              inputMode="email"
            />
            {error && <p className="rep-input-error">{error}</p>}
          </div>
          <button
            className="rep-btn rep-btn--primary"
            disabled={!isValidEmail || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Sending…' : 'Send me a link'}
          </button>
          <button className="rep-btn tertiary" onClick={() => router.back()}>
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
