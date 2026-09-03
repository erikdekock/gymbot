'use client'

import { useState } from 'react'
import { COPY } from '../lib/book-config'

// Shown once, after the first login. The email already comes from auth, so all
// this asks for is a name. Skipping is fine — the reader is still recorded.
export default function WelcomeModal({ onSubmit, onSkip }) {
  const c = COPY.welcome
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ firstName: firstName.trim(), lastName: lastName.trim() })
  }

  const field = {
    background: 'var(--paper)',
    border: '1px solid var(--rule)',
    color: 'var(--ink)',
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      style={{ background: 'var(--overlay)' }}
    >
      <form onSubmit={handleSubmit} className="panel w-full max-w-sm rounded-2xl p-6" style={{ color: 'var(--ink)' }}>
        <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>
          {c.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {c.body}
        </p>

        <div className="mt-4 space-y-2.5">
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={c.firstName}
            autoComplete="given-name"
            autoFocus
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={field}
          />
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={c.lastName}
            autoComplete="family-name"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={field}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={onSkip} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            {c.skip}
          </button>
          <button
            type="submit"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            {c.submit}
          </button>
        </div>
      </form>
    </div>
  )
}
