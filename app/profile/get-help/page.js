'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Toast from '../../../components/Toast'

const FAQS = [
  {
    q: 'What is GymBot?',
    a: 'GymBot is a personal training app that answers one question: am I on track toward my goal? You set a goal, we plan your week, you log your sessions, and we show you whether you\'re moving in the right direction. No social feed, no gimmicks, no thousand-feature dashboards.',
  },
  {
    q: 'How is my data used?',
    a: 'Your training data is yours. We use it to build your weekly plans, show your progress, and improve the app for you specifically. We don\'t sell it, share it with advertisers, or use it to train external AI. You can export everything as a CSV at any time, or delete your account and have it all removed.',
  },
  {
    q: 'Why do I need to log sessions manually?',
    a: 'Right now, sets, reps, and weights are entered by hand because that\'s the most accurate way to capture what you actually did. Photo and screenshot input (Apple Watch summaries, scale apps, Strava runs) is on the roadmap — once it ships, you can snap a photo instead of typing.',
  },
  {
    q: 'Can I change my goal mid-season?',
    a: 'Yes. Life changes — injury, schedule shifts, motivation pivots — and your plan should change with it. Open the goal card on the week screen and tap to adjust. The AI rebuilds your plan from there. Goal switching is in active development; if you hit friction, send feedback.',
  },
  {
    q: 'Why doesn\'t the app have [feature X]?',
    a: 'We\'re building this carefully. Some features are deliberately deferred until they earn their place — notifications, wearables, kg/lbs toggle, social features. Each one has a trigger that brings it back. If something you want is missing, the Send us your feedback link is the fastest way to get it on the radar.',
  },
]

export default function GetHelp() {
  const router = useRouter()
  const [expanded, setExpanded] = useState(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState(null)

  async function sendNote() {
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    window.location.href = `mailto:ahwdekock@gmail.com?subject=[GymBot help] ${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
    setSending(false)
    setToast({ message: "Thanks — we'll get back to you soon.", type: 'success' })
    setSubject('')
    setMessage('')
  }

  return (
    <div className="screen">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="topbar">
        <button className="topbar-back" onClick={() => router.back()}>← Back</button>
        <span className="topbar-title">Get help</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gb-text-primary)', margin: '0 0 4px' }}>
          How can we help?
        </h1>
        <p style={{ fontSize: 14, color: 'var(--gb-text-secondary)', margin: 0 }}>
          Common questions first. If you don't see what you need, send us a note.
        </p>
      </div>

      {/* FAQs */}
      <p className="section-label">QUESTIONS</p>
      <div className="grouped-card">
        {FAQS.map((faq, i) => (
          <div key={i}>
            <button
              className="list-row"
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span className="list-row-label">{faq.q}</span>
                <span style={{ color: 'var(--gb-text-quiet)', fontSize: 14, marginLeft: 8, flexShrink: 0 }}>
                  {expanded === i ? '−' : '+'}
                </span>
              </div>
              {expanded === i && (
                <p style={{ fontSize: 14, color: 'var(--gb-text-secondary)', margin: 0, lineHeight: 1.6, fontWeight: 400 }}>
                  {faq.a}
                </p>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Contact form */}
      <p className="section-label">STILL NEED HELP?</p>
      <div style={{ padding: '0 20px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--gb-text-primary)', margin: 0 }}>
          Send us a note
        </h2>
        <p style={{ fontSize: 14, color: 'var(--gb-text-secondary)', margin: 0, lineHeight: 1.5 }}>
          We read every message. Replies usually within 24 hours during alpha.
        </p>
        <input
          className="auth-input"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Subject"
        />
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tell us what's going on..."
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--gb-bg-input)', border: '1px solid var(--gb-border-input)',
            borderRadius: 'var(--gb-radius-lg)', padding: '14px 16px',
            fontSize: 16, color: 'var(--gb-text-primary)', outline: 'none',
            resize: 'none', lineHeight: 1.5, fontFamily: 'inherit',
          }}
        />
        <button
          className="auth-btn"
          disabled={!subject.trim() || !message.trim() || sending}
          onClick={sendNote}
        >
          {sending ? 'Opening mail…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
