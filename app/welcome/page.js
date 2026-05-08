'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

function WelcomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slot, setSlot] = useState(null)
  const [slotLoading, setSlotLoading] = useState(!!inviteToken)
  const [slotError, setSlotError] = useState('')
  const [emailEdited, setEmailEdited] = useState(false)
  const [originalEmail, setOriginalEmail] = useState('')

  useEffect(() => {
    if (inviteToken) {
      validateToken(inviteToken)
    }
  }, [inviteToken])

  async function validateToken(token) {
    setSlotLoading(true)
    const { data, error } = await supabase
      .from('invite_slots')
      .select('*')
      .eq('token', token)
      .single()

    setSlotLoading(false)

    if (error || !data) {
      setSlotError('This invite link is not valid. Please ask the person who sent it for a new one.')
      return
    }

    if (data.status === 'signed_up') {
      setSlotError('This invite link has already been used. If this is your account, you can sign in instead.')
      return
    }

    setSlot(data)
    if (data.email) {
      setEmail(data.email)
      setOriginalEmail(data.email)
    }
  }

  // No invite token — block signup
  if (!inviteToken && !slotLoading) {
    return (
      <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
        <div>
          <p className="auth-wordmark">GYMBOT</p>
          <div style={{ marginTop: 48 }}>
            <h1 className="auth-tagline">Invite only.</h1>
            <p style={{ fontSize: 15, color: 'var(--gb-text-secondary)', marginTop: 12, lineHeight: 1.5 }}>
              GymBot is invite-only during alpha. Ask a friend who is already in if you would like to try it.
            </p>
          </div>
        </div>
        <button className="auth-btn-ghost" onClick={() => router.push('/login')}>
          I already have an account
        </button>
      </div>
    )
  }

  // Token is being validated
  if (slotLoading) {
    return (
      <div className="auth-screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--gb-text-quiet)', fontSize: 15 }}>Checking your invite…</p>
      </div>
    )
  }

  // Token invalid or already claimed
  if (slotError) {
    return (
      <div className="auth-screen" style={{ justifyContent: 'space-between', paddingTop: 64, paddingBottom: 48 }}>
        <div>
          <p className="auth-wordmark">GYMBOT</p>
          <div style={{ marginTop: 48 }}>
            <h1 className="auth-tagline">This link does not work.</h1>
            <p style={{ fontSize: 15, color: 'var(--gb-text-secondary)', marginTop: 12, lineHeight: 1.5 }}>
              {slotError}
            </p>
          </div>
        </div>
        <button className="auth-btn-ghost" onClick={() => router.push('/login')}>
          Sign in instead
        </button>
      </div>
    )
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canSubmit = isValidEmail && agreed && !loading

  async function handleSubmit() {
    if (!canSubmit) {
      if (!isValidEmail) setError('That does not look like a valid email.')
      else if (!agreed) setError('Please accept the notice to continue.')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?invite=${inviteToken}`,
      },
    })
    if (err) {
      setError('We could not send the link. Try again.')
      setLoading(false)
    } else {
      router.push(`/check-email?email=${encodeURIComponent(email)}&invite=${inviteToken}`)
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
            onChange={e => {
              setEmail(e.target.value)
              setError('')
              if (originalEmail && e.target.value !== originalEmail) {
                setEmailEdited(true)
              } else {
                setEmailEdited(false)
              }
            }}
            autoComplete="email"
            inputMode="email"
          />
          {emailEdited && originalEmail && (
            <p style={{ fontSize: 12, color: 'var(--gb-text-secondary)', margin: 0, lineHeight: 1.4 }}>
              This invite was set up for {originalEmail}. You can continue with a different email — the magic link will go to whatever you enter here.
            </p>
          )}
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
            <span style={{ color: 'var(--gb-text-tertiary)', textDecoration: 'underline' }}>
              terms and privacy notice
            </span>
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

export default function Welcome() {
  return (
    <Suspense fallback={<div className="auth-screen" />}>
      <WelcomeContent />
    </Suspense>
  )
}
