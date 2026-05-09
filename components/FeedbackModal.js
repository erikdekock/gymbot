'use client'
import { useState } from 'react'
import Toast from './Toast'

const TYPES = [
  { label: 'Bug', value: 'bug' },
  { label: 'Idea', value: 'feature_request' },
  { label: 'Question', value: 'question' },
  { label: 'Other', value: 'other' },
]

export default function FeedbackModal({ onClose }) {
  const [type, setType] = useState(null)
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showDiscard, setShowDiscard] = useState(false)

  const canSubmit = type && summary.trim().length > 0 && details.trim().length >= 10 && !submitting

  function handleBackdropTap() {
    if (summary.trim() || details.trim()) {
      setShowDiscard(true)
    } else {
      onClose()
    }
  }

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, summary: summary.trim(), details: details.trim() }),
      })
      if (res.ok) {
        setToast({ message: "Thanks — we've got it.", type: 'success' })
        setTimeout(onClose, 2000)
      } else {
        setToast({ message: "Couldn't send. Try again.", type: 'error' })
        setSubmitting(false)
      }
    } catch {
      setToast({ message: "Couldn't send. Try again.", type: 'error' })
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropTap}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: '#141414',
        borderRadius: '20px 20px 0 0',
        zIndex: 101,
        paddingBottom: 'env(safe-area-inset-bottom, 24px)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 16px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#fff', margin: 0 }}>Send feedback</h2>
          <button
            onClick={handleBackdropTap}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 15, cursor: 'pointer', padding: '4px 0' }}
          >
            Cancel
          </button>
        </div>

        <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Toast inside modal */}
          {toast && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: toast.type === 'error' ? '#2a1010' : '#0f1f0f',
              border: `1px solid ${toast.type === 'error' ? '#e24b4a' : '#1d9e75'}`,
              color: toast.type === 'error' ? '#e24b4a' : '#1d9e75',
              fontSize: 13,
            }}>
              {toast.message}
            </div>
          )}

          {/* Type pills */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#888', margin: '0 0 10px' }}>TYPE</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 20,
                    border: 'none',
                    background: type === t.value ? '#EF9F27' : '#1e1e1e',
                    color: type === t.value ? '#000' : '#888',
                    fontSize: 14,
                    fontWeight: type === t.value ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#888', margin: '0 0 8px' }}>SUMMARY</p>
            <input
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="One line — what is it?"
              maxLength={120}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '12px 14px',
                fontSize: 15, color: '#fff', outline: 'none',
              }}
            />
          </div>

          {/* Details */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#888', margin: '0 0 8px' }}>DETAILS</p>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Tell us more. What were you doing? What did you expect?"
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: 10, padding: '12px 14px',
                fontSize: 15, color: '#fff', outline: 'none',
                resize: 'none', lineHeight: 1.5, fontFamily: 'inherit',
              }}
            />
            {details.length > 0 && details.trim().length < 10 && (
              <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>
                A bit more detail helps us act on it.
              </p>
            )}
          </div>

          {/* Send */}
          <button
            disabled={!canSubmit}
            onClick={submit}
            style={{
              width: '100%', padding: '15px',
              borderRadius: 22, border: 'none',
              background: canSubmit ? '#fff' : '#1e1e1e',
              color: canSubmit ? '#000' : '#444',
              fontSize: 16, fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      {/* Discard confirmation */}
      {showDiscard && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 102,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: '#1c1c1c', borderRadius: 20,
            padding: 24, width: '100%', maxWidth: 300,
          }}>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>Discard feedback?</p>
            <p style={{ fontSize: 14, color: '#888', margin: '0 0 20px', lineHeight: 1.5 }}>
              Your draft will be lost.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => setShowDiscard(false)}
                style={{ width: '100%', padding: '13px', borderRadius: 22, border: 'none', background: '#fff', color: '#000', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >
                Keep editing
              </button>
              <button
                onClick={onClose}
                style={{ width: '100%', padding: '13px', borderRadius: 22, border: 'none', background: 'none', color: '#e24b4a', fontSize: 15, cursor: 'pointer' }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
