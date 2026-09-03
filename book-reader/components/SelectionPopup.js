'use client'

import { useEffect, useState } from 'react'
import { COPY } from '../lib/book-config'

// Appears just above a text selection inside the reading column. Highlight,
// note, like — and "Stel een vraag", which opens the composer below.
export default function SelectionPopup({ rect, onAction, onDismiss }) {
  if (!rect) return null

  const actions = [
    { key: 'highlight', label: COPY.selection.highlight, icon: '✏️' },
    { key: 'comment', label: COPY.selection.comment, icon: '💬' },
    { key: 'like', label: COPY.selection.like, icon: '❤️' },
    { key: 'ask', label: COPY.selection.ask, icon: '？', primary: true },
  ]

  // Keep the bubble on screen near the top of the selection.
  const top = Math.max(8, rect.top - 52)
  const left = Math.min(Math.max(12, rect.left + rect.width / 2), window.innerWidth - 12)

  return (
    <div
      className="fixed z-[65] -translate-x-1/2"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()} // don't clear the selection
    >
      <div className="panel flex items-center gap-1 rounded-full px-1.5 py-1 shadow-lg">
        {actions.map((a) => (
          <button
            key={a.key}
            onClick={() => onAction(a.key)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors hover:opacity-80"
            style={{
              color: a.primary ? '#fff' : 'var(--ink)',
              background: a.primary ? 'var(--accent)' : 'transparent',
            }}
          >
            <span aria-hidden="true">{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// --- the question composer --------------------------------------------------

export function QuestionComposer({ selectedText, onSubmit, onClose }) {
  const c = COPY.question
  const [text, setText] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setState('sending')
    const ok = await onSubmit(text.trim())
    setState(ok ? 'sent' : 'error')
    if (ok) setTimeout(onClose, 2200)
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
        className="panel w-full max-w-lg rounded-2xl p-6"
      >
        <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>
          {c.title}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {c.body}
        </p>

        {selectedText && (
          <blockquote
            className="mt-4 border-l-2 pl-3 text-sm italic"
            style={{ borderColor: 'var(--accent)', color: 'var(--ink-soft)' }}
          >
            {selectedText.length > 320 ? `${selectedText.slice(0, 320)}…` : selectedText}
          </blockquote>
        )}

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
            {state === 'error' && (
              <p className="mt-2 text-xs" style={{ color: '#c0532f' }}>
                {c.error}
              </p>
            )}
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
                {state === 'sending' ? c.submitting : c.submit}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
