'use client'

import { useState } from 'react'
import { COPY } from '../lib/book-config'

// Anytime feedback. Carries the reader's current location so a remark can be
// placed in the book even when no text was selected.
export default function FeedbackPanel({ onSubmit, onClose }) {
  const c = COPY.feedback
  const [text, setText] = useState('')
  const [state, setState] = useState('idle')

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setState('sending')
    await onSubmit(text.trim())
    setState('sent')
    setTimeout(onClose, 1600)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      style={{ background: 'var(--overlay)' }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="panel w-full max-w-md rounded-2xl p-6"
      >
        <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>
          {c.title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {c.body}
        </p>

        {state === 'sent' ? (
          <p className="mt-5 text-sm" style={{ color: 'var(--accent)' }}>
            {c.sent}
          </p>
        ) : (
          <>
            <textarea
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
              placeholder={c.placeholder}
              rows={4}
              className="mt-4 w-full resize-none rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            />
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={onClose} className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {c.cancel}
              </button>
              <button
                type="submit"
                disabled={!text.trim() || state === 'sending'}
                className="rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {c.submit}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
