'use client'

import { useState } from 'react'

// First-visit, non-intrusive "Who are you? (optional)" modal. Both fields are
// optional — skipping still records the reader, just anonymously.
export default function WelcomeModal({ onSubmit, onSkip }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ name: name.trim(), email: email.trim() })
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      style={{ background: 'var(--overlay)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="panel w-full max-w-sm rounded-2xl p-6"
        style={{ color: 'var(--ink)' }}
      >
        <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>
          Welcome
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Who are you? <span className="opacity-70">(optional)</span> — so I know who&rsquo;s
          reading. You can skip this and just enjoy the book.
        </p>

        <div className="mt-4 space-y-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            autoComplete="email"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm"
            style={{ color: 'var(--ink-soft)' }}
          >
            Skip
          </button>
          <button
            type="submit"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Start reading
          </button>
        </div>
      </form>
    </div>
  )
}
