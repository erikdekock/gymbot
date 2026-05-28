/**
 * Prelude state → engine input contract converter.
 *
 * Reads the OnboardingState shape from `app/onboarding/_state/initial-state.js`
 * and produces the engine input object described in `lib/engine/schema.mjs`.
 *
 * Per DS-01 §6.5 sparse defaults are applied centrally here (e.g. null
 * bodyweight → 75kg + `unknown_bodyweight` flag). Validation runs after
 * defaults; mismatches throw ContractError — no silent fallback.
 *
 * The Prelude `goal_id` field carries either a v1 Prelude option id
 * (per `lib/onboarding-copy.js` GOAL_OPTIONS_V1) or, for fixtures and
 * direct API callers, a Layer-4 code (`A1`, `C2`, …). Both are handled.
 */

import { L4_GOAL_RE, validateEngineInput } from "../engine/schema.mjs";

const PRELUDE_GOAL_TO_L4 = {
  rebuild_after_long_break: "E7",
  return_to_sport: "C4",
  get_stronger: "B1",
  hybrid_performance: "C4",
  recomposition: "A3",
  maintenance_and_recovery: "D1",
};

const DEFAULT_BODYWEIGHT_KG = 75;
const DEFAULT_DAYS_PER_WEEK = 3;
const DEFAULT_EXPERIENCE = "starter";

/**
 * Per DS-01 §3.3 + §6 archetype inference. Conservative — only fires when
 * the signal is unambiguous; otherwise leaves null and lets the engine
 * read goal-driven defaults.
 */
export function inferArchetype(prelude) {
  if (prelude.detected_archetype) return prelude.detected_archetype;
  const inactivity = prelude.archetype_flags?.recent_inactivity_months ?? null;
  const crossModal = prelude.training_history_cross_modal === true;
  if (crossModal && inactivity !== null && inactivity >= 6) return "A5";
  if (inactivity !== null && inactivity >= 18) return "A1";
  if (inactivity !== null && inactivity >= 6) return "A2";
  return null;
}

function resolveGoalId(prelude) {
  const raw = prelude.goal_id;
  if (!raw) return null;
  if (L4_GOAL_RE.test(raw)) return raw;
  return PRELUDE_GOAL_TO_L4[raw] ?? null;
}

/**
 * Comeback persona signal — DS-01 §3.3 / §3.6. Reactivator / Returning
 * Athlete / Hybrid-in-comeback all require an inactivity gap ≥ ~6 months.
 * Resolved here so the engine can pick the right phase block without
 * re-reading the raw Prelude flags.
 */
function inferComebackPersona(prelude, archetype) {
  const inactivity = prelude.archetype_flags?.recent_inactivity_months ?? 0;
  if (inactivity >= 6) return true;
  if (archetype === "A1" && inactivity >= 3) return true;
  return false;
}

/**
 * Convert a Prelude OnboardingState into a validated engine input object.
 *
 * Throws ContractError if defaults still leave a required field invalid,
 * or if `goal_id` cannot be resolved to a Layer-4 code.
 */
export function convertPreludeToEngineInput(prelude) {
  if (!prelude || typeof prelude !== "object") {
    throw new TypeError("convertPreludeToEngineInput: prelude must be an object");
  }
  const flags = {};

  // Bodyweight — sparse default per DS-01 §6.5.
  let bodyweight = prelude.bodyweight_kg;
  if (bodyweight === null || bodyweight === undefined) {
    bodyweight = DEFAULT_BODYWEIGHT_KG;
    flags.unknown_bodyweight = true;
  }

  // Days per week — sparse default per §6.5.
  let days = prelude.days_per_week;
  if (days === null || days === undefined) {
    days = DEFAULT_DAYS_PER_WEEK;
    flags.days_per_week_defaulted = true;
  }

  // Experience — sparse default per §6.5 (`starter`).
  let experience = prelude.experience_level;
  if (!experience) {
    experience = DEFAULT_EXPERIENCE;
    flags.experience_defaulted = true;
  }

  const equipment = Array.isArray(prelude.equipment_available)
    ? prelude.equipment_available.slice()
    : [];
  if (equipment.length === 0) flags.bodyweight_only = true;

  const contras = Array.isArray(prelude.contraindications)
    ? prelude.contraindications.slice()
    : [];

  const archetype = inferArchetype(prelude);
  const goalId = resolveGoalId(prelude);
  if (!goalId) {
    throw new Error(
      `[converter] cannot resolve goal_id from prelude: ${JSON.stringify(prelude.goal_id)}`
    );
  }
  const comebackPersona = inferComebackPersona(prelude, archetype);
  flags.comeback_persona = comebackPersona;
  // Engine resolves `current_phase` from the comeback_persona flag + the
  // active L5 entry's phase taxonomy (see resolvePhase in engine/index.mjs).
  const phase = null;

  const reportedLifts = {
    squat: prelude.reported_lifts?.squat ?? null,
    deadlift: prelude.reported_lifts?.deadlift ?? null,
    bench: prelude.reported_lifts?.bench ?? null,
    ohp: prelude.reported_lifts?.ohp ?? null,
    row: prelude.reported_lifts?.row ?? null,
  };

  const input = {
    user_profile: {
      experience_level: experience,
      days_per_week: days,
      equipment_available: equipment,
      bodyweight_kg: bodyweight,
      reported_lifts: reportedLifts,
      contraindications: contras,
      detected_archetype: archetype,
      recent_inactivity_months: prelude.archetype_flags?.recent_inactivity_months ?? null,
      age: prelude.archetype_flags?.age ?? null,
      training_history_cross_modal: prelude.training_history_cross_modal === true,
      flags,
    },
    goal: {
      goal_id: goalId,
      goal_provisional: prelude.goal_provisional === true,
      current_phase: phase,
    },
  };

  return validateEngineInput(input);
}

export { PRELUDE_GOAL_TO_L4 };
