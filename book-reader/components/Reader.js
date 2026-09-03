'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ProgressBar from './ProgressBar'
import Toolbar from './Toolbar'
import ChapterNav from './ChapterNav'
import WelcomeModal from './WelcomeModal'
import BookSpread from './BookSpread'
import BookChrome from './BookChrome'
import SelectionPopup, { QuestionComposer } from './SelectionPopup'
import SurveyCard from './SurveyCard'
import FeedbackPanel from './FeedbackPanel'
import ConsentNotice from './ConsentNotice'
import AccountBox from './AccountBox'
import {
  resolveReaderId,
  isRegistered,
  markRegistered,
  loadPosition,
  savePosition,
  getReferral,
  getLegacyReaderId,
  clearLegacyReaderId,
} from '../lib/reader-id'
import {
  registerReader,
  trackChapter,
  updateProgress,
  setReferrer,
  recordShare,
  addAnnotation,
} from '../lib/analytics'
import {
  startSession,
  track,
  flush,
  recordDwell,
  medianDwell,
  dwellSampleCount,
  setConsent,
} from '../lib/events'
import {
  blocksIn,
  anchorFromSelection,
  firstBlockOnPage,
  locationAt,
  percentThrough,
} from '../lib/locations'
import { COPY, BOOK, formatNumber } from '../lib/book-config'
import { questionsFor } from '../content/_survey'

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const SURVEY_KEY = 'br_surveys_done'

