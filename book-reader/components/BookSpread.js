'use client'

// ===========================================================================
//  The open book (desktop only, ≥1024px).
//
//  Everything in here is decoration wrapped around the *existing* pagination
//  engine — the real text is `children` (the .page-viewport), which sits above
//  the paper layers and stays fully selectable. Every decorative layer is
//  aria-hidden, pointer-events:none and unselectable, and the marginalia live
//  strictly inside the outer margin strips, so nothing can ever cover the text.
// ===========================================================================

import { paperFor, marginaliaFor, ORNAMENTS } from '../lib/book-paper'

export default function BookSpread({
  bookTitle,
  chapterTitle,
  chapterNumber,
  pageIndex,
  pageCount,
  folioBase,
  gutterRef,
  turnKey,
  turnDir,
  children,
}) {
  const hasRecto = pageIndex + 1 < pageCount
  const leftPaper = paperFor(chapterNumber, pageIndex)
  const rightPaper = paperFor(chapterNumber, pageIndex + 1)
  const leftNote = marginaliaFor(chapterNumber, pageIndex)
  const rightNote = hasRecto ? marginaliaFor(chapterNumber, pageIndex + 1) : null

  // A chapter's first page is always the left-hand page of a spread, and by
  // convention carries no running head.
  const leftIsOpening = pageIndex === 0
  const showStamp = chapterNumber === 1 && pageIndex === 0

  return (
    <div className="book-desk">
      <div className="book">
        <div className="book-boards" aria-hidden="true" />
        <div className="book-edge book-edge--left" aria-hidden="true" />
        <div className="book-edge book-edge--right" aria-hidden="true" />

        <div className="book-spread">
          <PaperPage side="verso" paper={leftPaper} showStamp={showStamp} />
          <PaperPage side="recto" paper={rightPaper} blank={!hasRecto} />

          <div className="book-gutter" ref={gutterRef} aria-hidden="true">
            <div className="book-gutter__fold" />
          </div>

          {/* Running heads, folios and rules live in the top margin */}
          <div className="book-heads" aria-hidden="true">
            <Head
              side="verso"
              folio={folioBase + pageIndex + 1}
              text={bookTitle}
              paper={leftPaper}
              suppressed={leftIsOpening}
            />
            {hasRecto && (
              <Head
                side="recto"
                folio={folioBase + pageIndex + 2}
                text={chapterTitle}
                paper={rightPaper}
              />
            )}
          </div>

          {/* The real, selectable text */}
          {children}

          {/* Pencil marks — outer margin strips only */}
          <div className="book-margins" aria-hidden="true">
            {leftNote && <MarginNote side="verso" note={leftNote} />}
            {rightNote && <MarginNote side="recto" note={rightNote} />}
          </div>

          <div className="book-sweep" key={turnKey} data-dir={turnDir} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

// --- one sheet of aged paper -------------------------------------------------

function PaperPage({ side, paper, showStamp, blank }) {
  return (
    <div
      className={`book-page book-page--${side}${blank ? ' book-page--blank' : ''}`}
      aria-hidden="true"
      style={{ '--tone': paper.tone, '--edge-phase': `${paper.edgePhase}px` }}
    >
      <div className="book-page__grain" />

      {/* Foxing + stains sit *under* the text layer and stay very faint. */}
      <svg className="book-page__marks" viewBox="0 0 100 140" preserveAspectRatio="none">
        {paper.stains.map((s, i) => (
          <g key={`s${i}`} transform={`rotate(${s.rot} ${s.x} ${s.y})`}>
            <ellipse cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill="#8a6532" opacity={s.o * 0.45} />
            <ellipse
              cx={s.x}
              cy={s.y}
              rx={s.rx}
              ry={s.ry}
              fill="none"
              stroke="#7d5828"
              strokeWidth="0.7"
              opacity={s.o}
            />
          </g>
        ))}
        {paper.foxing.map((f, i) => (
          <circle key={`f${i}`} cx={f.x} cy={f.y} r={f.r} fill="#6b4a22" opacity={f.o} />
        ))}
      </svg>

      <div className="book-page__vignette" />
      <div className="book-page__deckle" />
      {paper.dogEar && <div className="book-page__dogear" />}
      {showStamp && <LibraryStamp />}
    </div>
  )
}

// --- running head + folio ----------------------------------------------------

function Head({ side, folio, text, paper, suppressed }) {
  return (
    <div className={`book-head book-head--${side}`}>
      <div className="book-head__row">
        <span className="book-folio">{folio}</span>
        {!suppressed && <span className="book-runhead">{text}</span>}
      </div>
      {/* The rule is kept (but hidden) on a chapter opening so the folio still
          sits on the same line as the one on the facing page. */}
      <div className={`book-head__rule${suppressed ? ' is-hidden' : ''}`}>
        {!suppressed && paper.ornament && (
          <span
            className="book-head__ornament"
            style={{ transform: `rotate(${paper.ornamentRot}deg)` }}
          >
            {ORNAMENTS[paper.ornamentIndex] || ORNAMENTS[0]}
          </span>
        )}
      </div>
    </div>
  )
}

// --- a pencil mark in the margin ---------------------------------------------

function MarginNote({ side, note }) {
  const style = {
    top: `${note.top}%`,
    opacity: note.opacity,
    transform: `rotate(${note.rot}deg) scale(${note.scale})`,
  }

  if (note.kind === 'underline') {
    return (
      <span className={`book-mark book-mark--rule book-mark--${side}`} style={style}>
        <svg viewBox="0 0 60 10" preserveAspectRatio="none">
          <path d="M1,6 C14,3 26,8 40,4 C48,2 54,5 59,4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
    )
  }

  if (note.kind === 'bracket') {
    return (
      <span className={`book-mark book-mark--bracket book-mark--${side}`} style={style}>
        <svg viewBox="0 0 14 60" preserveAspectRatio="none">
          <path d="M11,2 C4,10 4,20 5,30 C4,40 4,50 11,58" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
    )
  }

  return (
    <span
      className={`book-mark book-mark--text book-mark--${side}${note.kind === 'mark' ? ' book-mark--big' : ''}`}
      style={style}
    >
      {note.text}
    </span>
  )
}

// --- the one easter egg: a faded library stamp, first page only --------------

function LibraryStamp() {
  return (
    <svg className="book-stamp" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id="book-stamp-arc" d="M 60,60 m -40,0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0" />
      </defs>
      <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" strokeWidth="0.9" />
      <text className="book-stamp__ring">
        <textPath href="#book-stamp-arc" startOffset="50%" textAnchor="middle">
          БИБЛИОТЕКА
        </textPath>
      </text>
      <text className="book-stamp__no" x="60" y="64" textAnchor="middle">
        № 4271
      </text>
    </svg>
  )
}
