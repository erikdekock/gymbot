'use client'

// ===========================================================================
//  Dashboard data layer.
//  Loads every raw table once (readers, chapter_stats, annotations, feedback,
//  subscribers, shares) and derives all the views the command center needs:
//  overview stats, per-reader profiles, story insights, growth & referrals.
//
//  Everything is computed here (client-side) so the UI stays dumb and the whole
//  thing degrades gracefully: a missing table just becomes an empty array, and
//  a missing Supabase config returns `configured: false`.
// ===========================================================================

import { supabase, isAnalyticsEnabled } from './supabase'
import { computeEngagement } from './engagement'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

async function safeSelect(table) {
  if (!supabase) return { rows: [], missing: false }
  try {
    const { data, error } = await supabase.from(table).select('*')
    if (error) return { rows: [], missing: true, error: error.message }
    return { rows: data || [], missing: false }
  } catch (e) {
    return { rows: [], missing: true, error: e?.message || String(e) }
  }
}

function weekStart(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return null
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d
}

const displayName = (r) =>
  (r && (r.name || r.email)) ? (r.name || r.email) : 'Anonymous reader'

export async function loadDashboardData(chapters = []) {
  if (!isAnalyticsEnabled()) {
    return { configured: false, missingTables: [], data: null }
  }

  const [readersR, statsR, annR, fbR, subR, shareR] = await Promise.all([
    safeSelect('readers'),
    safeSelect('chapter_stats'),
    safeSelect('annotations'),
    safeSelect('feedback'),
    safeSelect('subscribers'),
    safeSelect('shares'),
  ])

  const missingTables = [
    ['readers', readersR],
    ['chapter_stats', statsR],
    ['annotations', annR],
    ['feedback', fbR],
    ['subscribers', subR],
    ['shares', shareR],
  ]
    .filter(([, r]) => r.missing)
    .map(([name]) => name)

  const readers = readersR.rows
  const stats = statsR.rows
  const annotations = annR.rows
  const feedback = fbR.rows
  const subscribers = subR.rows
  const shares = shareR.rows

  const readerById = Object.fromEntries(readers.map((r) => [r.id, r]))

  // ---- chapter catalogue (prefer the real book; fall back to seen data) -----
  const chapterTitle = {}
  chapters.forEach((c) => (chapterTitle[c.number] = c.title))
  stats.forEach((s) => {
    if (!chapterTitle[s.chapter_number] && s.chapter_title) chapterTitle[s.chapter_number] = s.chapter_title
  })
  const chapterNumbers = Array.from(
    new Set([
      ...chapters.map((c) => c.number),
      ...stats.map((s) => s.chapter_number),
      ...annotations.map((a) => a.chapter_number),
    ])
  )
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
  const titleOf = (n) => chapterTitle[n] || `Chapter ${n}`

  // ---- group helpers ---------------------------------------------------------
  const statsByReader = groupBy(stats, 'reader_id')
  const annByReader = groupBy(annotations, 'reader_id')
  const fbByReader = groupBy(feedback, 'reader_id')
  const subByReader = Object.fromEntries(subscribers.map((s) => [s.reader_id, s]))
  const sharesByReader = groupBy(shares, 'reader_id')
  const referredBy = groupBy(readers.filter((r) => r.referred_by), 'referred_by')

  const maxReached = (r) => {
    const rs = statsByReader[r.id] || []
    const statMax = rs.reduce((m, s) => Math.max(m, s.chapter_number || 0), 0)
    const progressCh = (r.progress_pct || 0) > 0 ? r.current_chapter || 0 : 0
    return Math.max(statMax, progressCh)
  }

  // ---- per-reader profiles ---------------------------------------------------
  const people = readers.map((r) => {
    const rs = (statsByReader[r.id] || []).slice().sort((a, b) => a.chapter_number - b.chapter_number)
    const anns = annByReader[r.id] || []
    const counts = {
      highlights: anns.filter((a) => a.kind === 'highlight').length,
      comments: anns.filter((a) => a.kind === 'comment').length,
      likes: anns.filter((a) => a.kind === 'like').length,
    }
    const timeSpentSeconds = rs.reduce((t, s) => t + (s.time_spent_seconds || 0), 0)
    const shared = (sharesByReader[r.id] || []).length > 0
    const subscribed = Boolean(subByReader[r.id])
    const gaveFeedback = (fbByReader[r.id] || []).length > 0
    const engagement = computeEngagement({
      progressPct: r.progress_pct || 0,
      timeSpentSeconds,
      highlights: counts.highlights,
      comments: counts.comments,
      likes: counts.likes,
      shared,
      subscribed,
    })
    const referrer = r.referred_by ? readerById[r.referred_by] : null
    const invitees = referredBy[r.id] || []

    return {
      id: r.id,
      raw: r,
      name: r.name || '',
      email: r.email || '',
      displayName: displayName(r),
      progressPct: r.progress_pct || 0,
      currentChapter: r.current_chapter || 1,
      currentChapterTitle: titleOf(r.current_chapter || 1),
      finished: !!r.finished,
      started: maxReached(r) > 0 || (r.progress_pct || 0) > 0,
      lastSeen: r.last_seen_at,
      createdAt: r.created_at,
      timeSpentSeconds,
      chapterStats: rs,
      annotations: anns.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      feedback: (fbByReader[r.id] || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      subscription: subByReader[r.id] || null,
      subscribed,
      shared,
      shareCount: (sharesByReader[r.id] || []).length,
      gaveFeedback,
      counts,
      engagement,
      referrerName: referrer ? displayName(referrer) : null,
      referrerId: r.referred_by || null,
      invitees: invitees.map((i) => ({ id: i.id, name: displayName(i) })),
    }
  })
  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]))

  // ---- overview --------------------------------------------------------------
  const now = Date.now()
  const total = readers.length
  const newThisWeek = readers.filter((r) => now - new Date(r.created_at).getTime() <= WEEK_MS).length
  const finishedCount = people.filter((p) => p.finished).length
  const readingCount = people.filter((p) => p.started && !p.finished).length
  const notStartedCount = people.filter((p) => !p.started).length
  const avgCompletion = total ? Math.round(people.reduce((s, p) => s + p.progressPct, 0) / total) : 0
  const totalHighlights = annotations.filter((a) => a.kind === 'highlight').length
  const totalComments = annotations.filter((a) => a.kind === 'comment').length
  const totalLikes = annotations.filter((a) => a.kind === 'like').length
  const subscriberCount = subscribers.length
  const optInRate = total ? Math.round((subscriberCount / total) * 100) : 0
  const referralReach = readers.filter((r) => r.referred_by).length

  const overview = {
    total,
    newThisWeek,
    readingCount,
    finishedCount,
    notStartedCount,
    avgCompletion,
    totalHighlights,
    totalComments,
    totalLikes,
    subscriberCount,
    optInRate,
    timesShared: shares.length,
    referralReach,
  }

  // ---- activity feed (most recent events across everything) ------------------
  const feed = []
  const nameOf = (id) => (peopleById[id] ? peopleById[id].displayName : 'Someone')
  readers.forEach((r) => {
    if (r.finished && r.finished_at)
      feed.push({ ts: r.finished_at, icon: '🏁', text: `${displayName(r)} finished the book` })
    else if ((r.progress_pct || 0) > 0)
      feed.push({ ts: r.last_seen_at, icon: '📖', text: `${displayName(r)} is reading ${titleOf(r.current_chapter || 1)}` })
  })
  annotations.forEach((a) => {
    const verb = a.kind === 'highlight' ? 'highlighted a passage in' : a.kind === 'like' ? 'liked' : 'commented on'
    feed.push({ ts: a.created_at, icon: a.kind === 'like' ? '❤️' : a.kind === 'comment' ? '💬' : '✏️', text: `${nameOf(a.reader_id)} ${verb} ${titleOf(a.chapter_number)}` })
  })
  subscribers.forEach((s) => feed.push({ ts: s.subscribed_at, icon: '✉️', text: `${s.name || nameOf(s.reader_id)} subscribed to Het Zal` }))
  shares.forEach((s) => feed.push({ ts: s.created_at, icon: '↗️', text: `${nameOf(s.reader_id)} shared the book` }))
  feedback.forEach((f) => feed.push({ ts: f.created_at, icon: '🗨️', text: `${nameOf(f.reader_id)} left feedback` }))
  feed.sort((a, b) => new Date(b.ts) - new Date(a.ts))
  const activity = feed.filter((e) => e.ts).slice(0, 16)

  // ---- story insights --------------------------------------------------------
  const chaptersInsight = chapterNumbers.map((n) => {
    const rs = stats.filter((s) => s.chapter_number === n)
    const anns = annotations.filter((a) => a.chapter_number === n)
    const reached = readers.filter((r) => maxReached(r) >= n).length
    const avgSeconds = rs.length ? Math.round(rs.reduce((t, s) => t + (s.time_spent_seconds || 0), 0) / rs.length) : 0
    const highlights = anns.filter((a) => a.kind === 'highlight').length
    const likes = anns.filter((a) => a.kind === 'like').length
    const comments = anns.filter((a) => a.kind === 'comment').length
    return {
      number: n,
      title: titleOf(n),
      readersReached: reached,
      retentionPct: total ? Math.round((reached / total) * 100) : 0,
      avgSeconds,
      highlights,
      likes,
      comments,
      interactions: highlights + likes + comments,
    }
  })

  // Drop-off: biggest fall in readers between consecutive chapters.
  let dropOff = null
  for (let i = 0; i < chaptersInsight.length - 1; i++) {
    const a = chaptersInsight[i]
    const b = chaptersInsight[i + 1]
    const lost = a.readersReached - b.readersReached
    if (lost > 0 && (!dropOff || lost > dropOff.lost)) {
      dropOff = { afterChapter: a.number, afterTitle: a.title, lost, fromReached: a.readersReached }
    }
  }

  // Most-resonant passages (highlights + likes that carry text).
  const passageMap = {}
  annotations
    .filter((a) => (a.kind === 'highlight' || a.kind === 'like') && a.passage && a.passage.trim())
    .forEach((a) => {
      const key = a.passage.trim().toLowerCase()
      if (!passageMap[key]) passageMap[key] = { passage: a.passage.trim(), count: 0, chapter: a.chapter_number, highlights: 0, likes: 0 }
      passageMap[key].count += 1
      if (a.kind === 'highlight') passageMap[key].highlights += 1
      else passageMap[key].likes += 1
    })
  const topPassages = Object.values(passageMap).sort((a, b) => b.count - a.count).slice(0, 8)

  // ---- growth & referrals ----------------------------------------------------
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

  return {
    configured: true,
    missingTables,
    data: {
      overview,
      activity,
      people,
      chaptersInsight,
      dropOff,
      topPassages,
      growth,
      subscribers: subscribers
        .slice()
        .sort((a, b) => new Date(b.subscribed_at) - new Date(a.subscribed_at))
        .map((s) => ({ ...s, name: s.name || (readerById[s.reader_id] ? readerById[s.reader_id].name : '') })),
      topSharers,
      referralChains,
      totals: { readers: total },
    },
  }
}

function groupBy(rows, key) {
  const out = {}
  for (const row of rows) {
    const k = row[key]
    if (k == null) continue
    ;(out[k] || (out[k] = [])).push(row)
  }
  return out
}
