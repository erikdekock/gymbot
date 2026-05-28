'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOnboarding } from '../_state/context'
import { getScripted1 } from '../../../lib/onboarding-copy'
import ScreenContainer from '../_components/ScreenContainer'
import Wordmark from '../_components/Wordmark'
import { BodyCopy, HelperCopy } from '../_components/Typography'
import PrimaryButton from '../_components/PrimaryButton'
import LoadingIndicator from '../_components/LoadingIndicator'
import ErrorMessage from '../_components/ErrorMessage'

/**
 * Screen 9 — Completion + first-week render. 12.3b ships the real engine
 * output here.
 *
 * Data source order:
 *   1. window.sessionStorage[STORAGE_KEY] — Screen 8 stashes the program
 *      after the POST so the user lands on Screen 9 with the week already
 *      computed (no second network hop on the happy path).
 *   2. GET /api/prelude/complete — refresh / direct-nav fallback. The user
 *      already persisted via Screen 8's POST, so this just reads the row
 *      back through the same RLS policy.
 *
 * Layout — Paper & Sage v1.1, existing onboarding components:
 *   Top:
 *     - REPRISE wordmark (primary, threshold crossing per spec §7 Screen 9)
 *     - Scripted #1 — 12.2 neutral stub copy (AI synthesis is post-alpha)
 *     - The week: for each session, day label · template name · focus, then
 *       a list of slot lines (slot role · exercise · scheme · RPE · load).
 *   Bottom:
 *     - "Open the Set" CTA.
 */

const STORAGE_KEY = '__onboarding_program__'

export default function CompletePage() {
  const router = useRouter()
  const { state } = useOnboarding()
  const [program, setProgram] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cached = null
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) cached = JSON.parse(raw)
    } catch {
      // Ignore — fall through to fetch.
    }
    if (cached) {
      setProgram(cached)
      return
    }
    let cancelled = false
    fetch('/api/prelude/complete', { method: 'GET' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && json.program) {
          setProgram(json.program)
        } else if (res.status === 404) {
          // No persisted program — user nav'd straight here without going
          // through Screen 8. Send them back to the start.
          router.replace('/onboarding/welcome')
        } else {
          setError(json.message || json.error || 'Could not load your week.')
        }
      })
      .catch(() => {
        if (!cancelled) setError('Network error.')
      })
    return () => { cancelled = true }
  }, [router])

  const scripted1 = getScripted1({
    userWordsGoal: state.user_words_goal,
    goalDisplayName: null,
    provisional: state.goal_provisional,
  })

  function openTheSet() {
    // Moment 2a week-view is not yet built. Route to app root; middleware
    // honours auth and lands the user on the existing home.
    router.push('/')
  }

  return (
    <ScreenContainer
      top={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--rep-space-6)' }}>
          <Wordmark size="primary" />
          <BodyCopy>{scripted1}</BodyCopy>

          {!program && !error ? (
            <div style={{ marginTop: 'var(--rep-space-4)' }}>
              <LoadingIndicator />
            </div>
          ) : null}

          {error ? <ErrorMessage message={error} /> : null}

          {program ? <FirstWeek program={program} /> : null}
        </div>
      }
      bottom={
        <PrimaryButton onClick={openTheSet} disabled={!program}>
          Open the Set
        </PrimaryButton>
      }
    />
  )
}

function FirstWeek({ program }) {
  const sessions = Array.isArray(program.sessions) ? program.sessions : []
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rep-space-5)',
        marginTop: 'var(--rep-space-2)',
      }}
    >
      {sessions.map((s, idx) => (
        <SessionCard key={idx} session={s} dayLabel={`Day ${idx + 1}`} />
      ))}
    </div>
  )
}

function SessionCard({ session, dayLabel }) {
  const exerciseRows = (session.phases || []).filter((p) => p.exercise_id || p.exercise_name)
  return (
    <section
      aria-label={`${dayLabel} — ${session.template_display_name || session.template_id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rep-space-2)',
        paddingBottom: 'var(--rep-space-4)',
        borderBottom: '1px solid var(--paper-80)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span
          style={{
            fontFamily: 'var(--rep-font-mono)',
            fontSize: '0.75rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--graphite-30)',
          }}
        >
          {dayLabel}
        </span>
        <span
          style={{
            fontFamily: 'var(--rep-font-sans)',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--graphite-10)',
          }}
        >
          {session.template_display_name || session.template_id}
        </span>
        {session.session_focus ? (
          <HelperCopy>{session.session_focus}</HelperCopy>
        ) : null}
      </header>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--rep-space-2)',
        }}
      >
        {exerciseRows.map((row, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--rep-font-sans)',
                fontSize: '0.9375rem',
                color: 'var(--graphite-10)',
              }}
            >
              {row.exercise_name || 'TBD'}
            </span>
            <span
              style={{
                fontFamily: 'var(--rep-font-mono)',
                fontSize: '0.75rem',
                letterSpacing: '0.08em',
                color: 'var(--graphite-30)',
              }}
            >
              {[
                row.set_rep_scheme,
                row.rpe_target != null ? `RPE ${row.rpe_target}` : null,
                row.load_placeholder,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
