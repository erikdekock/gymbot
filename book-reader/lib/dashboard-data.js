'use client'

// ===========================================================================
//  Dashboard data layer.
//
//  Since the security pass, the browser no longer talks to Supabase at all:
//  it fetches /api/dashboard/data, which reads with the service-role key on
//  the server behind the httpOnly dashboard cookie. Everything below is pure
//  derivation from those rows.
//
//  Insights are keyed to LOCATIONS rather than pages, because a page is a
//  property of someone's screen and a location is a property of the book.
// ===========================================================================

import { computeEngagement } from './engagement'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const displayName = (r) => {
  if (!r) return 'Anonymous reader'
  const full = [r.first_name, r.last_name].filter(Boolean).join(' ')
  return full || r.name || r.email || 'Anonymous reader'
}

export async function loadDashboardData() {
  let payload
  try {
    const res = await fetch('/api/dashboard/data', { credentials: 'same-origin' })
    if (res.status === 401) return { locked: true, configured: false, missingTables: [], data: null }
    payload = await res.json()
  } catch {
    return { configured: false, missingTables: [], data: null, error: 'unreachable' }
  }

  if (!payload?.configured || !payload.data) {
    return { configured: false, missingTables: payload?.missingTables || [], data: null }
  }

  const {
    readers, chapter_stats: stats, annotations, feedback, subscribers, shares,
    questions, survey_responses: surveys, events,
  } = payload.data

  const chapters = payload.chapters || []
  const totalLocations = payload.totalLocations || 1

  const readerById = Object.fromEntries(readers.map((r) => [r.id, r]))
  const statsByReader = groupBy(stats, 'reader_id')
  const annByReader = groupBy(annotations, 'reader_id')
  const fbByReader = groupBy(feedback, 'user_id')
  const subByReader = Object.fromEntries(subscribers.map((s) => [s.reader_id, s]))
  const sharesByReader = groupBy(shares, 'reader_id')
  const qByUser = groupBy(questions, 'user_id')
  const evByUser = groupBy(events, 'user_id')
  const referredBy = groupBy(readers.filter((r) => r.referred_by), 'referred_by')

  const chapterTitle = {}
  chapters.forEach((c) => (chapterTitle[c.number] = c.title))
  stats.forEach((s) => {
    if (!chapterTitle[s.chapter_number] && s.chapter_title) chapterTitle[s.chapter_number] = s.chapter_title
  })
  const titleOf = (n) => chapterTitle[n] || `Chapter ${n}`

  // ---- people ---------------------------------------------------------------
  const people = readers.map((r) => {
    const rs = (statsByReader[r.id] || []).slice().sort((a, b) => a.chapter_number - b.chapter_number)
    const anns = annByReader[r.id] || []
    const counts = {
      highlights: anns.filter((a) => a.kind === 'highlight').length,
      comments: anns.filter((a) => a.kind === 'comment').length,
      likes: anns.filter((a) => a.kind === 'like').length,
    }
    const timeSpentSeconds =
      r.total_reading_seconds || rs.reduce((t, s) => t + (s.time_spent_seconds || 0), 0)
    const shared = (sharesByReader[r.id] || []).length > 0
    const subscribed = Boolean(subByReader[r.id])
    const myFeedback = fbByReader[r.id] || []
    const myQuestions = qByUser[r.id] || []
    const engagement = computeEngagement({
      progressPct: r.progress_pct || 0,
      timeSpentSeconds,
      highlights: counts.highlights,
      comments: counts.comments,
      likes: counts.likes,
      shared,
      subscribed,
    })

    return {
      id: r.id,
      raw: r,
      displayName: displayName(r),
      email: r.email || '',
      progressPct: r.progress_pct || 0,
      currentChapter: r.current_chapter || 1,
      currentChapterTitle: titleOf(r.current_chapter || 1),
      currentLocation: r.current_location || 0,
      furthestLocation: r.furthest_location || 0,
      medianDwell: r.median_page_dwell || 0,
      sessionCount: r.session_count || 0,
      finished: !!r.finished,
      started: (r.furthest_location || 0) > 0 || (r.progress_pct || 0) > 0 || rs.length > 0,
      lastSeen: r.last_seen_at,
      createdAt: r.created_at,
      consent: r.analytics_consent,
      timeSpentSeconds,
      chapterStats: rs,
      annotations: anns.slice().sort(byDateDesc('created_at')),
      feedback: myFeedback.slice().sort(byDateDesc('created_at')),
      questions: myQuestions.slice().sort(byDateDesc('created_at')),
      events: (evByUser[r.id] || []).slice().sort(byDateDesc('occurred_at')),
      subscription: subByReader[r.id] || null,
      subscribed,
      shared,
      shareCount: (sharesByReader[r.id] || []).length,
      gaveFeedback: myFeedback.length > 0,
      counts,
      engagement,
      referrerName: r.referred_by && readerById[r.referred_by] ? displayName(readerById[r.referred_by]) : null,
      invitees: (referredBy[r.id] || []).map((i) => ({ id: i.id, name: displayName(i) })),
    }
  })
  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]))
  const nameOf = (id) => (peopleById[id] ? peopleById[id].displayName : 'Someone')

  // ---- overview -------------------------------------------------------------
  const now = Date.now()
  const total = readers.length
  const overview = {
    total,
    newThisWeek: readers.filter((r) => now - new Date(r.created_at).getTime() <= WEEK_MS).length,
    readingCount: people.filter((p) => p.started && !p.finished).length,
    finishedCount: people.filter((p) => p.finished).length,
    notStartedCount: people.filter((p) => !p.started).length,
    avgCompletion: total ? Math.round(people.reduce((s, p) => s + p.progressPct, 0) / total) : 0,
    totalHighlights: annotations.filter((a) => a.kind === 'highlight').length,
    totalComments: annotations.filter((a) => a.kind === 'comment').length,
    totalLikes: annotations.filter((a) => a.kind === 'like').length,
    subscriberCount: subscribers.length,
    optInRate: total ? Math.round((subscribers.length / total) * 100) : 0,
    timesShared: shares.length,
    referralReach: readers.filter((r) => r.referred_by).length,
    openQuestions: questions.filter((q) => q.status !== 'answered').length,
    totalQuestions: questions.length,
    surveyCount: surveys.length,
    eventCount: events.length,
  }

  // ---- activity feed --------------------------------------------------------
  const feed = []
  readers.forEach((r) => {
    if (r.finished && r.finished_at) feed.push({ ts: r.finished_at, icon: '🏁', text: `${displayName(r)} finished the book` })
    else if ((r.progress_pct || 0) > 0) feed.push({ ts: r.last_seen_at, icon: '📖', text: `${displayName(r)} is reading ${titleOf(r.current_chapter || 1)}` })
  })
  questions.forEach((q) => feed.push({ ts: q.created_at, icon: '❓', text: `${nameOf(q.user_id)} asked a question in ${titleOf(q.chapter_number)}` }))
  surveys.forEach((s) => feed.push({ ts: s.created_at, icon: '📝', text: `${nameOf(s.user_id)} answered the survey for ${titleOf(s.chapter_number)}` }))
  annotations.forEach((a) => {
    const verb = a.kind === 'highlight' ? 'highlighted a passage in' : a.kind === 'like' ? 'liked' : 'commented on'
    feed.push({ ts: a.created_at, icon: a.kind === 'like' ? '❤️' : a.kind === 'comment' ? '💬' : '✏️', text: `${nameOf(a.reader_id)} ${verb} ${titleOf(a.chapter_number)}` })
  })
  subscribers.forEach((s) => feed.push({ ts: s.subscribed_at, icon: '✉️', text: `${s.name || nameOf(s.reader_id)} subscribed to Het Zal` }))
  shares.forEach((s) => feed.push({ ts: s.created_at, icon: '↗️', text: `${nameOf(s.reader_id)} shared the book` }))
  feedback.forEach((f) => feed.push({ ts: f.created_at, icon: '🗨️', text: `${nameOf(f.user_id)} left feedback` }))
  feed.sort((a, b) => new Date(b.ts) - new Date(a.ts))
  const activity = feed.filter((e) => e.ts).slice(0, 16)

  // ---- story insights, by location -----------------------------------------
  const evByType = groupBy(events, 'event_type')
  const bucketSize = Math.max(1, Math.ceil(totalLocations / 40))
  const buckets = []
  for (let i = 0; i < Math.ceil(totalLocations / bucketSize); i++) {
    buckets.push({
      from: i * bucketSize + 1,
      to: Math.min(totalLocations, (i + 1) * bucketSize),
      stalls: 0,
      rereads: 0,
      copies: 0,
      readers: 0,
    })
  }
  const bucketFor = (loc) => buckets[Math.floor((Math.max(1, loc) - 1) / bucketSize)]
  ;(evByType.stall_detected || []).forEach((e) => { const b = bucketFor(e.location); if (b) b.stalls++ })
  ;(evByType.reread_detected || []).forEach((e) => { const b = bucketFor(e.location); if (b) b.rereads++ })
  ;(evByType.text_copied || []).forEach((e) => { const b = bucketFor(e.location); if (b) b.copies++ })
  // "How many readers got at least this far" — the retention curve by location.
  buckets.forEach((b) => {
    b.readers = people.filter((p) => p.furthestLocation >= b.to).length
    b.retentionPct = total ? Math.round((b.readers / total) * 100) : 0
  })

  // The single biggest fall between consecutive buckets: where readers stop.
  let dropOff = null
  for (let i = 0; i < buckets.length - 1; i++) {
    const lost = buckets[i].readers - buckets[i + 1].readers
    if (lost > 0 && (!dropOff || lost > dropOff.lost)) {
      dropOff = { fromLocation: buckets[i].to, lost, chapter: chapterAtLocation(chapters, buckets[i].to) }
    }
  }

  const chaptersInsight = chapters.map((c, i) => {
    const next = chapters[i + 1]
    const endLoc = next ? next.startLocation - 1 : totalLocations
    const rs = stats.filter((s) => s.chapter_number === c.number)
    const anns = annotations.filter((a) => a.chapter_number === c.number)
    const reached = people.filter((p) => p.furthestLocation >= c.startLocation).length
    const highlights = anns.filter((a) => a.kind === 'highlight').length
    const likes = anns.filter((a) => a.kind === 'like').length
    const comments = anns.filter((a) => a.kind === 'comment').length
    const inRange = (e) => e.location >= c.startLocation && e.location <= endLoc
    return {
      number: c.number,
      title: c.title,
      startLocation: c.startLocation,
      endLocation: endLoc,
      readersReached: reached,
      retentionPct: total ? Math.round((reached / total) * 100) : 0,
      avgSeconds: rs.length ? Math.round(rs.reduce((t, s) => t + (s.time_spent_seconds || 0), 0) / rs.length) : 0,
      highlights, likes, comments,
      interactions: highlights + likes + comments,
      stalls: (evByType.stall_detected || []).filter(inRange).length,
      rereads: (evByType.reread_detected || []).filter(inRange).length,
      copies: (evByType.text_copied || []).filter(inRange).length,
      survey: summariseSurvey(surveys.filter((s) => s.chapter_number === c.number)),
    }
  })

  // Most-resonant passages (highlights, likes and copies all count).
  const passageMap = {}
  const addPassage = (text, chapter, kind) => {
    if (!text || !text.trim()) return
    const key = text.trim().toLowerCase().slice(0, 300)
    if (!passageMap[key]) passageMap[key] = { passage: text.trim(), count: 0, chapter, highlights: 0, likes: 0, copies: 0 }
    passageMap[key].count++
    passageMap[key][kind]++
  }
  annotations.forEach((a) => {
    if (a.kind === 'highlight') addPassage(a.passage, a.chapter_number, 'highlights')
    if (a.kind === 'like') addPassage(a.passage, a.chapter_number, 'likes')
  })
  ;(evByType.text_copied || []).forEach((e) => addPassage(e.payload?.selected_text, e.chapter_number, 'copies'))
  const topPassages = Object.values(passageMap).sort((a, b) => b.count - a.count).slice(0, 10)

  // ---- growth ---------------------------------------------------------------
  const weekMap = {}
  const bumpWeek = (iso, field) => {
    const w = weekStart(iso)
    if (!w) return
    const key = w.getTime()
    if (!weekMap[key]) weekMap[key] = { week: w, newReaders: 0, newSubscribers: 0 }
    weekMap[key][field] += 1
  }
  readers.forEach((r) => bumpWeek(r.created_at, 'newReaders'))
  subscribers.forEach((s) => bumpWeek(s.subscribed_at, 'newSubscribers'))
  let cumR = 0
  let cumS = 0
  const growth = Object.values(weekMap)
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      cumR += w.newReaders
      cumS += w.newSubscribers
      return {
        weekDate: w.week,
        label: w.week.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        newReaders: w.newReaders,
        newSubscribers: w.newSubscribers,
        cumulativeReaders: cumR,
        optInRate: cumR ? Math.round((cumS / cumR) * 100) : 0,
      }
    })

  const topSharers = people
    .map((p) => ({ id: p.id, name: p.displayName, referred: p.invitees.length, shares: p.shareCount, subscribed: p.subscribed }))
    .filter((p) => p.referred > 0 || p.shares > 0)
    .sort((a, b) => b.referred - a.referred || b.shares - a.shares)
    .slice(0, 10)

  const referralChains = people
    .filter((p) => p.invitees.length > 0)
    .map((p) => ({ id: p.id, name: p.displayName, invitees: p.invitees }))
    .sort((a, b) => b.invitees.length - a.invitees.length)

  // ---- questions + surveys for their own tabs -------------------------------
  const questionRows = questions
    .slice()
    .sort(byDateDesc('created_at'))
    .map((q) => ({
      ...q,
      readerName: nameOf(q.user_id),
      readerEmail: readerById[q.user_id]?.email || '',
      chapterTitle: titleOf(q.chapter_number),
      percent: totalLocations ? Math.round(((q.location || 0) / totalLocations) * 100) : 0,
    }))

  const surveyRows = surveys.slice().sort(byDateDesc('created_at')).map((s) => ({
    ...s,
    readerName: nameOf(s.user_id),
    chapterTitle: titleOf(s.chapter_number),
  }))

  return {
    configured: true,
    missingTables: payload.missingTables || [],
    data: {
      overview,
      activity,
      people,
      chaptersInsight,
      buckets,
      dropOff,
      topPassages,
      growth,
      subscribers: subscribers.slice().sort(byDateDesc('subscribed_at')),
      topSharers,
      referralChains,
      questions: questionRows,
      surveys: surveyRows,
      totalLocations,
      totals: { readers: total },
    },
  }
}

// --- helpers ---------------------------------------------------------------

function summariseSurvey(rows) {
  if (!rows.length) return null
  const ratings = rows.map((r) => Number(r.answers?.rating)).filter((n) => n > 0)
  const comprehension = {}
  rows.forEach((r) => {
    const c = r.answers?.comprehension
    if (c) comprehension[c] = (comprehension[c] || 0) + 1
  })
  const open = rows
    .map((r) => Object.entries(r.answers || {}).filter(([k, v]) => typeof v === 'string' && v.trim() && k !== 'comprehension'))
    .flat()
    .map(([, v]) => v)
  return {
    responses: rows.length,
    avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    comprehension,
    open,
  }
}

function chapterAtLocation(chapters, loc) {
  let found = chapters[0]
  for (const c of chapters) if (c.startLocation <= loc) found = c
  return found ? found.number : null
}

function weekStart(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return null
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d
}

const byDateDesc = (field) => (a, b) => new Date(b[field]) - new Date(a[field])

function groupBy(rows, key) {
  const out = {}
  for (const row of rows || []) {
    const k = row[key]
    if (k == null) continue
    ;(out[k] || (out[k] = [])).push(row)
  }
  return out
}
