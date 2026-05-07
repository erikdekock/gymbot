'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function CheckEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [cooldown, setCooldown] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [cooldown])

  async function resend() {
    if (cooldown > 0 || loading) return
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setCooldown(60)
    setLoading(false)
  }

  return (
    <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
      <div>
        <p className="auth-wordmark">GYMBOT</p>
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 24 }}>✉️</div>
          <h1 className="auth-tagline" style={{ textAlign: 'center' }}>Check your email.</h1>
          <p style={{ fontSize: 15, color: 'var(--gb-text-secondary)', marginTop: 12, lineHeight: 1.5 }}>
            We sent a link to <strong style={{ color: 'var(--gb-text-primary)' }}>{email}</strong>.{' '}
            Tap the link to continue.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--gb-text-quiet)', lineHeight: 1.5 }}>
          Didn't get it? Check your spam folder or{' '}
          {cooldown > 0 ? (
            <span>resend the link in {cooldown}s</span>
          ) : (
            <button
              onClick={resend}
              style={{
                background: 'none', border: 'none', color: 'var(--gb-text-secondary)',
                textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0,
              }}
            >
              resend the link
            </button>
          )}
        </p>
      </div>
    </div>
  )
}

export default function CheckEmail() {
  return (
    <Suspense fallback={<div className="auth-screen" />}>
      <CheckEmailContent />
    </Suspense>
  )
}
