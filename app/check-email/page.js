'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import Wordmark from '../onboarding/_components/Wordmark'
import OtpInput from './OtpInput'

const supabase = createClient()

// Key the email + send-time in sessionStorage rather than the URL — the email
// shouldn't sit in browser history (the "safe session state" the entry
// surfaces hand off, per ticket §3).
const EMAIL_KEY = 'reprise.otp.email'
const SENT_AT_KEY = 'reprise.otp.sent_at'

// Supabase collapses "wrong code" and "expired code" into a single
// otp_expired / 403 error ("Token has expired or is invalid"). We log the
// real error server-side regardless, and disambiguate the *user-facing*
// message by elapsed time: past the OTP TTL it's genuinely expired, otherwise
// it's a mismatch. Must match the dashboard's Email OTP Expiration.
const OTP_TTL_SECONDS = 3600
const RESEND_COOLDOWN_SECONDS = 60

// Fire-and-forget: ship the real Supabase error to a server route so it lands
// in the function logs (AC5 — real errors logged server-side per failure mode).
function logAuthError(phase, mode, error) {
  try {
    const body = JSON.stringify({
      phase,
      mode,
      code: error?.code ?? null,
      status: error?.status ?? null,
      message: error?.message ?? null,
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/auth/log', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })
    }
  } catch {
    /* logging must never break the auth flow */
  }
}

function classifyVerifyError(error) {
  const code = error?.code || ''
  if (error?.status === 429 || code.includes('rate')) return 'rate_limit'
  const sentAt = Number(sessionStorage.getItem(SENT_AT_KEY)) || 0
  const elapsed = (Date.now() - sentAt) / 1000
  if (sentAt && elapsed > OTP_TTL_SECONDS) return 'expired'
  // otp_expired within TTL, or any other 4xx → treat as a mismatch.
  return 'wrong'
}

const MESSAGES = {
  wrong: "That code didn't match. Try again.",
  expired: 'That code has expired. Request a new one.',
  rate_limit: 'Too many attempts. Wait a moment before trying again.',
}

function CheckEmailContent() {
  const router = useRouter()
  const [email, setEmail] = useState(null)
  const [code, setCode] = useState('')
  const [attempt, setAttempt] = useState('') // failed code kept for the error beat
  const [status, setStatus] = useState('idle') // idle | verifying | error
  const [errorMode, setErrorMode] = useState(null) // wrong | expired | rate_limit
  const [cooldown, setCooldown] = useState(0)
  const verifyingRef = useRef(false)

  // Pull the handed-off email; without it there's nothing to verify.
  useEffect(() => {
    const stored = sessionStorage.getItem(EMAIL_KEY)
    if (!stored) {
      router.replace('/welcome')
      return
    }
    setEmail(stored)
  }, [router])

  // Resend cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // When the rate-limit window elapses, clear the "too many attempts" message
  // (it's tied to the countdown — once Resend is available again it's stale).
  useEffect(() => {
    if (cooldown === 0 && errorMode === 'rate_limit') {
      setErrorMode(null)
      setStatus('idle')
    }
  }, [cooldown, errorMode])

  function handleChange(next) {
    // First keystroke after an error clears the error and starts fresh
    // (spec §03a: "after the beat, cells clear and focus returns to cell 1").
    if (status === 'error') { setStatus('idle'); setAttempt('') }
    if (errorMode && errorMode !== 'rate_limit') setErrorMode(null)
    setCode(next)
  }

  async function handleComplete(fullCode) {
    if (verifyingRef.current || !email) return
    verifyingRef.current = true
    setStatus('verifying')
    setErrorMode(null)

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: fullCode,
      type: 'email',
    })

    if (error || !data?.session) {
      const mode = error ? classifyVerifyError(error) : 'wrong'
      logAuthError('verify', mode, error)
      setErrorMode(mode)
      // Wrong/expired recolour the cells (is-error); rate-limit does not (the
      // code wasn't wrong). Keep the failed digits visible for the beat (they
      // clear on the next keystroke); reset the live input so the user can
      // retype immediately.
      setStatus('error')
      setAttempt(fullCode)
      setCode('')
      if (mode === 'rate_limit' && cooldown <= 0) setCooldown(RESEND_COOLDOWN_SECONDS)
      verifyingRef.current = false
      return
    }

    // Session created. Preserve the old /auth/callback side-effect: link a
    // priority tester by email match. RLS gates this to the relevant rows; for
    // an ordinary user it's a harmless no-op (same as the old callback).
    try {
      if (data.user?.email) {
        await supabase
          .from('priority_testers')
          .update({ linked_user_id: data.user.id, status: 'active' })
          .eq('email', data.user.email)
          .is('linked_user_id', null)
      }
    } catch {
      /* linking is best-effort — never block sign-in on it */
    }

    sessionStorage.removeItem(EMAIL_KEY)
    sessionStorage.removeItem(SENT_AT_KEY)
    router.push('/first-login')
  }

  async function resend() {
    if (cooldown > 0 || !email) return
    setCooldown(RESEND_COOLDOWN_SECONDS)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    if (error) {
      logAuthError('resend', error.status === 429 ? 'rate_limit' : 'send', error)
      if (error.status === 429 || (error.code || '').includes('rate')) {
        setErrorMode('rate_limit')
        setStatus('idle') // rate-limit doesn't recolour the cells
      }
      return
    }
    sessionStorage.setItem(SENT_AT_KEY, String(Date.now()))
    // Fresh code sent — clear any prior error.
    setErrorMode(null)
    setStatus('idle')
    setCode('')
  }

  if (!email) return <div className="rep-surface" />

  const verifying = status === 'verifying'
  const showCellError = status === 'error' && errorMode !== 'rate_limit'
  const helperText = verifying ? 'Verifying…' : 'The code expires in 1 hour.'
  const cooldownLabel = `Resend available in 0:${cooldown < 10 ? '0' : ''}${cooldown}`

  return (
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top">
          <Wordmark size="small" />
          <div style={{ marginTop: 40 }}>
            {/* Eyebrow stays muted graphite — the single sage moment on this
                surface is the active OTP cell, not the eyebrow (spec §03). */}
            <p
              style={{
                fontFamily: 'var(--rep-font-mono)',
                fontSize: '0.75rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--graphite-30)',
                margin: '0 0 var(--rep-space-3)',
              }}
            >
              Verify
            </p>
            <h1 className="rep-heading">Enter your code</h1>
            <p className="rep-body">
              We sent a 6-digit code to <strong>{email}</strong>. Enter it below.
            </p>
          </div>

          <div style={{ marginTop: 8 }}>
            <OtpInput
              value={code}
              displayValue={status === 'error' ? attempt : code}
              onChange={handleChange}
              onComplete={handleComplete}
              error={showCellError}
              verifying={verifying}
              describedById={errorMode ? 'otp-error' : undefined}
            />
            {errorMode ? (
              <p className="rep-input-error" id="otp-error" style={{ marginTop: 12 }}>
                {MESSAGES[errorMode]}
              </p>
            ) : (
              <p className="rep-helper" style={{ marginTop: 16 }}>{helperText}</p>
            )}
          </div>
        </div>

        <div className="rep-screen__bottom" style={{ gap: 2 }}>
          <button
            className="rep-btn tertiary"
            onClick={resend}
            disabled={cooldown > 0}
          >
            {cooldown > 0 ? cooldownLabel : 'Resend code'}
          </button>
          <button
            className="rep-btn tertiary"
            onClick={() => {
              sessionStorage.removeItem(EMAIL_KEY)
              sessionStorage.removeItem(SENT_AT_KEY)
              router.push('/welcome')
            }}
          >
            Use a different email
          </button>
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
