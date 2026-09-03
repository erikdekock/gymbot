'use client'

import { useState } from 'react'
import { COPY } from '../lib/book-config'

// A small card that slides in at the end of a chapter. Deliberately NOT a
// modal: it never traps the reader, and skipping is one tap. Shown at most
// once per chapter per reader (the caller tracks that).
export default function SurveyCard({ chapterNumber, questions, isEndOfBook, onSubmit, onSkip }) {
  const c = COPY.survey
  const [answers, setAnswers] = useState({})
  const [state, setState] = useState('idle')

  const set = (id, value) => setAnswers((a) => ({ ...a, [id]: value }))

  async function submit(e) {
    e.preventDefault()
    setState('sending')
    await onSubmit(answers)
    setState('done')
    setTimeout(onSkip, 1400)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-5">
      <form
        onSubmit={submit}
        className="panel pointer-events-auto w-full max-w-md rounded-2xl p-5"
        role="region"
        aria-label={isEndOfBook ? c.endOfBook : c.chapterDone(chapterNumber)}
      >
        {state === 'done' ? (
          <p className="py-2 text-center text-sm" style={{ color: 'var(--accent)' }}>
            {c.thanks}
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base" style={{ color: 'var(--ink)' }}>
                {isEndOfBook ? c.endOfBook : c.chapterDone(chapterNumber)}
              </h3>
              <button
                type="button"
                onClick={onSkip}
                className="shrink-0 text-xs"
                style={{ color: 'var(--ink-soft)' }}
              >
                {c.skip}
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {questions.map((q) => (
                <div key={q.id}>
                  <p className="mb-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {q.label}
                  </p>

                  {q.type === 'rating' && (
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => set(q.id, n)}
                          aria-label={`${n}/5`}
                          aria-pressed={answers[q.id] === n}
                          className="h-9 w-9 rounded-full text-sm transition-colors"
                          style={{
                            background: answers[q.id] >= n ? 'var(--accent)' : 'var(--paper)',
                            color: answers[q.id] >= n ? '#fff' : 'var(--ink-soft)',
                            border: '1px solid var(--rule)',
                          }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'choice' && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => set(q.id, o.value)}
                          aria-pressed={answers[q.id] === o.value}
                          className="rounded-full px-3 py-1.5 text-xs transition-colors"
                          style={{
                            background: answers[q.id] === o.value ? 'var(--accent)' : 'var(--paper)',
                            color: answers[q.id] === o.value ? '#fff' : 'var(--ink)',
                            border: '1px solid var(--rule)',
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'open' && (
                    <textarea
                      value={answers[q.id] || ''}
                      onChange={(e) => set(q.id, e.target.value)}
                      placeholder={c.openPlaceholder}
                      rows={2}
                      className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none"
                      style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={state === 'sending'}
              className="mt-4 w-full rounded-full py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {c.submit}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
