'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '../lib/supabase/client'
import { COPY } from '../lib/book-config'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Email-only sign-in. No password anywhere: Supabase sends a magic link and
// /auth/callback turns it into a session.
export default function SignIn({ authEnabled }) {
  const c = COPY.landing
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setState('error')
      setMessage(c.invalidEmail)
      return
    }

    // No backend configured (local preview): just go read.
    if (!authEnabled) {
      window.location.href = '/read'
      return
    }

    setState('sending')
    setMessage('')
    try {
      const supabase = getSupabaseBrowser()
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
      setState('sent')
    } catch {
      setState('error')
      setMessage(c.error)
    }
  }

  if (state === 'sent') {
    return (
      <div className="text-center">
        <h2 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
          {c.sentTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {c.sentBody}
        </p>
        <button
          onClick={() => setState('idle')}
          className="mt-6 text-xs underline underline-offset-4"
          style={{ color: 'var(--ink-soft)' }}
        >
          {c.sentAgain}
        </button>
      </div>
    )
  }

  return (
    // noValidate: we show our own Dutch message rather than the browser's
    // native tooltip, which would otherwise block submit before onSubmit runs.
    <form onSubmit={submit} noValidate className="mx-auto w-full max-w-sm">
      <label htmlFor="email" className="sr-only">
        {c.emailLabel}
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (state === 'error') setState('idle')
        }}
        placeholder={c.emailPlaceholder}
        className="w-full rounded-full px-5 py-3 text-center text-sm outline-none transition-colors"
        style={{
          background: 'var(--panel)',
          border: `1px solid ${state === 'error' ? '#c0532f' : 'var(--rule)'}`,
          color: 'var(--ink)',
        }}
      />

      <button
        type="submit"
        disabled={state === 'sending'}
        className="mt-3 w-full rounded-full py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: 'var(--accent)' }}
      >
        {state === 'sending' ? c.submitting : c.submit}
      </button>

      {message && (
        <p className="mt-3 text-center text-xs" style={{ color: '#c0532f' }}>
          {message}
        </p>
      )}

      <p className="mt-6 text-center text-xs">
        <Link href="/privacy" className="underline underline-offset-4" style={{ color: 'var(--ink-soft)' }}>
          {c.privacy}
        </Link>
      </p>
    </form>
  )
}
