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
 * 12.2 STUB: returns a single neutral, profile-independent string. The
 * real Scripted #1 is AI-synthesised in 12.3 (Program Designer Cycle 3
 * reopen specs the prompt). Per the revised Moment 1 spec (20 May 2026,
 * "Removed copy (do not use)" section), this stub must NOT:
 *   - echo `user_words_goal` verbatim back to the user
 *   - reproduce the "Your Key: [goal display name]" verbatim pattern
 *   - use the "We'll name it after a few sessions" placeholder
 *
 * All those anti-patterns are intentionally absent here. The same neutral
 * string serves every path (named goal, provisional, sparse) until 12.3
 * wires the synthesis call. Parameters are retained in the signature so
 * 12.3 can drop in the real implementation without touching call sites.
 *
 * @param {object} _opts  (unused in stub; retained for 12.3 signature parity)
 * @param {string|null} _opts.userWordsGoal
 * @param {string|null} _opts.goalDisplayName
 * @param {boolean} _opts.provisional
 * @returns {string}  primary body copy
 */
export function getScripted1(_opts) {
  // STUB v1 (20 May 2026) — neutral, profile-independent. 12.3 replaces
  // with AI-synthesised Scripted #1 per Signup AI Prompt spec.
  return "We've built your first week. The work starts there."
}

/**
 * Your Key sub-line beneath Scripted #1 (Screen 9).
 *
 * 12.2 STUB: returns null — no Key line renders. Per the revised Moment 1
 * spec, Your Key is ALWAYS AI-synthesised from the full profile in 12.3,
 * never echoed from `user_words_goal` and never a placeholder. Until the
 * synthesis call exists, the stub renders no Key rather than reproducing
 * a rejected pattern. Screen 9 treats a null return as "render nothing".
 *
 * @param {object} _opts  (unused in stub; retained for 12.3 signature parity)
 * @param {string|null} _opts.goalDisplayName
 * @param {boolean} _opts.provisional
 * @returns {string|null}
 */
export function getYourKeyLine(_opts) {
  // STUB v1 (20 May 2026) — no Key line until 12.3 synthesis. Returning
  // null avoids reproducing the rejected "Your Key: X" / "name it after a
  // few sessions" patterns.
  return null
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
