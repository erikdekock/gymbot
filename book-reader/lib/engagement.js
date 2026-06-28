// ===========================================================================
//  Engagement scoring — the one place to tweak how "fan-ness" is measured.
//  Pure functions, no I/O, so it's easy to unit-test or adjust the weights.
//
//  A reader's score is 0–100, built from five weighted components:
//
//    completion   up to 40  — how far through the book they are
//    time         up to 20  — total reading time (saturates at ~READING_CAP_MIN)
//    interactions up to 25  — highlights, comments, likes (weighted)
//    shared       +10       — they shared the book at least once
//    subscribed   +5        — they opted in to Het Zal
//
//  Tweak the WEIGHTS / saturation constants below to taste. The breakdown is
//  returned too, so the profile view can show how a score was earned.
// ===========================================================================

export const WEIGHTS = {
  completion: 40,
  time: 20,
  interactions: 25,
  shared: 10,
  subscribed: 5,
}

// Reading time that counts as "fully engaged" on the time axis (minutes).
const READING_CAP_MIN = 30
// Weighted interaction volume that maxes out the interactions axis.
const INTERACTION_CAP = 15
// Per-type interaction weights (a comment signals more than a like).
const INTERACTION_WEIGHTS = { highlights: 2, comments: 3, likes: 1 }

const clamp01 = (n) => Math.max(0, Math.min(1, n))

/**
 * @param {object} r per-reader aggregate
 * @param {number} r.progressPct        0–100
 * @param {number} r.timeSpentSeconds   total seconds across chapters
 * @param {number} r.highlights
 * @param {number} r.comments
 * @param {number} r.likes
 * @param {boolean} r.shared
 * @param {boolean} r.subscribed
 * @returns {{score:number, tier:object, breakdown:object}}
 */
export function computeEngagement(r = {}) {
  const progress = clamp01((r.progressPct || 0) / 100)
  const minutes = (r.timeSpentSeconds || 0) / 60
  const interactionVolume =
    (r.highlights || 0) * INTERACTION_WEIGHTS.highlights +
    (r.comments || 0) * INTERACTION_WEIGHTS.comments +
    (r.likes || 0) * INTERACTION_WEIGHTS.likes

  const breakdown = {
    completion: Math.round(progress * WEIGHTS.completion),
    time: Math.round(clamp01(minutes / READING_CAP_MIN) * WEIGHTS.time),
    interactions: Math.round(clamp01(interactionVolume / INTERACTION_CAP) * WEIGHTS.interactions),
    shared: r.shared ? WEIGHTS.shared : 0,
    subscribed: r.subscribed ? WEIGHTS.subscribed : 0,
  }

  const score = Math.min(
    100,
    breakdown.completion +
      breakdown.time +
      breakdown.interactions +
      breakdown.shared +
      breakdown.subscribed
  )

  return { score, tier: tierFor(score), breakdown }
}

// Score → human label. Thresholds are deliberately gentle so a finished-the-book
// reader who also shared/subscribed lands as a Superfan.
export const TIERS = [
  { key: 'superfan', label: 'Superfan', emoji: '🔥', min: 70, color: '#c2410c' },
  { key: 'engaged', label: 'Engaged', emoji: '✨', min: 40, color: '#9b6a43' },
  { key: 'casual', label: 'Casual', emoji: '🙂', min: 15, color: '#6b6256' },
  { key: 'browsing', label: 'Just browsing', emoji: '👀', min: 0, color: '#9a9183' },
]

export function tierFor(score) {
  return TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1]
}

// Labels for the breakdown rows in the profile view.
export const BREAKDOWN_LABELS = {
  completion: 'Completion',
  time: 'Reading time',
  interactions: 'Highlights & comments',
  shared: 'Shared the book',
  subscribed: 'Subscribed',
}
