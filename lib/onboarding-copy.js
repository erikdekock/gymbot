/**
 * Onboarding copy module.
 *
 * 12.2 — Prelude UI ships with hardcoded placeholder copy for the
 * Scripted #1 completion surface (Screen 9).
 *
 * 12.3 — Prelude round-trip will swap this file's exports to read from the
 * KB JSON built by 12.1's `scripts/build-kb.mjs`. The function signatures
 * below are the contract; reimplementations preserve them.
 *
 * Layer 6 Voice: respectful-adult, "we" attribution, no pep talk, no
 * gamification, no aspirational comparison. No named persona.
 */

/**
 * Scripted #1 — Prelude completion body.
 *
 * @param {object} opts
 * @param {string|null} opts.userWordsGoal  free-text goal in user's own words
 * @param {string|null} opts.goalDisplayName  Layer 4 goal display name
 * @param {boolean} opts.provisional  true if user selected "I'm not sure yet"
 * @returns {string}  primary body copy
 */
export function getScripted1({ userWordsGoal, goalDisplayName, provisional }) {
  // STUB v0 — placeholder strings until 12.3 wires AI-filled canonical text.
  if (provisional) {
    return "You've named where you are. That's enough to start. We'll build a sensible first week from what you've told us and check in after a few sessions — your direction takes shape from there."
  }
  if (userWordsGoal && userWordsGoal.trim().length > 0) {
    return `You've named your direction: ${userWordsGoal.trim()} We've built Week 1 to point that way. The work starts there.`
  }
  if (goalDisplayName) {
    return `You've named your direction: ${goalDisplayName.toLowerCase()}. We've built Week 1 to point that way. The work starts there.`
  }
  return "We've built your first week. The work starts there."
}

/**
 * Your Key sub-line beneath Scripted #1 (Screen 9).
 *
 * @param {object} opts
 * @param {string|null} opts.goalDisplayName
 * @param {boolean} opts.provisional
 * @returns {string}
 */
export function getYourKeyLine({ goalDisplayName, provisional }) {
  if (provisional) return "Your Key: We'll name it after a few sessions."
  if (goalDisplayName) return `Your Key: ${goalDisplayName}`
  return "Your Key: We'll name it after a few sessions."
}

/**
 * Layer 4 goal display names — placeholder v1.0 list per
 * [Spec] Prelude Conversation Flow §2 Screen 7.
 *
 * KB Editor Cycle 8 resolves canonical names; UX/UI Designer syncs in v1.1.
 *
 * Slugs are stable identifiers Program Designer's engine consumes.
 *
 * @type {Array<{id: string, display: string}>}
 */
export const GOAL_OPTIONS_V1 = [
  { id: 'rebuild_after_long_break', display: 'Rebuild after a long break' },
  { id: 'return_to_sport', display: 'Return to sport' },
  { id: 'get_stronger', display: 'Get stronger' },
  { id: 'hybrid_performance', display: 'Hybrid performance' },
  { id: 'recomposition', display: 'Recomposition' },
  { id: 'maintenance_and_recovery', display: 'Maintenance and recovery' },
]

/**
 * Lookup helper for Screen 9 — resolve goal_id → display name.
 *
 * @param {string|null} goalId
 * @returns {string|null}
 */
export function getGoalDisplayName(goalId) {
  if (!goalId) return null
  const match = GOAL_OPTIONS_V1.find(g => g.id === goalId)
  return match ? match.display : null
}
