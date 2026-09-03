'use client'

import { useState } from 'react'
import Link from 'next/link'
import { COPY } from '../lib/book-config'
import { getSupabaseBrowser } from '../lib/supabase/client'

// Sits at the foot of the contents drawer: who you're signed in as, sign out,
// and the irreversible "Vergeet mij".
export default function AccountBox({ email }) {
  const c = COPY.account
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    try {
      await getSupabaseBrowser()?.auth.signOut()
    } catch {
      /* ignore */
    }
    window.location.href = '/'
  }

  const forget = async () => {
    setBusy(true)
    try {
      await fetch('/api/forget-me', { method: 'POST', credentials: 'same-origin' })
      try {
        localStorage.clear()
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
    window.location.href = '/'
  }

  return (
    <div className="mt-6 border-t px-3 pb-2 pt-4" style={{ borderColor: 'var(--rule)' }}>
      {email && (
        <p className="mb-2 truncate text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          {email}
        </p>
      )}

      {confirming ? (
        <div className="rounded-xl p-3" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink)' }}>
            {c.forgetConfirm}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={forget}
              disabled={busy}
              className="rounded-full px-3 py-1.5 text-xs text-white disabled:opacity-60"
              style={{ background: '#c0532f' }}
            >
              {c.forget}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs"
              style={{ color: 'var(--ink-soft)' }}
            >
              {c.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <button onClick={signOut} disabled={busy} style={{ color: 'var(--ink-soft)' }}>
            {c.signOut}
          </button>
          <Link href="/privacy" style={{ color: 'var(--ink-soft)' }}>
            Privacy
          </Link>
          <button onClick={() => setConfirming(true)} style={{ color: '#c0532f' }}>
            {c.forget}
          </button>
        </div>
      )}
    </div>
  )
}
