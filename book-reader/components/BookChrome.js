'use client'

// Minimal desktop chrome for the open-book view: a bar that only surfaces when
// the pointer goes near the top of the window, plus two quiet arrows out in the
// margins beside the book. Deliberately sparse — the book is the interface.

const SIZES = [
  { key: 'sm', label: 'Small text', size: 12 },
  { key: 'md', label: 'Medium text', size: 15 },
  { key: 'lg', label: 'Large text', size: 19 },
]

// On desktop the aged-paper look *is* the day theme; "Night" becomes a
// lamp-lit version of the same book rather than a black screen.
const MODES = [
  { key: 'light', label: 'Daylight' },
  { key: 'dark', label: 'Lamplight' },
]

export default function BookChrome({
  onOpenNav,
  onShare,
  fontSize,
  onFontSize,
  theme,
  onTheme,
  onPrev,
  onNext,
  atStart,
  atEnd,
}) {
  return (
    <>
      <div className="book-chrome">
        <div className="book-chrome__bar">
          <button onClick={onOpenNav} className="book-chrome__btn" aria-label="Contents">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="14" y2="17" />
            </svg>
          </button>

          <span className="book-chrome__sep" />

          {SIZES.map((s) => (
            <button
              key={s.key}
              onClick={() => onFontSize(s.key)}
              aria-label={s.label}
              aria-pressed={fontSize === s.key}
              className={`book-chrome__btn book-chrome__btn--type${fontSize === s.key ? ' is-on' : ''}`}
            >
              <span style={{ fontSize: s.size, lineHeight: 1 }}>A</span>
            </button>
          ))}

          <span className="book-chrome__sep" />

          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => onTheme(m.key)}
              aria-label={m.label}
              aria-pressed={theme === m.key}
              className={`book-chrome__btn book-chrome__btn--mode${theme === m.key ? ' is-on' : ''}`}
            >
              {m.key === 'light' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5z" />
                </svg>
              )}
            </button>
          ))}

          <span className="book-chrome__sep" />

          <button onClick={onShare} className="book-chrome__btn" aria-label="Share the book">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="2.6" />
              <circle cx="6" cy="12" r="2.6" />
              <circle cx="18" cy="19" r="2.6" />
              <line x1="8.4" y1="13.4" x2="15.6" y2="17.6" />
              <line x1="15.6" y1="6.4" x2="8.4" y2="10.6" />
            </svg>
          </button>
        </div>
      </div>

      <button className="book-arrow book-arrow--prev" onClick={onPrev} disabled={atStart} aria-label="Previous page">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button className="book-arrow book-arrow--next" onClick={onNext} disabled={atEnd} aria-label="Next page">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </>
  )
}
