/**
 * Per-screen validators. Each returns { ok: boolean, error: string|null }.
 * Error copy is taken verbatim from the spec §7 "Full copy spec".
 *
 * @typedef {{ok: boolean, error: string|null}} Result
 */

const OK = { ok: true, error: null }

/** Screen 1: single-select required; if "reactivator", follow-up required. */
export function validateHistory(s) {
  if (s.experience_level == null) {
    return { ok: false, error: "Pick one — we'll use this to calibrate your starting point." }
  }
  if (s.experience_level === 'reactivator' && s.archetype_flags.recent_inactivity_months == null) {
    return { ok: false, error: "Pick one — we'll use this to calibrate your starting point." }
  }
  return OK
}

/** Screen 2: optional (skip available); no validation. */
export function validateCrossModal() {
  return OK
}

/** Screen 3: required (days_per_week). Auto-selects 3 if user taps "Not sure?". */
export function validateSchedule(s) {
  if (s.days_per_week == null) {
    return { ok: false, error: 'Pick a number to continue.' }
  }
  return OK
}

/** Screen 4: minimum one selection required. */
export function validateEquipment(s) {
  if (!s.equipment_available || s.equipment_available.length === 0) {
    return { ok: false, error: 'Select at least one — even bodyweight only works.' }
  }
  return OK
}

/**
 * Screen 5: all fields nullable (skip-friendly). Soft-warning is rendered
 * inline by the screen itself, not surfaced by this validator.
 */
export function validateMetrics() {
  return OK
}

/** Screen 6: all fields nullable (skip-friendly). */
export function validateContext() {
  return OK
}

/**
 * Screen 7: goal_id OR goal_provisional=true required to proceed.
 */
export function validateGoal(s) {
  if (s.goal_id != null) return OK
  if (s.goal_provisional === true) return OK
  return { ok: false, error: 'Pick one to continue.' }
}

/** Screen 7b: skip-friendly. */
export function validateOwnWords() {
  return OK
}

/**
 * Soft validation helper for Screen 5: implausibly high lift values.
 *
 * @param {string} lift  one of 'squat'|'deadlift'|'bench'|'ohp'|'row'
 * @param {number|null} kg
 * @returns {string|null}  warning text or null
 */
export function softWarnLift(lift, kg) {
  if (kg == null) return null
  if (lift === 'squat' && kg > 300) return 'That seems high — is this your 1RM?'
  if (lift === 'deadlift' && kg > 350) return 'That seems high — is this your 1RM?'
  if (lift === 'bench' && kg > 250) return 'That seems high — is this your 1RM?'
  if (lift === 'ohp' && kg > 150) return 'That seems high — is this your 1RM?'
  if (lift === 'row' && kg > 200) return 'That seems high — is this your 1RM?'
  return null
}