export default function Reader({ chapters, bookTitle, lang = 'en', totalLocations = 1 }) {
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

  // Identity + consent (auth-backed; falls back to local id in demo mode).
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [showConsent, setShowConsent] = useState(false)

  // Locations (the stable, human-readable position).
  const [location, setLocation] = useState(1)
  const [paragraphIndex, setParagraphIndex] = useState(0)

  // Selection → popup → composer.
  const [selRect, setSelRect] = useState(null)
  const [anchor, setAnchor] = useState(null)
  const [askOpen, setAskOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [survey, setSurvey] = useState(null)

  const viewportRef = useRef(null)
  const columnsRef = useRef(null)

  // Pagination intentions resolved after the next measure.
  const restorePageRef = useRef(null)
  const restoreParagraphRef = useRef(null)
  const goLastRef = useRef(false)

  // Location / event bookkeeping.
  const furthestRef = useRef(0)
  const pageEnteredRef = useRef(Date.now())
  const milestonesRef = useRef(new Set())
  const locationRef = useRef(1)
  // How the reader arrived in the current chapter: resume / toc / sequential.
  const enterViaRef = useRef('resume')
  const surveyShownRef = useRef(new Set())

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
    let cancelled = false

    // Local cache first, so the page can render immediately; the server
    // position (below) is the source of truth and wins when it arrives.
    const legacyId = getLegacyReaderId()
    const cached = legacyId ? loadPosition(legacyId) : null
    if (cached) {
      if (cached.fontSize) setFontSize(cached.fontSize)
      if (cached.theme) setTheme(cached.theme)
    }

    const ref = getReferral()

    ;(async () => {
      let me = { configured: false, user: null }
      try {
        const res = await fetch('/api/me', { credentials: 'same-origin' })
        me = await res.json()
      } catch {
        /* offline or no backend — fall through to demo mode */
      }
      if (cancelled) return

      if (me.configured && me.user) {
        // Identity is now the auth user id.
        setAuthed(true)
        setReaderId(me.user.id)
        setEmail(me.user.email || '')

        // Adopt any pre-account rows from this browser, then forget the old id.
        try {
          await fetch('/api/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ legacy_reader_id: legacyId }),
          })
          if (legacyId) clearLegacyReaderId()
        } catch {
          /* best effort */
        }

        const r = me.reader
        if (!r || !r.first_name) setShowWelcome(true)

        // Resume from the SERVER position — a stable chapter+paragraph anchor,
        // never a page number, so it carries across devices and font sizes.
        if (r && typeof r.current_chapter === 'number') {
          const ci = chapters.findIndex((c) => c.number === r.current_chapter)
          if (ci >= 0) {
            setChapterIndex(ci)
            restoreParagraphRef.current = r.current_paragraph || 0
            if (ci > 0 || (r.current_paragraph || 0) > 0) setHasProgress(true)
          }
        }
        furthestRef.current = r?.furthest_location || 0

        // Consent is asked once and never assumed.
        if (r && r.analytics_consent === null) {
          setShowConsent(true)
          startSession({ enabled: false })
        } else {
          const ok = r ? r.analytics_consent !== false : true
          startSession({ enabled: ok })
        }
      } else {
        // Demo mode (no Supabase): behave exactly as before.
        const id = resolveReaderId()
        setReaderId(id)
        const pos = loadPosition(id)
        if (pos && typeof pos.chapterIndex === 'number') {
          const ci = clamp(pos.chapterIndex, 0, chapters.length - 1)
          setChapterIndex(ci)
          restorePageRef.current = pos.pageIndex || 0
          if (ci > 0 || (pos.pageIndex || 0) > 0) setHasProgress(true)
        }
        if (!isRegistered(id)) setShowWelcome(true)
        else registerReader(id)
        if (ref) setReferrer(id, ref)
        startSession({ enabled: true })
      }

      if (ref) track('referral_landed', { ref })
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
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
      // Resuming by paragraph: find the column that paragraph landed in. This
      // is why position is stored as an anchor — the page number it maps to
      // differs per device, but the paragraph does not.
      if (restoreParagraphRef.current != null) {
        const idx = restoreParagraphRef.current
        restoreParagraphRef.current = null
        const el = blocksIn(col)[idx]
        if (el) return snap(clamp(Math.floor((el.offsetLeft + 1) / pitch), 0, total - 1))
      }
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
    track(
      'chapter_entered',
      { via: enterViaRef.current, title: chapter.title },
      { chapter: chapter.number, location: chapter.startLocation }
    )
    enterViaRef.current = 'sequential'
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

    // --- stable location for this page ---------------------------------------
    const paraIdx = firstBlockOnPage(columnsRef.current, pageIndex, pageWidth)
    const loc = chapter?.locations?.[paraIdx] ?? chapter?.startLocation ?? 1
    setParagraphIndex(paraIdx)
    setLocation(loc)

    // --- dwell on the page we just left, and stall detection ------------------
    const now = Date.now()
    const dwell = Math.round((now - pageEnteredRef.current) / 1000)
    const prevLoc = locationRef.current
    if (dwell >= 1 && dwell < 3600) {
      const median = recordDwell(dwell)
      track('page_dwell', { seconds: dwell }, { chapter: chapter.number, location: prevLoc })
      // "Stuck here": far longer than this reader's own typical page.
      if (median > 0 && dwellSampleCount() >= 8 && dwell > median * 3) {
        track('stall_detected', { seconds: dwell, median }, { chapter: chapter.number, location: prevLoc })
      }
    }
    pageEnteredRef.current = now
    locationRef.current = loc

    track('page_viewed', { page: pageIndex, of: pageCount }, { chapter: chapter.number, location: loc })

    // --- reread: went back at least a page behind the furthest point ----------
    if (furthestRef.current && loc < furthestRef.current - 1) {
      track('reread_detected', { from: furthestRef.current }, { chapter: chapter.number, location: loc })
    }
    if (loc > furthestRef.current) {
      furthestRef.current = loc
      track('furthest_point_updated', {}, { chapter: chapter.number, location: loc })
    }

    // --- milestones ----------------------------------------------------------
    for (const m of [25, 50, 75, 100]) {
      if (pct >= m && !milestonesRef.current.has(m)) {
        milestonesRef.current.add(m)
        track('progress_milestone', { milestone: m }, { chapter: chapter.number, location: loc })
      }
    }
    if (finished) track('book_finished', {}, { chapter: chapter.number, location: loc })

    clearTimeout(progressTimer.current)
    progressTimer.current = setTimeout(() => {
      updateProgress(readerId, {
        pct,
        chapter: chapter.number,
        page: pageIndex,
        finished,
      })
      // Server-side position: what makes resuming work on another device.
      if (authed) {
        fetch('/api/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            chapter_number: chapter.number,
            paragraph_index: paraIdx,
            location: loc,
            progress_pct: Math.round(pct),
            finished,
          }),
        }).catch(() => {})
      }
    }, 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, readerId, chapterIndex, pageIndex, pageCount, bookMode, pageWidth, authed])

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
    (index, where = 'first', via = 'sequential') => {
      if (index < 0 || index >= chapters.length) return
      flushChapter()
      enterViaRef.current = via
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
  // Email now comes from auth; this only captures the name.
  const handleWelcome = async ({ firstName, lastName }) => {
    setShowWelcome(false)
    if (readerId) markRegistered(readerId)
    if (authed) {
      try {
        await fetch('/api/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ first_name: firstName, last_name: lastName }),
        })
      } catch {
        /* ignore */
      }
    } else if (readerId) {
      registerReader(readerId, [firstName, lastName].filter(Boolean).join(' '))
    }
  }
  const handleSkip = () => {
    if (readerId) {
      markRegistered(readerId)
      if (!authed) registerReader(readerId)
    }
    setShowWelcome(false)
  }

  // Preference changes are part of the behavioural record too.
  const changeTheme = useCallback((next) => {
    setTheme(next)
    track('theme_changed', { theme: next })
  }, [])
  const changeFontSize = useCallback((next) => {
    setFontSize(next)
    track('font_size_changed', { size: next })
  }, [])

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
    track('share_initiated', { channel }, { chapter: chapter?.number, location: locationRef.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerId, bookTitle, chapter])

  // ---- selection: popup, anchors, copy ---------------------------------------
  useEffect(() => {
    if (!ready) return

    const onSelectionChange = () => {
      const sel = document.getSelection()
      const col = columnsRef.current
      if (!sel || sel.isCollapsed || !col) {
        setSelRect(null)
        return
      }
      // Only react to selections inside the reading column.
      if (!col.contains(sel.anchorNode)) {
        setSelRect(null)
        return
      }
      const a = anchorFromSelection(sel, col, chapter?.number)
      if (!a) {
        setSelRect(null)
        return
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      setAnchor({ ...a, location: locationRef.current, paragraph_index: a.paragraph_index })
      setSelRect({ top: rect.top, left: rect.left, width: rect.width })
      track('text_selected', { length: a.selected_text.length }, { chapter: chapter?.number, location: locationRef.current })
    }

    const onCopy = () => {
      const sel = document.getSelection()
      const col = columnsRef.current
      if (!sel || sel.isCollapsed || !col || !col.contains(sel.anchorNode)) return
      const a = anchorFromSelection(sel, col, chapter?.number)
      if (a) {
        track(
          'text_copied',
          { selected_text: a.selected_text.slice(0, 500), paragraph_index: a.paragraph_index },
          { chapter: chapter?.number, location: locationRef.current }
        )
      }
    }

    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('copy', onCopy)
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('copy', onCopy)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, chapterIndex])

  // ---- chapter-end survey ----------------------------------------------------
  useEffect(() => {
    if (!ready || !authed || showWelcome || survey) return
    const visible = bookMode ? Math.min(pageIndex + 1, pageCount - 1) : pageIndex
    const atChapterEnd = pageCount > 0 && visible >= pageCount - 1
    if (!atChapterEnd) return

    const num = chapter?.number
    if (num == null || surveyShownRef.current.has(num)) return

    // Once per chapter per reader, remembered locally as well as server-side.
    let done = []
    try {
      done = JSON.parse(localStorage.getItem(SURVEY_KEY) || '[]')
    } catch {
      done = []
    }
    if (done.includes(num)) return

    surveyShownRef.current.add(num)
    const isLast = chapterIndex === chapters.length - 1
    setSurvey({ chapterNumber: num, isEndOfBook: isLast, questions: questionsFor(num, isLast) })
    track('survey_shown', { kind: isLast ? 'end_of_book' : 'chapter' }, { chapter: num, location: locationRef.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authed, showWelcome, pageIndex, pageCount, chapterIndex, bookMode, survey])

  const markSurveyDone = useCallback((num) => {
    try {
      const done = JSON.parse(localStorage.getItem(SURVEY_KEY) || '[]')
      if (!done.includes(num)) localStorage.setItem(SURVEY_KEY, JSON.stringify([...done, num]))
    } catch {
      /* ignore */
    }
    setSurvey(null)
  }, [])

  // ---- action handlers -------------------------------------------------------
  const clearSelection = useCallback(() => {
    setSelRect(null)
    try {
      document.getSelection()?.removeAllRanges()
    } catch {
      /* ignore */
    }
  }, [])

  const onSelectionAction = useCallback(
    (action) => {
      if (!anchor) return
      if (action === 'ask') {
        setAskOpen(true)
        setSelRect(null)
        return
      }
      const kind = action === 'comment' ? 'comment' : action === 'like' ? 'like' : 'highlight'
      if (readerId) {
        addAnnotation(readerId, {
          chapter: anchor.chapter_number,
          title: chapter?.title,
          kind,
          passage: anchor.selected_text,
        })
      }
      track(
        kind === 'like' ? 'like_created' : kind === 'comment' ? 'note_created' : 'highlight_created',
        { length: anchor.selected_text.length },
        { chapter: anchor.chapter_number, location: anchor.location }
      )
      clearSelection()
    },
    [anchor, readerId, chapter, clearSelection]
  )

  const submitQuestion = useCallback(
    async (question) => {
      track('question_asked', { length: question.length }, { chapter: anchor?.chapter_number, location: anchor?.location })
      try {
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ ...anchor, question }),
        })
        const json = await res.json()
        return Boolean(json.ok)
      } catch {
        return false
      }
    },
    [anchor]
  )

  const submitFeedback = useCallback(
    async (message) => {
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            message,
            chapter_number: chapter?.number,
            location: locationRef.current,
            selected_text: anchor?.selected_text || null,
          }),
        })
      } catch {
        /* stored client-side intent only */
      }
    },
    [chapter, anchor]
  )

  const submitSurvey = useCallback(
    async (answers) => {
      if (!survey) return
      track('survey_completed', { answers }, { chapter: survey.chapterNumber, location: locationRef.current })
      try {
        await fetch('/api/survey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            chapter_number: survey.chapterNumber,
            kind: survey.isEndOfBook ? 'end_of_book' : 'chapter',
            answers,
          }),
        })
      } catch {
        /* ignore */
      }
      markSurveyDone(survey.chapterNumber)
    },
    [survey, markSurveyDone]
  )

  const acceptConsent = useCallback(async (granted) => {
    setShowConsent(false)
    setConsent(granted)
    track(granted ? 'consent_granted' : 'consent_declined')
    if (granted) startSession({ enabled: true })
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ analytics_consent: granted }),
      })
    } catch {
      /* ignore */
    }
    if (!granted) flush(true)
  }, [])

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
          onFeedback={() => { track('feedback_opened'); setFeedbackOpen(true) }}
          fontSize={fontSize}
          onFontSize={changeFontSize}
          theme={theme === 'dark' ? 'dark' : 'light'}
          onTheme={changeTheme}
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
          onFontSize={changeFontSize}
          theme={theme}
          onTheme={changeTheme}
          onOpenNav={() => setNavOpen(true)}
          onShare={handleShare}
          onFeedback={() => { track('feedback_opened'); setFeedbackOpen(true) }}
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
        onSelect={(i) => goToChapter(i, 'first', 'toc')}
        onClose={() => setNavOpen(false)}
        account={authed ? <AccountBox email={email} /> : null}
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
            {atVeryEnd ? COPY.reader.theEnd : COPY.reader.locationLabel(location, totalLocations)}
            <span className="mx-2 opacity-40">·</span>
            {COPY.reader.chapterLabel(chapter?.number ?? 1)}
          </span>
        </footer>
      )}

      {/* Book mode keeps its folios, but the location belongs on screen too */}
      {bookMode && (
        <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-3 text-center">
          <span className="text-[11px] tracking-wide" style={{ color: 'rgba(228,216,192,0.4)' }}>
            {COPY.reader.locationLabel(location, totalLocations)}
            <span className="mx-2 opacity-50">·</span>
            {percentThrough(location, totalLocations)}%
          </span>
        </footer>
      )}

      {/* Continue reading prompt */}
      {showContinue && (
        <div className="pointer-events-none fixed bottom-14 left-0 right-0 z-40 flex justify-center px-4">
          <div className="panel pointer-events-auto flex items-center gap-3 rounded-full py-2 pl-5 pr-2">
            <span className="text-sm" style={{ color: 'var(--ink)' }}>
              {COPY.reader.resume}
            </span>
            <button
              onClick={() => {
                track('resume_prompt_accepted', {}, { chapter: chapter?.number, location })
                goToChapter(0, 'first', 'toc')
              }}
              className="rounded-full px-3 py-1.5 text-xs"
              style={{ background: 'var(--paper-edge)', color: 'var(--ink-soft)' }}
            >
              {COPY.reader.restart}
            </button>
          </div>
        </div>
      )}

      {/* Selection → highlight / note / like / ask */}
      {selRect && !askOpen && (
        <SelectionPopup rect={selRect} onAction={onSelectionAction} onDismiss={clearSelection} />
      )}
      {askOpen && (
        <QuestionComposer
          selectedText={anchor?.selected_text}
          onSubmit={submitQuestion}
          onClose={() => {
            setAskOpen(false)
            clearSelection()
          }}
        />
      )}

      {/* Chapter-end / end-of-book survey */}
      {survey && !showWelcome && (
        <SurveyCard
          chapterNumber={survey.chapterNumber}
          questions={survey.questions}
          isEndOfBook={survey.isEndOfBook}
          onSubmit={submitSurvey}
          onSkip={() => {
            track('survey_skipped', {}, { chapter: survey.chapterNumber, location })
            markSurveyDone(survey.chapterNumber)
          }}
        />
      )}

      {feedbackOpen && (
        <FeedbackPanel onSubmit={submitFeedback} onClose={() => setFeedbackOpen(false)} />
      )}

      {showConsent && !showWelcome && (
        <ConsentNotice onAccept={() => acceptConsent(true)} onDecline={() => acceptConsent(false)} />
      )}

      {showWelcome && <WelcomeModal onSubmit={handleWelcome} onSkip={handleSkip} />}
    </main>
  )
}
