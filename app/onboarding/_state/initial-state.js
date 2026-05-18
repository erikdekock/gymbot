/**
 * Initial Onboarding state.
 *
 * Shape MUST match the Program Designer input-completion contract for
 * Moment 1 verbatim — 12.3 (Prelude round-trip + user_program schema) reads
 * this state and converts it to the engine payload. Any field-name drift
 * here breaks the converter.
 *
 * Source: [Spec] Prelude Conversation Flow §3 input-completion map.
 * Nullable defaults per Program Designer sparse-profile rules.
 *
 * @typedef {('starter'|'reactivator'|'active'|'experienced'|null)} ExperienceLevel
 *
 * @typedef {object} ArchetypeFlags
 * @property {number|null} recent_inactivity_months  null | ~9 | ~18 | ~30
 * @property {number|null} age
 * @property {number|null} postpartum_months
 * @property {number|null} pregnancy_gestational_week
 *
 * @typedef {object} ReportedLifts
 * @property {number|null} squat
 * @property {number|null} deadlift
 * @property {number|null} bench
 * @property {number|null} ohp
 * @property {number|null} row
 *
 * @typedef {object} OnboardingState
 * @property {ExperienceLevel} experience_level
 * @property {ArchetypeFlags} archetype_flags
 * @property {boolean|null} training_history_cross_modal
 * @property {(2|3|4|5|6|null)} days_per_week
 * @property {string[]} equipment_available
 * @property {number|null} bodyweight_kg
 * @property {ReportedLifts} reported_lifts
 * @property {string[]} contraindications
 * @property {string|null} goal_id
 * @property {boolean} goal_provisional
 * @property {('user_deferred'|null)} provisional_goal_source
 * @property {string|null} user_words_goal
 * @property {string|null} detected_archetype  // derived from other fields
 */

/** @type {OnboardingState} */
export const initialOnboardingState = {
  experience_level: null,
  archetype_flags: {
    recent_inactivity_months: null,
    age: null,
    postpartum_months: null,
    pregnancy_gestational_week: null,
  },
  training_history_cross_modal: null,
  days_per_week: null,
  equipment_available: [],
  bodyweight_kg: null,
  reported_lifts: {
    squat: null,
    deadlift: null,
    bench: null,
    ohp: null,
    row: null,
  },
  contraindications: [],
  goal_id: null,
  goal_provisional: false,
  provisional_goal_source: null,
  user_words_goal: null,
  detected_archetype: null,
}
