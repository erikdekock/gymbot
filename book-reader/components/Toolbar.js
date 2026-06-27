'use client'

import { useEffect, useRef, useState } from 'react'

const FONT_SIZES = [
  { key: 'sm', label: 'Small' },
  { key: 'md', label: 'Medium' },
  { key: 'lg', label: 'Large' },
]

const THEMES = [
  { key: 'light', label: 'Paper', swatch: '#f6f1e7' },
  { key: 'sepia', label: 'Sepia', swatch: '#ece0c8' },
  { key: 'dark', label: 'Night', swatch: '#1c1a17' },
]

// Top chrome: contents button, chapter title, and an "Aa" settings popover
// for font size + theme. `visible` lets the reader hide chrome on tap.
export default function Toolbar({
  visible,
  title,
  fontSize,
  onFontSize,
  theme,
  onTheme,
  onOpenNav,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [settingsOpen])

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0 pointer-events-none'
      }`}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between px-3 pt-3 sm:px-5">
        <button
          onClick={onOpenNav}
          aria-label="Chapters"
          className="panel flex h-10 w-10 items-center justify-center rounded-full"
          style={{ color: 'var(--ink)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="14" y2="17" />
          </svg>
        </button>

        <div
          className="mx-3 truncate text-center text-[13px] tracking-wide"
          style={{ color: 'var(--ink-soft)' }}
        >
          {title}
        </div>

        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Reading settings"
            className="panel flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: 'var(--ink)' }}
          >
            <span className="font-display text-[17px] leading-none">
              A<span className="text-[12px]">a</span>
            </span>
          </button>

          {settingsOpen && (
            <div
              className="panel absolute right-0 mt-2 w-60 rounded-2xl p-4"
              role="dialog"
              aria-label="Reading settings"
            >
              <p
                className="mb-2 text-[11px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--ink-soft)' }}
              >
                Text size
              </p>
              <div className="flex gap-2">
                {FONT_SIZES.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => onFontSize(f.key)}
                    className="flex-1 rounded-lg py-2 text-center transition-colors"
                    style={{
                      background: fontSize === f.key ? 'var(--accent)' : 'var(--paper)',
                      color: fontSize === f.key ? '#fff' : 'var(--ink)',
                      border: '1px solid var(--rule)',
                    }}
                  >
                    <span
                      className="font-display"
                      style={{ fontSize: f.key === 'sm' ? 13 : f.key === 'md' ? 16 : 20 }}
                    >
                      A
                    </span>
                  </button>
                ))}
              </div>

              <p
                className="mb-2 mt-4 text-[11px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--ink-soft)' }}
              >
                Theme
              </p>
              <div className="flex gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onTheme(t.key)}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-colors"
                    style={{
                      border:
                        theme === t.key
                          ? '1px solid var(--accent)'
                          : '1px solid var(--rule)',
                    }}
                  >
                    <span
                      className="h-6 w-6 rounded-full"
                      style={{ background: t.swatch, border: '1px solid var(--rule)' }}
                    />
                    <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
