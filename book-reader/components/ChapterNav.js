'use client'

import { useEffect } from 'react'

// Slide-in sidebar listing chapters. Tapping one jumps straight to it.
export default function ChapterNav({ open, chapters, currentIndex, onSelect, onClose }) {
  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ background: 'var(--overlay)' }}
        aria-hidden="true"
      />
      <aside
        className={`panel fixed left-0 top-0 z-[61] h-full w-[82%] max-w-xs overflow-y-auto rounded-r-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Chapters"
      >
        <div className="px-6 pb-2 pt-7">
          <p
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{ color: 'var(--ink-soft)' }}
          >
            Contents
          </p>
        </div>
        <nav className="px-3 pb-8">
          {chapters.map((ch, i) => {
            const active = i === currentIndex
            return (
              <button
                key={ch.number}
                onClick={() => onSelect(i)}
                className="block w-full rounded-xl px-3 py-3 text-left transition-colors"
                style={{
                  background: active ? 'var(--paper-edge)' : 'transparent',
                  color: 'var(--ink)',
                }}
              >
                <span
                  className="mr-2 text-xs tabular-nums"
                  style={{ color: 'var(--accent)' }}
                >
                  {String(ch.number).padStart(2, '0')}
                </span>
                <span
                  className="font-display text-[15px]"
                  style={{ color: active ? 'var(--ink)' : 'var(--ink)' }}
                >
                  {ch.title}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
