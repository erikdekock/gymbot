/**
 * Derives `detected_archetype` from collected fields.
 *
 * The archetype starts as a partial signal (Screen 1/2) and finalises after
 * Screen 6. This function runs after every state change; it returns the
 * best signal available at the moment of call.
 *
 * Spec source: [Spec] Prelude Conversation Flow §3 input-completion map.
 *
 * Returns the archetype slug or null when no signal is strong enough yet.
 *
 * @param {import('./initial-state').OnboardingState} s
 * @returns {string|null}
 */
export function deriveArchetype(s) {
  // Finalising signals (Screen 6) take precedence
  if (s.archetype_flags.postpartum_months != null) return 'A6_postpartum'
  if (s.archetype_flags.age != null && s.archetype_flags.age >= 60) return 'A8_senior'
  if (s.archetype_flags.age != null && s.archetype_flags.age < 18) return 'F7_youth'

  // Mid-conversation signals
  if (
    s.experience_level === 'reactivator' &&
    (s.archetype_flags.recent_inactivity_months ?? 0) > 6
  ) {
    return 'A1_reactivator'
  }
  if (s.experience_level === 'starter') return 'A3_starter'
  if (
    (s.experience_level === 'active' || s.experience_level === 'experienced') &&
    s.training_history_cross_modal === true
  ) {
    return 'A5_hybrid'
  }
  if (s.experience_level === 'active' || s.experience_level === 'experienced') {
    return 'A2_returning_athlete'
  }
  return null
}

/**
 * Screen 5 A2 tonal-variant trigger (spec §2 Screen 5):
 *   Screen 1 returned "Yes — I've trained seriously"
 *   AND inactivity period <= 6 months (i.e. the "a few months" branch
 *   OR no inactivity follow-up shown).
 *
 * Returns true when the A2 variant should render; false renders default.
 *
 * @param {import('./initial-state').OnboardingState} s
 */
export function shouldRenderA2Variant(s) {
  if (s.experience_level !== 'active' && s.experience_level !== 'experienced') {
    return false
  }
  const months = s.archetype_flags.recent_inactivity_months
  return months == null || months <= 6
}
