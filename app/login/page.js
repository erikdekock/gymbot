'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleSubmit() {
    if (!isValidEmail) { setError('That doesn't look like a valid email.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setError('We couldn't send the link. Try again.')
      setLoading(false)
    } else {
      router.push(`/check-email?email=${encodeURIComponent(email)}`)
    }
  }

  return (
    <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
      <div>
        <p className="auth-wordmark">GYMBOT</p>
        <div style={{ marginTop: 48 }}>
          <h1 className="auth-tagline">Welcome back.</h1>
          <p style={{ fontSize: 15, color: 'var(--gb-text-secondary)', marginTop: 8 }}>
            Enter your email and we'll send you a link.
          </p>
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
        <button
          className="auth-btn"
          style={{ marginTop: 8 }}
          disabled={!isValidEmail || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Sending…' : 'Send me a link'}
        </button>
        <button className="auth-btn-ghost" onClick={() => router.back()}>
          Back
        </button>
      </div>
    </div>
  )
}
