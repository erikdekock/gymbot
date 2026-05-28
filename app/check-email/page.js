'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import Wordmark from '../onboarding/_components/Wordmark'

const supabase = createClient()

function CheckEmailContent() {
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
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top">
          <Wordmark size="small" />
          <div style={{ marginTop: 48 }}>
            <h1 className="rep-heading">Check your email.</h1>
            <p className="rep-body">
              We sent a link to <strong>{email}</strong>. Tap the link to continue.
            </p>
          </div>
        </div>

        <div className="rep-screen__bottom">
          <p className="rep-helper" style={{ margin: 0 }}>
            Didn&apos;t get it? Check your spam folder
            {cooldown > 0 ? (
              <> or resend the link in {cooldown}s.</>
            ) : (
              <>
                {' or '}
                <button
                  className="rep-btn tertiary"
                  onClick={resend}
                  style={{ display: 'inline', minHeight: 0, padding: 0 }}
                >
                  resend the link
                </button>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function CheckEmail() {
  return (
    <Suspense fallback={<div className="rep-surface" />}>
      <CheckEmailContent />
    </Suspense>
  )
}
