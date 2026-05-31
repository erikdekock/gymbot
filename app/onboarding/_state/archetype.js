/**
 * Derives `detected_archetype` from collected fields.
 *
 * The archetype starts as a partial signal (Screen 1/2) and finalises after
 * Screen 6. This function runs after every state change; it returns the
 * best signal available at the moment of call.
 *
 * Spec source: [Spec] Prelude Conversation Flow §3 input-completion map.
 *
 * Returns the canonical short archetype code (A1..A8, plus F7 — see TODO
 * below) or null when no signal is strong enough yet. The engine input
 * contract (lib/engine/schema.mjs ARCHETYPES) and KB Layer-6 both key off the
 * short code, so this must emit short codes — never verbose slugs.
 *
 * @param {import('./initial-state').OnboardingState} s
 * @returns {string|null}
 */
export function deriveArchetype(s) {
  // Finalising signals (Screen 6) take precedence
  if (s.archetype_flags.postpartum_months != null) return 'A6'
  if (s.archetype_flags.age != null && s.archetype_flags.age >= 60) return 'A8'
  // TODO: F7 in ARCHETYPES enum pending PD contract-coverage ruling (ticket
  // 3714fef0d1ea817f974ee9f32ed9123d). Emitting the short code 'F7' is
  // contract-correct; until PD adds F7 to lib/engine/schema.mjs ARCHETYPES,
  // an under-18 signup throws a clean ContractError on F7 (bounded, traceable).
  if (s.archetype_flags.age != null && s.archetype_flags.age < 18) return 'F7'

  // Mid-conversation signals
  if (
    s.experience_level === 'reactivator' &&
    (s.archetype_flags.recent_inactivity_months ?? 0) > 6
  ) {
    return 'A1'
  }
  if (s.experience_level === 'starter') return 'A3'
  if (
    (s.experience_level === 'active' || s.experience_level === 'experienced') &&
    s.training_history_cross_modal === true
  ) {
    return 'A5'
  }
  if (s.experience_level === 'active' || s.experience_level === 'experienced') {
    return 'A2'
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
