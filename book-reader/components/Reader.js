'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ProgressBar from './ProgressBar'
import Toolbar from './Toolbar'
import ChapterNav from './ChapterNav'
import WelcomeModal from './WelcomeModal'
import BookSpread from './BookSpread'
import BookChrome from './BookChrome'
import {
  resolveReaderId,
  isRegistered,
  markRegistered,
  loadPosition,
  savePosition,
  getReferral,
} from '../lib/reader-id'
import {
  registerReader,
  trackChapter,
  updateProgress,
  setReferrer,
  subscribeHetZal,
  recordShare,
} from '../lib/analytics'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

export default function Reader({ chapters, bookTitle, lang = 'en' }) {
  const [ready, setReady] = useState(false)
  const [readerId, setReaderId] = useState(null)

  // Desktop (≥1024px) gets the open-book spread. Everything below that stays
  // exactly as it was — single page, existing chrome.
  const [bookMode, setBookMode] = useState(false)
  const [turnDir, setTurnDir] = useState('next')
  const gutterRef = useRef(null)

  const [chapterIndex, setChapterIndex] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [pageWidth, setPageWidth] = useState(0)
  const [percent, setPercent] = useState(0)

  const [fontSize, setFontSize] = useState('md')
  const [theme, setTheme] = useState('light')

  const [chromeVisible, setChromeVisible] = useState(true)
  const [navOpen, setNavOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showContinue, setShowContinue] = useState(false)
  const [hasProgress, setHasProgress] = useState(false)

  const viewportRef = useRef(null)
  const columnsRef = useRef(null)

  // Pagination intentions resolved after the next measure.
  const restorePageRef = useRef(null)
  const goLastRef = useRef(false)

  // Analytics accumulators.
  const timeRef = useRef(0)
  const pagesViewedRef = useRef(0)
  const maxScrollPctRef = useRef(0)
  const chapterNumRef = useRef(null)
  const chapterTitleRef = useRef('')
  const progressTimer = useRef(null)
  const continueShownRef = useRef(false)

  const chapter = chapters[chapterIndex]
  const modalsOpen = showWelcome || navOpen

  // ---- init: identity, restored position, welcome ----------------------------
  useEffect(() => {
    const id = resolveReaderId()
    setReaderId(id)

    const pos = loadPosition(id)
    if (pos) {
      if (pos.fontSize) setFontSize(pos.fontSize)
      if (pos.theme) setTheme(pos.theme)
      if (typeof pos.chapterIndex === 'number') {
        const ci = clamp(pos.chapterIndex, 0, chapters.length - 1)
        setChapterIndex(ci)
        restorePageRef.current = pos.pageIndex || 0
        if (ci > 0 || (pos.pageIndex || 0) > 0) setHasProgress(true)
      }
    }

    if (!isRegistered(id)) {
      setShowWelcome(true)
    } else {
      registerReader(id)
    }

    // If they arrived via someone's share link, record the referral once.
    const ref = getReferral()
    if (ref) setReferrer(id, ref)

    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply theme to <html> so CSS variables cascade everywhere.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Desktop = the open book. Watched live so a resize across the breakpoint
  // re-paginates instead of leaving a half-built spread.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setBookMode(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Everything book-shaped in CSS hangs off this attribute *and* a ≥1024px
  // media query, so the phone layout can never pick it up.
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-reader-mode', bookMode ? 'book' : 'plain')
    return () => el.removeAttribute('data-reader-mode')
  }, [bookMode])

  // "Continue reading" prompt once the welcome step is out of the way.
  useEffect(() => {
    if (!ready || showWelcome || !hasProgress || continueShownRef.current) return
    continueShownRef.current = true
    setShowContinue(true)
    const t = setTimeout(() => setShowContinue(false), 6000)
    return () => clearTimeout(t)
  }, [ready, showWelcome, hasProgress])

  // ---- pagination measurement ------------------------------------------------
  const relayout = useCallback(() => {
    const vp = viewportRef.current
    const col = columnsRef.current
    if (!vp || !col) return

    // Use the viewport's *fractional* width as the page pitch. clientWidth is
    // rounded to an integer, but a single CSS column stretches to fill the real
    // (sub-pixel) width — translating by the rounded value drifts a fraction of
    // a pixel per page, which accumulates and clips text at the right edge.
    const w = vp.getBoundingClientRect().width
    if (w <= 0) return

    // In book mode the viewport spans a whole spread, and the gutter becomes
    // the CSS column gap — so one column is exactly one page, two columns are
    // visible at once, and a turn advances by two columns. The gutter's real
    // width is measured off the DOM so JS and CSS can never disagree.
    const gap = bookMode && gutterRef.current ? gutterRef.current.getBoundingClientRect().width : 0
    const pageW = bookMode ? (w - gap) / 2 : w
    if (pageW <= 0) return
    const pitch = pageW + gap

    // A hair under the pitch guarantees exactly one column per page slot, then
    // it stretches to fill — so the column pitch equals `pitch` exactly.
    col.style.columnWidth = `${Math.floor(pageW)}px`
    col.style.columnGap = `${gap}px`

    // Reading scrollWidth forces the layout we just requested. It spans n
    // columns and n-1 gaps. Round up (with a small epsilon for sub-pixel
    // rounding) so the final partial page is never dropped.
    const total = Math.max(1, Math.ceil((col.scrollWidth + gap) / pitch - 0.02))
    setPageWidth(pitch)
    setPageCount(total)

    // Spreads always start on an even page, so the left-hand page is the recto
    // of the previous turn — snap any restored/clamped index down to one.
    const snap = (p) => (bookMode ? Math.floor(p / 2) * 2 : p)

    setPageIndex((prev) => {
      if (restorePageRef.current != null) {
        const p = clamp(restorePageRef.current, 0, total - 1)
        restorePageRef.current = null
        return snap(p)
      }
      if (goLastRef.current) {
        goLastRef.current = false
        return snap(total - 1)
      }
      return snap(clamp(prev, 0, total - 1))
    })
  }, [bookMode])

  // Re-measure when the chapter, font size or reading mode changes.
  useLayoutEffect(() => {
    relayout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIndex, fontSize, bookMode])

  // Re-measure on resize and once web fonts have settled.
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(relayout)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => relayout())
    }
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      cancelAnimationFrame(raf)
    }
  }, [relayout])

  // ---- analytics: chapter view ----------------------------------------------
  useEffect(() => {
    if (!ready || !readerId) return
    chapterNumRef.current = chapter.number
    chapterTitleRef.current = chapter.title
    maxScrollPctRef.current = 0
    trackChapter(readerId, {
      chapter: chapter.number,
      title: chapter.title,
      seconds: 0,
      scrollPct: 0,
      pages: 0,
      isView: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, readerId, chapterIndex])

  // ---- analytics: position change -> progress, scroll, save ------------------
  useEffect(() => {
    if (!ready || !readerId) return

    // A spread shows two pages, so progress is measured from the right-hand
    // one — the furthest page the reader can actually see.
    const visible = bookMode ? Math.min(pageIndex + 1, pageCount - 1) : pageIndex

    const pct = clamp(
      ((chapterIndex + (visible + 1) / pageCount) / chapters.length) * 100,
      0,
      100
    )
    setPercent(pct)
    pagesViewedRef.current += 1
    maxScrollPctRef.current = Math.max(
      maxScrollPctRef.current,
      ((visible + 1) / pageCount) * 100
    )

    const finished = chapterIndex === chapters.length - 1 && visible === pageCount - 1

    savePosition(readerId, { chapterIndex, pageIndex, fontSize, theme })

    clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => {
      updateProgress(readerId, {
        pct,
        chapter: chapter.number,
        page: pageIndex,
        finished,
      })
    }, 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, readerId, chapterIndex, pageIndex, pageCount, bookMode])

  // ---- analytics: time tracking + flushing -----------------------------------
  const flushChapter = useCallback(() => {
    if (!readerId || chapterNumRef.current == null) return
    const seconds = timeRef.current
    const pages = pagesViewedRef.current
    timeRef.current = 0
    pagesViewedRef.current = 0
    if (seconds <= 0 && pages <= 0) return
    trackChapter(readerId, {
      chapter: chapterNumRef.current,
      title: chapterTitleRef.current,
      seconds,
      scrollPct: maxScrollPctRef.current,
      pages,
      isView: false,
    })
  }, [readerId])

  useEffect(() => {
    if (!ready || !readerId) return

    const tick = setInterval(() => {
      if (document.visibilityState === 'visible' && !modalsOpen) {
        timeRef.current += 1
      }
    }, 1000)
    const flushInterval = setInterval(flushChapter, 15000)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushChapter()
    }
    const onHide = () => flushChapter()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onHide)

    return () => {
      clearInterval(tick)
      clearInterval(flushInterval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onHide)
      flushChapter()
    }
  }, [ready, readerId, modalsOpen, flushChapter])

  // ---- navigation ------------------------------------------------------------
  const goToChapter = useCallback(
    (index, where = 'first') => {
      if (index < 0 || index >= chapters.length) return
      flushChapter()
      if (where === 'last') goLastRef.current = true
      setNavOpen(false)
      setShowContinue(false)
      setChapterIndex(index)
      setPageIndex(0)
    },
    [chapters.length, flushChapter]
  )

  const nextPage = useCallback(() => {
    setShowContinue(false)
    setTurnDir('next')
    const step = bookMode ? 2 : 1
    const visible = bookMode ? Math.min(pageIndex + 1, pageCount - 1) : pageIndex
    if (visible < pageCount - 1) setPageIndex((p) => Math.min(p + step, pageCount - 1))
    else if (chapterIndex < chapters.length - 1) goToChapter(chapterIndex + 1, 'first')
  }, [pageIndex, pageCount, chapterIndex, chapters.length, goToChapter, bookMode])

  const prevPage = useCallback(() => {
    setShowContinue(false)
    setTurnDir('prev')
    const step = bookMode ? 2 : 1
    if (pageIndex > 0) setPageIndex((p) => Math.max(0, p - step))
    else if (chapterIndex > 0) goToChapter(chapterIndex - 1, 'last')
  }, [pageIndex, chapterIndex, goToChapter, bookMode])

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e) => {
      if (modalsOpen) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        nextPage()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        prevPage()
      } else if (e.key === ' ') {
        e.preventDefault()
        e.shiftKey ? prevPage() : nextPage()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextPage, prevPage, modalsOpen])

  // Pointer (mouse + touch) tap zones and swipe.
  const pointerStart = useRef(null)
  const onPointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e) => {
    const s = pointerStart.current
    pointerStart.current = null
    if (!s || modalsOpen) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? nextPage() : prevPage()
      return
    }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const w = window.innerWidth
      if (e.clientX < w * 0.32) prevPage()
      else if (e.clientX > w * 0.68) nextPage()
      else setChromeVisible((v) => !v)
    }
  }

  // ---- welcome handlers ------------------------------------------------------
  const handleWelcome = ({ name, email, subscribe }) => {
    if (readerId) {
      registerReader(readerId, name, email)
      markRegistered(readerId)
      if (subscribe && email) subscribeHetZal(readerId, { email, name, book: bookTitle })
    }
    setShowWelcome(false)
  }
  const handleSkip = () => {
    if (readerId) {
      registerReader(readerId)
      markRegistered(readerId)
    }
    setShowWelcome(false)
  }

  // ---- share -----------------------------------------------------------------
  const [shareToast, setShareToast] = useState(false)
  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return
    // Share link carries ?ref=<readerId> so referrals can be attributed.
    const url = `${window.location.origin}/read?ref=${readerId || ''}`
    const shareData = { title: bookTitle, text: `I'm reading ${bookTitle} — have a look:`, url }
    let channel = 'copy'
    try {
      if (navigator.share) {
        channel = 'native'
        await navigator.share(shareData)
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2200)
    } catch {
      /* user cancelled the share sheet — ignore */
      return
    }
    if (readerId) recordShare(readerId, channel)
  }, [readerId, bookTitle])

  const lastVisiblePage = bookMode ? Math.min(pageIndex + 1, pageCount - 1) : pageIndex
  const atVeryEnd =
    chapterIndex === chapters.length - 1 && lastVisiblePage >= pageCount - 1
  const atVeryStart = chapterIndex === 0 && pageIndex === 0

  // Folios run continuously across the whole book, not per chapter. The exact
  // page count of earlier chapters isn't known (only the current one is
  // measured), so we scale by text length: chars-per-page here, applied to the
  // characters that came before. Deterministic for a given window + text size.
  const chapterChars = useMemo(
    () => chapters.map((c) => (c.html || '').replace(/<[^>]+>/g, '').length),
    [chapters]
  )
  const charsBefore = useMemo(() => {
    const out = []
    let sum = 0
    for (const n of chapterChars) {
      out.push(sum)
      sum += n
    }
    return out
  }, [chapterChars])
  const folioBase = useMemo(() => {
    if (!bookMode || !pageCount) return 0
    const perPage = (chapterChars[chapterIndex] || 1) / pageCount
    if (!perPage) return 0
    return Math.max(0, Math.round((charsBefore[chapterIndex] || 0) / perPage))
  }, [bookMode, pageCount, chapterIndex, chapterChars, charsBefore])

  // The text itself — identical in both modes; only its container changes.
  const sheet = (
    <div ref={viewportRef} className="page-viewport min-h-0 flex-1">
      <div
        className="page-track h-full"
        style={{
          transform: `translateX(${
            -(bookMode ? Math.floor(pageIndex / 2) * 2 : pageIndex) * pageWidth
          }px)`,
        }}
      >
        <div
          ref={columnsRef}
          lang={lang}
          className="page-columns prose-book no-scrollbar"
          style={bookMode ? { '--chapter-label': `"Chapter ${chapter?.number ?? ''}"` } : undefined}
          dangerouslySetInnerHTML={{ __html: chapter?.html || '' }}
        />
      </div>
      {!bookMode && <div className="page-shade" />}
    </div>
  )

  return (
    <main className={`fixed inset-0 overflow-hidden fs-${fontSize}`}>
      <ProgressBar percent={percent} />

      {bookMode ? (
        <BookChrome
          onOpenNav={() => setNavOpen(true)}
          onShare={handleShare}
          fontSize={fontSize}
          onFontSize={setFontSize}
          theme={theme === 'dark' ? 'dark' : 'light'}
          onTheme={setTheme}
          onPrev={prevPage}
          onNext={nextPage}
          atStart={atVeryStart}
          atEnd={atVeryEnd}
        />
      ) : (
        <Toolbar
          visible={chromeVisible}
          title={chapter?.title || bookTitle}
          fontSize={fontSize}
          onFontSize={setFontSize}
          theme={theme}
          onTheme={setTheme}
          onOpenNav={() => setNavOpen(true)}
          onShare={handleShare}
        />
      )}

      {shareToast && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center">
          <div className="panel rounded-full px-4 py-2 text-sm" style={{ color: 'var(--ink)' }}>
            Link copied — thanks for sharing ✨
          </div>
        </div>
      )}

      <ChapterNav
        open={navOpen}
        chapters={chapters}
        currentIndex={chapterIndex}
        onSelect={(i) => goToChapter(i, 'first')}
        onClose={() => setNavOpen(false)}
      />

      {/* Reading sheet */}
      {bookMode ? (
        <BookSpread
          bookTitle={bookTitle}
          chapterTitle={chapter?.title || bookTitle}
          chapterNumber={chapter?.number || chapterIndex + 1}
          pageIndex={pageIndex}
          pageCount={pageCount}
          folioBase={folioBase}
          gutterRef={gutterRef}
          turnKey={`${chapterIndex}-${Math.floor(pageIndex / 2)}`}
          turnDir={turnDir}
        >
          {sheet}
        </BookSpread>
      ) : (
        <div className="absolute inset-0 flex justify-center">
          <div
            className="relative flex w-full max-w-2xl flex-col"
            style={{ padding: 'clamp(2.75rem,8vh,4.5rem) clamp(1.25rem,6vw,3.5rem)' }}
          >
            {sheet}
          </div>
        </div>
      )}

      {/* Tap / swipe layer — phone/tablet only. On desktop it would sit over
          the spread and swallow text selection, so the book does without it. */}
      {!bookMode && (
        <div
          className="tap-zone absolute inset-0 z-30"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        />
      )}

      {/* Desktop page arrows (book mode has its own, out in the margins) */}
      {!bookMode && chromeVisible && (
        <>
          <button
            onClick={prevPage}
            disabled={atVeryStart}
            aria-label="Previous page"
            className="absolute left-2 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-opacity disabled:opacity-0 sm:flex"
            style={{ color: 'var(--ink-soft)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={nextPage}
            disabled={atVeryEnd}
            aria-label="Next page"
            className="absolute right-2 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-opacity disabled:opacity-0 sm:flex"
            style={{ color: 'var(--ink-soft)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Bottom status — book mode prints its folios on the pages instead */}
      {!bookMode && (
        <footer
          className={`pointer-events-none fixed bottom-0 left-0 right-0 z-40 pb-4 text-center transition-opacity duration-300 ${
            chromeVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-[11px] tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            {atVeryEnd ? 'The End' : `Page ${pageIndex + 1} of ${pageCount}`}
            <span className="mx-2 opacity-40">·</span>
            {Math.round(percent)}%
          </span>
        </footer>
      )}

      {/* Continue reading prompt */}
      {showContinue && (
        <div className="pointer-events-none fixed bottom-14 left-0 right-0 z-40 flex justify-center px-4">
          <div className="panel pointer-events-auto flex items-center gap-3 rounded-full py-2 pl-5 pr-2">
            <span className="text-sm" style={{ color: 'var(--ink)' }}>
              Welcome back — picking up where you left off
            </span>
            <button
              onClick={() => goToChapter(0, 'first')}
              className="rounded-full px-3 py-1.5 text-xs"
              style={{ background: 'var(--paper-edge)', color: 'var(--ink-soft)' }}
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {showWelcome && <WelcomeModal onSubmit={handleWelcome} onSkip={handleSkip} />}
    </main>
  )
}
