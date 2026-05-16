'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Big_Shoulders_Display, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { createClient } from '../lib/supabase/client'
import GoalCard from '../components/GoalCard'
import { activeGoal } from '../lib/season'
import { timePercent, readinessPercent } from '../lib/readiness'

// ─────────────────────────────────────────────────────────────────────────────
// Fonts for marketing landing (loaded via next/font for performance + no FOIT)
// ─────────────────────────────────────────────────────────────────────────────

const bigShoulders = Big_Shoulders_Display({
  subsets: ['latin'],
  weight: ['900'],
  display: 'swap',
  variable: '--font-display',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})

// ─────────────────────────────────────────────────────────────────────────────
// Shared Supabase client (used by both views)
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient()

// ─────────────────────────────────────────────────────────────────────────────
// Constants for AppHome (preserved exactly from original app/page.js)
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FOCUS_OPTIONS = ['Lower Posterior', 'Upper Push/Pull', 'Lower Anterior', 'Upper + Core', 'Full Body', 'Mobility', 'Run']
const FOCUS_EMOJI = {
  'Lower Posterior': '🦵', 'Upper Push/Pull': '💪', 'Lower Anterior': '🦿',
  'Upper + Core': '🏋️', 'Full Body': '⚡', 'Mobility': '🧘', 'Run': '🏃'
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page — conditional rendering on auth state
// Visitor → marketing landing
// Logged-in user → AppHome (existing app home, preserved)
// ─────────────────────────────────────────────────────────────────────────────

export default function Page() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'authed' | 'visitor'

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setAuthState(session ? 'authed' : 'visitor')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return
        setAuthState(session ? 'authed' : 'visitor')
      }
    )

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [])

  // Loading state: render empty dark viewport
  // Prevents landing-flash for logged-in users on initial page load
  if (authState === 'loading') {
    return (
      <div
        className={`${bigShoulders.variable} ${plexSans.variable} ${plexMono.variable}`}
        style={{ minHeight: '100vh', background: '#1A1814' }}
      />
    )
  }

  if (authState === 'authed') {
    return (
      <div className={`${bigShoulders.variable} ${plexSans.variable} ${plexMono.variable}`}>
        <AppHome />
      </div>
    )
  }

  return (
    <div className={`${bigShoulders.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <Landing />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// <AppHome /> — existing app home, preserved verbatim from original app/page.js
// Only change: was `export default function Home()`, now `function AppHome()`.
// All logic, styling, and behaviour identical to pre-landing version.
// ─────────────────────────────────────────────────────────────────────────────

function AppHome() {
  const router = useRouter()
  const [sessions, setSessions] = useState([])
  const [week, setWeek] = useState([])
  const [showPlanner, setShowPlanner] = useState(false)
  const [plannerDays, setPlannerDays] = useState({})
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    buildWeek()
    loadSessions()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  function buildWeek() {
    const today = new Date()
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      days.push({
        date: d.toISOString().split('T')[0],
        label: DAYS[d.getDay()],
        day: d.getDate(),
        isToday: i === 0
      })
    }
    setWeek(days)
  }

  async function loadSessions() {
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', nextWeek.toISOString().split('T')[0])
      .order('date')
    setSessions(data || [])
    setLoading(false)
  }

  function getSessionForDate(date) {
    return sessions.find(s => s.date === date)
  }

  async function planWeek() {
    const entries = Object.entries(plannerDays)
    for (const [date, focus] of entries) {
      if (!focus) continue
      const existing = getSessionForDate(date)
      if (!existing) {
        await supabase.from('sessions').insert({ date, type: 'Gym', focus })
      }
    }
    setShowPlanner(false)
    loadSessions()
  }

  async function openSession(date) {
    const existing = getSessionForDate(date)
    if (existing) {
      router.push(`/session/${existing.id}`)
    } else {
      const { data } = await supabase
        .from('sessions')
        .insert({ date, type: 'Gym', focus: 'Lower Posterior' })
        .select()
        .single()
      if (data) router.push(`/session/${data.id}`)
    }
  }

  const today = new Date()
  const daysRemaining = Math.ceil((activeGoal.raceDate - today) / (1000 * 60 * 60 * 24))
  const timePct = Math.round(timePercent(activeGoal.seasonStart, activeGoal.raceDate, today))
  const readinessPct = Math.round(readinessPercent(activeGoal))

  return (
    <div className="px-5 pt-14 pb-10">
      <div className="mb-8" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">GymBot</p>
          <h1 className="text-3xl font-bold text-white">This week</h1>
        </div>
        <button
          className="avatar-circle-sm"
          onClick={() => router.push("/profile")}
          aria-label="Go to profile"
          style={{ marginTop: 4 }}
        >
          {user?.email ? user.email[0].toUpperCase() : "?"}
        </button>
      </div>

      <GoalCard
        seasonType={activeGoal.seasonType}
        name={activeGoal.name}
        meta={activeGoal.meta}
        daysRemaining={daysRemaining}
        timePercent={timePct}
        readinessPercent={readinessPct}
      />

      <div className="space-y-3 mb-6">
        {loading ? (
          <div className="text-zinc-600 text-sm py-8 text-center">Loading...</div>
        ) : week.map(d => {
          const session = getSessionForDate(d.date)
          return (
            <button
              key={d.date}
              onClick={() => openSession(d.date)}
              className={`w-full rounded-2xl p-4 flex items-center justify-between transition-all active:scale-95 ${
                d.isToday
                  ? 'bg-white text-black'
                  : session
                  ? 'bg-zinc-900 border border-zinc-700 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-left w-10">
                  <p className={`text-xs font-medium ${d.isToday ? 'text-zinc-600' : 'text-zinc-500'}`}>{d.label}</p>
                  <p className={`text-xl font-bold ${d.isToday ? 'text-black' : 'text-white'}`}>{d.day}</p>
                </div>
                <div className="text-left">
                  {session ? (
                    <>
                      <p className="font-semibold text-sm">{FOCUS_EMOJI[session.focus] || '💪'} {session.focus}</p>
                      <p className={`text-xs ${d.isToday ? 'text-zinc-600' : 'text-zinc-500'}`}>Tap to open</p>
                    </>
                  ) : (
                    <p className="text-sm">Rest · tap to start</p>
                  )}
                </div>
              </div>
              {session && (
                <div className={`w-2 h-2 rounded-full ${d.isToday ? 'bg-black' : 'bg-zinc-400'}`} />
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => setShowPlanner(true)}
        className="w-full rounded-2xl border border-zinc-700 border-dashed p-4 text-zinc-500 text-sm font-medium active:scale-95 transition-all"
      >
        + Plan this week
      </button>

      {showPlanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-zinc-800">
            <h2 className="text-2xl font-bold">Plan this week</h2>
            <button onClick={() => setShowPlanner(false)} className="text-zinc-500 text-sm">Cancel</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {week.map(d => (
              <div key={d.date}>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">{d.label} {d.day} May</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPlannerDays(p => ({ ...p, [d.date]: null }))}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${!plannerDays[d.date] ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                  >
                    😴 Rest
                  </button>
                  {FOCUS_OPTIONS.map(f => (
                    <button
                      key={f}
                      onClick={() => setPlannerDays(p => ({ ...p, [d.date]: f }))}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${plannerDays[d.date] === f ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}
                    >
                      {FOCUS_EMOJI[f]} {f}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-8 pt-4 border-t border-zinc-800">
            <button
              onClick={planWeek}
              className="w-full bg-white text-black rounded-2xl py-4 font-bold text-base active:scale-95 transition-all"
            >
              Save week
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// <Landing /> — marketing homepage for visitors
// ─────────────────────────────────────────────────────────────────────────────

function Landing() {
  const router = useRouter()
  const startReprise = () => router.push('/welcome')

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        <Wordmark />
        <Hero onStart={startReprise} />

        <SectionMarker number="01" />
        <Why />

        <SectionMarker number="02" />
        <HowGoals />
        <HowAbsence />
        <HowResults />

        <SectionMarker number="03" />
        <WhatOpenGoal />
        <WhatTrainingScreen />
        <WhatSignals />
        <WhatGoalReached />

        <SectionMarker number="04" />
        <FinalCta onStart={startReprise} />

      </div>
    </main>
  )
}

function Wordmark() {
  return <div style={styles.wordmark}>REPRISE</div>
}

function Hero({ onStart }) {
  return (
    <section style={styles.hero}>
      <h1 style={styles.heroHeadline}>You don&apos;t have to be ready.</h1>
      <p style={styles.heroSubline}>
        AI strength coaching. Begin on a Tuesday. We&apos;ll figure it out from there.
      </p>
      <button onClick={onStart} style={styles.ctaButton} aria-label="Start Reprise">
        Start Reprise
      </button>
      <div style={styles.signinRow}>
        Already a member?{' '}
        <a href="/welcome" style={styles.signinLink}>Sign in</a>
      </div>
    </section>
  )
}

function SectionMarker({ number }) {
  return <div style={styles.sectionMarker}>{number}</div>
}

function Why() {
  return (
    <section style={styles.section}>
      <div style={styles.chainsGrid}>

        <div>
          <div style={styles.chainLabel}>MOST&nbsp;APPS</div>
          <ChainNode text="Discipline" dim />
          <ChainArrow dim />
          <ChainNode text="Consistency" dim />
          <ChainArrow dim />
          <ChainNode text="Results" dim />
          <ChainArrow dim />
          <ChainNode text="Satisfaction" dim faded />
          <div style={styles.chainFootnote}>if you stay long enough</div>
        </div>

        <div>
          <div style={styles.chainLabelAccent}>REPRISE</div>
          <ChainNode text="Satisfaction" />
          <ChainArrow />
          <ChainNode text="Consistency" />
          <ChainArrow />
          <ChainNode text="Results" />
        </div>

      </div>

      <div style={styles.whyHeading}>We think it&apos;s backwards.</div>

      <p style={styles.bodyParagraph}>
        If a session isn&apos;t one you&apos;d come back to on a Tuesday in November,
        you won&apos;t. The missed Tuesday becomes a missed January, becomes a year.
        So we work the other way. Every week is built to be one you&apos;d choose.
      </p>

      <p style={styles.bridgeStatement}>
        It starts with what you actually want to be able to do. Everything else
        gets built around that.
      </p>
    </section>
  )
}

function ChainNode({ text, dim, faded }) {
  const color = faded ? '#6B6862' : dim ? '#B5B0A8' : '#E8E5DD'
  return <div style={{ ...styles.chainNode, color }}>{text}</div>
}

function ChainArrow({ dim }) {
  return (
    <div style={{ ...styles.chainArrow, color: dim ? '#4A4641' : '#B5604A' }}>
      ↓
    </div>
  )
}

function HowGoals() {
  return (
    <section style={styles.section}>
      <h2 style={styles.howHeading}>
        &ldquo;I want to lift my kid without my back going.&rdquo;
      </h2>
      <p style={styles.bodyParagraph}>
        That sentence becomes your program. Every exercise this week traces back
        to it. So when you open today&apos;s session, the squat isn&apos;t just
        there. There&apos;s a reason it&apos;s there.
      </p>

      <div style={styles.proofFragment}>
        <div style={styles.proofRow}>
          <span style={styles.proofLabel}>Squat</span>
          <span style={styles.proofValue}>3 × 8 at 60 kg</span>
        </div>
        <div style={styles.proofAnnotation}>
          <div style={styles.proofAnnotationTitle}>Why this exercise?</div>
          <div>Builds the lower-body strength</div>
          <div>your kid-lifting goal needs.</div>
          <div>Week 2 of your rebuild block.</div>
        </div>
      </div>

      <p style={styles.compactLine}>
        We design satisfaction. Every set has a why.
      </p>
    </section>
  )
}

function HowAbsence() {
  return (
    <section style={styles.section}>
      <h2 style={styles.howHeading}>
        You missed last week. You open the app today.
      </h2>
      <p style={styles.bodyParagraph}>
        It doesn&apos;t ask where you&apos;ve been. It doesn&apos;t make you catch
        up. It shows you a session that fits the body you&apos;re in right now.
      </p>

      <div style={styles.proofFragment}>
        <div style={styles.weekRow}>
          <span style={styles.weekLabel}>Last week</span>
          <span style={styles.weekAbsence}>no sessions</span>
        </div>
        <div style={styles.weekRow}>
          <span style={styles.weekLabel}>This week</span>
          <span></span>
        </div>
        <div style={styles.weekRow}>
          <span style={styles.weekDayLabel}>&nbsp;&nbsp;Today</span>
          <span style={styles.weekDayValue}>Lower-body, lighter</span>
        </div>
        <div style={styles.weekRow}>
          <span style={styles.weekDayLabel}>&nbsp;&nbsp;Thursday</span>
          <span style={styles.weekDayValue}>Upper-body</span>
        </div>
        <div style={styles.weekRow}>
          <span style={styles.weekDayLabel}>&nbsp;&nbsp;Saturday</span>
          <span style={styles.weekDayValue}>Full body</span>
        </div>
      </div>

      <p style={styles.compactLine}>
        We don&apos;t enforce consistency. Absence is acknowledged, not punished.
      </p>
    </section>
  )
}

function HowResults() {
  return (
    <section style={styles.section}>
      <h2 style={styles.howHeading}>
        The day you lift what you came back for.
      </h2>
      <p style={styles.bodyParagraph}>
        That&apos;s the day we name it. Not the 12-week mark. Not a streak. The
        specific thing you said you wanted.
      </p>

      <div style={styles.proofFragmentSerif}>
        <div style={styles.timelineLabel}>YOU SAID, WEEK 1</div>
        <div style={styles.timelineQuote}>
          &ldquo;I want to lift my kid without my back going.&rdquo;
        </div>
        <div style={styles.timelineLabel}>TODAY, WEEK 14</div>
        <div style={styles.timelineFact}>Deadlift 100 kg, two clean reps.</div>
      </div>

      <p style={styles.compactLine}>
        We define results honestly. We celebrate progress toward a goal, not
        attendance.
      </p>
    </section>
  )
}

function WhatOpenGoal() {
  return (
    <section style={styles.sectionTight}>
      <h2 style={styles.whatHeading}>You don&apos;t know yet what you want.</h2>
      <p style={styles.bodyParagraph}>
        That&apos;s fine. Pick &ldquo;I don&apos;t know yet.&rdquo; Train for a few
        sessions. The question comes back when you have something to react to.
      </p>

      <div style={styles.proofFragment}>
        <div style={styles.proofQuestion}>What are you working toward?</div>
        <div style={styles.choiceRow}>○&nbsp;&nbsp;Deadlift 140 kg again</div>
        <div style={styles.choiceRow}>○&nbsp;&nbsp;Run a 10k under 50 min</div>
        <div style={styles.choiceRow}>○&nbsp;&nbsp;Add muscle, lose fat</div>
        <div style={styles.choiceRowSelected}>●&nbsp;&nbsp;I don&apos;t know yet</div>
      </div>
    </section>
  )
}

function WhatTrainingScreen() {
  return (
    <section style={styles.sectionTight}>
      <h2 style={styles.whatHeading}>Mid-set. Phone in your back pocket.</h2>
      <p style={styles.bodyParagraph}>
        When you pull it out, you see the next exercise. Reps, weight, effort.
        Nothing else. No chat, no notifications, no coaching prompts. We talk
        before and after. Not during.
      </p>

      <div style={styles.proofFragment}>
        <div style={styles.proofRow}>
          <span style={styles.proofLabel}>Squat</span>
          <span style={styles.proofValue}>3 × 8 at 60 kg</span>
        </div>
        <div style={styles.proofRow}>
          <span style={styles.proofLabel}>Romanian Deadlift</span>
          <span style={styles.proofValue}>3 × 10 at 50 kg</span>
        </div>
        <div style={styles.proofRow}>
          <span style={styles.proofLabel}>Hip Thrust</span>
          <span style={styles.proofValue}>3 × 12 at 70 kg</span>
        </div>
        <div style={styles.proofDivider} />
        <div style={styles.proofRow}>
          <span style={styles.proofLabel}>Effort</span>
          <span style={styles.proofValue}>7 of 10</span>
        </div>
      </div>
    </section>
  )
}

function WhatSignals() {
  return (
    <section style={styles.sectionTight}>
      <h2 style={styles.whatHeading}>Tuesday felt harder than it should.</h2>
      <p style={styles.bodyParagraph}>
        Wednesday you&apos;re still sore. We notice both. Thursday&apos;s session
        is lighter. Not because you said you didn&apos;t feel like it. Because
        your body said something specific.
      </p>

      <div style={styles.proofFragment}>
        <div style={styles.proofRow}>
          <span style={styles.signalLabel}>Tuesday session</span>
          <span style={styles.proofValue}>felt hard, 8.5 of 10</span>
        </div>
        <div style={styles.proofRow}>
          <span style={styles.signalLabel}>Wednesday recovery</span>
          <span style={styles.proofValue}>lower than usual</span>
        </div>
        <div style={styles.proofDivider} />
        <div style={styles.proofRow}>
          <span style={{ ...styles.signalLabel, width: '110px' }}>Thursday:</span>
          <span style={styles.adjustmentValue}>lighter session, same focus</span>
        </div>
      </div>
    </section>
  )
}

function WhatGoalReached() {
  return (
    <section style={styles.sectionWide}>
      <h2 style={styles.whatHeading}>You hit what you came back for.</h2>
      <p style={styles.bodyParagraph}>
        We don&apos;t ask what&apos;s next. We don&apos;t suggest the next tier.
        There&apos;s space. When you want to set a new goal, you set one.
      </p>

      <div style={styles.proofFragmentSerif}>
        <div style={styles.goalReachedTitle}>Goal reached.</div>
        <div style={styles.goalReachedSub}>
          Take a few days. When you&apos;re ready, there&apos;s a question.
        </div>
      </div>
    </section>
  )
}

function FinalCta({ onStart }) {
  return (
    <section style={styles.finalCta}>
      <div style={styles.accentLine} />
      <div style={styles.finalCtaHeadline}>
        You bring the body and the goal.
      </div>
      <div style={styles.finalCtaSubline}>
        We bring the week, the reasoning, and the patience.
      </div>
      <button onClick={onStart} style={styles.ctaButton} aria-label="Start Reprise">
        Start Reprise
      </button>
      <div style={styles.signinRow}>
        Already a member?{' '}
        <a href="/welcome" style={styles.signinLink}>Sign in</a>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing styles (inline objects, all tokens from Reprise Design System v1.0)
// Surfaces:   100=#1A1814  90=#25211B  70=#302C25  50=#3C3830  30=#959089  10=#E8E5DD
// Accent:     burnt sienna #B5604A
// Body muted: #B5B0A8
// Faded:      #6B6862 / #4A4641
// ─────────────────────────────────────────────────────────────────────────────

const FONT_SANS = 'var(--font-sans), system-ui, sans-serif'
const FONT_DISPLAY = 'var(--font-display), "Arial Narrow", sans-serif'
const FONT_MONO = 'var(--font-mono), ui-monospace, monospace'

const styles = {
  page: {
    background: '#1A1814',
    minHeight: '100vh',
    color: '#E8E5DD',
    fontFamily: FONT_SANS,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '2.25rem 1.625rem 2.25rem',
  },
  wordmark: {
    fontFamily: FONT_DISPLAY,
    fontWeight: 900,
    fontSize: '1.375rem',
    color: '#E8E5DD',
    letterSpacing: '0.08em',
    lineHeight: 1,
  },
  hero: {
    paddingTop: '8.125rem',
    paddingBottom: '7.5rem',
  },
  heroHeadline: {
    fontFamily: FONT_DISPLAY,
    fontWeight: 900,
    fontSize: '2.875rem',
    lineHeight: 1.02,
    color: '#E8E5DD',
    margin: '0 0 1.5rem',
    letterSpacing: '0.005em',
  },
  heroSubline: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: '0.906rem',
    lineHeight: 1.55,
    color: '#959089',
    margin: '0 0 2.25rem',
    letterSpacing: '0.005em',
  },
  ctaButton: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: '0.9375rem',
    color: '#E8E5DD',
    background: 'transparent',
    border: '1.5px solid #B5604A',
    padding: '1rem 1.25rem',
    width: '100%',
    borderRadius: 0,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    marginBottom: '1.125rem',
    minHeight: '44px',
    transition: 'background-color 120ms ease',
  },
  signinRow: {
    textAlign: 'center',
    fontFamily: FONT_SANS,
    fontSize: '0.8125rem',
    color: '#959089',
    letterSpacing: '0.005em',
  },
  signinLink: {
    color: '#E8E5DD',
    textDecoration: 'underline',
    textDecorationThickness: '0.5px',
    textUnderlineOffset: '3px',
  },
  sectionMarker: {
    fontFamily: FONT_MONO,
    fontWeight: 400,
    fontSize: '0.6875rem',
    color: '#959089',
    letterSpacing: '0.18em',
    marginBottom: '2.25rem',
  },
  section: {
    marginBottom: '5.5rem',
  },
  sectionTight: {
    marginBottom: '4rem',
  },
  sectionWide: {
    marginBottom: '6rem',
  },
  chainsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.125rem',
    marginBottom: '2.5rem',
  },
  chainLabel: {
    fontFamily: FONT_MONO,
    fontSize: '0.656rem',
    color: '#6B6862',
    letterSpacing: '0.12em',
    marginBottom: '1.125rem',
    lineHeight: 1.4,
  },
  chainLabelAccent: {
    fontFamily: FONT_MONO,
    fontSize: '0.656rem',
    color: '#B5604A',
    letterSpacing: '0.12em',
    marginBottom: '1.125rem',
    lineHeight: 1.4,
  },
  chainNode: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: '1rem',
    lineHeight: 1.3,
    marginBottom: '0.5rem',
  },
  chainArrow: {
    fontSize: '0.75rem',
    marginBottom: '0.5rem',
    lineHeight: 1,
  },
  chainFootnote: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: '0.719rem',
    color: '#4A4641',
    lineHeight: 1.3,
    marginTop: '-0.25rem',
  },
  whyHeading: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: '1.375rem',
    lineHeight: 1.3,
    color: '#E8E5DD',
    margin: '0 0 1.75rem',
    letterSpacing: '0.002em',
  },
  bodyParagraph: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: '0.906rem',
    lineHeight: 1.65,
    color: '#B5B0A8',
    margin: '0 0 1.75rem',
    letterSpacing: '0.005em',
  },
  bridgeStatement: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: '1rem',
    lineHeight: 1.55,
    color: '#E8E5DD',
    margin: 0,
    letterSpacing: '0.005em',
  },
  howHeading: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: '1.5rem',
    lineHeight: 1.25,
    color: '#E8E5DD',
    margin: '0 0 1.125rem',
    letterSpacing: '0.002em',
  },
  whatHeading: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: '1.375rem',
    lineHeight: 1.25,
    color: '#E8E5DD',
    margin: '0 0 1.125rem',
    letterSpacing: '0.002em',
  },
  proofFragment: {
    padding: '1.125rem 1rem',
    margin: '0 0 1.5rem',
    background: '#25211B',
    borderLeft: '1.5px solid #B5604A',
    fontFamily: FONT_MONO,
    fontSize: '0.781rem',
    lineHeight: 1.95,
    color: '#E8E5DD',
    letterSpacing: '0.02em',
  },
  proofFragmentSerif: {
    padding: '1.125rem 1rem',
    margin: '0 0 1.5rem',
    background: '#25211B',
    borderLeft: '1.5px solid #B5604A',
    fontFamily: FONT_SANS,
    fontSize: '0.875rem',
    lineHeight: 1.75,
    color: '#E8E5DD',
    letterSpacing: '0.005em',
  },
  proofRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  proofLabel: {
    color: '#B5B0A8',
  },
  proofValue: {
    color: '#E8E5DD',
  },
  proofDivider: {
    borderTop: '1px solid #3C3830',
    margin: '0.75rem 0',
  },
  proofAnnotation: {
    color: '#959089',
    marginTop: '0.5rem',
  },
  proofAnnotationTitle: {
    marginBottom: '0.25rem',
    color: '#B5B0A8',
  },
  proofQuestion: {
    color: '#959089',
    marginBottom: '0.75rem',
  },
  choiceRow: {
    lineHeight: 1.95,
  },
  choiceRowSelected: {
    color: '#B5604A',
    lineHeight: 1.95,
  },
  weekRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.25rem 0',
  },
  weekLabel: {
    color: '#959089',
    width: '5.625rem',
  },
  weekAbsence: {
    color: '#4A4641',
    fontStyle: 'italic',
    fontSize: '0.719rem',
  },
  weekDayLabel: {
    color: '#B5B0A8',
    width: '5.625rem',
  },
  weekDayValue: {
    color: '#E8E5DD',
  },
  signalLabel: {
    color: '#959089',
  },
  adjustmentValue: {
    color: '#B5604A',
  },
  timelineLabel: {
    fontFamily: FONT_MONO,
    fontSize: '0.6875rem',
    color: '#959089',
    letterSpacing: '0.1em',
    marginBottom: '0.625rem',
  },
  timelineQuote: {
    marginBottom: '1rem',
  },
  timelineFact: {
    color: '#E8E5DD',
  },
  goalReachedTitle: {
    marginBottom: '0.5rem',
  },
  goalReachedSub: {
    color: '#959089',
    fontSize: '0.844rem',
  },
  compactLine: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontStyle: 'italic',
    fontSize: '0.844rem',
    lineHeight: 1.6,
    color: '#6B6862',
    margin: 0,
    letterSpacing: '0.005em',
  },
  finalCta: {
    marginBottom: '2.25rem',
  },
  accentLine: {
    height: '1.5px',
    width: '3.5rem',
    background: '#B5604A',
    marginBottom: '2rem',
  },
  finalCtaHeadline: {
    fontFamily: FONT_SANS,
    fontWeight: 500,
    fontSize: '1.375rem',
    lineHeight: 1.35,
    color: '#E8E5DD',
    marginBottom: '0.75rem',
    letterSpacing: '0.002em',
  },
  finalCtaSubline: {
    fontFamily: FONT_SANS,
    fontWeight: 400,
    fontSize: '0.906rem',
    lineHeight: 1.6,
    color: '#959089',
    marginBottom: '2rem',
    letterSpacing: '0.005em',
  },
}
