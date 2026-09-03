'use client'

import Link from 'next/link'
import { COPY } from '../lib/book-config'

// First-visit consent for reading analytics. Nothing is pre-ticked and both
// answers are equally easy — declining simply stops the event stream.
export default function ConsentNotice({ onAccept, onDecline }) {
  const c = COPY.consent
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[68] flex justify-center px-4 pb-4">
      <div className="panel pointer-events-auto flex w-full max-w-lg flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
        <p className="min-w-[12rem] flex-1 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {c.body}{' '}
          <Link href="/privacy" className="underline underline-offset-2" style={{ color: 'var(--ink)' }}>
            {c.more}
          </Link>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onDecline} className="rounded-full px-3 py-1.5 text-xs" style={{ color: 'var(--ink-soft)', border: '1px solid var(--rule)' }}>
            {c.decline}
          </button>
          <button
            onClick={onAccept}
            className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            {c.accept}
          </button>
        </div>
      </div>
    </div>
  )
}
