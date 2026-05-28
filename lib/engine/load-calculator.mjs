/**
 * Deterministic load placeholder calculator.
 *
 * Maps an exercise + user profile to a load placeholder. Exact numbers come
 * from reported_lifts where available (1RM * RPE multiplier); bodyweight
 * lifts return "%BW"; lifts with no reported max return null and the AI
 * Personalization Layer fills in week 1 starting load.
 *
 * Multipliers per DS-01 §9 trace ("conservative load multiplier 0.50 / 0.65
 * / 0.70 per archetype") and §6.3 (provisional goal → 0.60 default cap).
 */

const ARCHETYPE_MULTIPLIER = {
  A1: 0.5,
  A2: 0.65,
  A5: 0.7,
};

const EXPERIENCE_MULTIPLIER = {
  starter: 0.5,
  reactivator: 0.55,
  active: 0.7,
  experienced: 0.75,
};

/** Maps L8 movement_pattern.family + name onto a reported_lifts key. */
function liftKeyForExercise(exercise) {
  const fam = exercise.movement_pattern.family;
  const name = exercise.name.toLowerCase();
  if (fam === "squat" && !exercise.unilateral) return "squat";
  if (fam === "hinge" && /deadlift/.test(name)) return "deadlift";
  if (fam === "hinge" && /(rdl|romanian)/i.test(name)) return "deadlift";
  if (fam === "horizontal_push" && /(bench|press)/.test(name)) return "bench";
  if (fam === "vertical_push" && /(overhead|ohp|shoulder)/.test(name)) return "ohp";
  if (fam === "horizontal_pull" && /row/.test(name)) return "row";
  return null;
}

/**
 * Returns a load placeholder string per DS-01 §7 candidate_week_structure:
 * "62.5 kg" | "%BW" | null.
 *
 * Algorithm:
 *  - bodyweight_only exercise → "%BW"
 *  - exercise maps to a reported lift the user provided →
 *      round(reported_max * baseMultiplier * archetypeOrExperience, 2.5) + " kg"
 *  - otherwise → null (engine has no basis; AI layer sets in week 1)
 */
export function loadPlaceholderFor(exercise, userProfile, archetypeMultiplierKey) {
  if (exercise.equipment.bodyweight_only) return "%BW";
  const liftKey = liftKeyForExercise(exercise);
  if (!liftKey) return null;
  const reported = userProfile.reported_lifts[liftKey];
  if (!reported || reported <= 0) return null;
  const archMult = ARCHETYPE_MULTIPLIER[archetypeMultiplierKey] ?? null;
  const expMult = EXPERIENCE_MULTIPLIER[userProfile.experience_level] ?? 0.6;
  const mult = archMult ?? expMult;
  const raw = reported * mult;
  const rounded = Math.round(raw / 2.5) * 2.5;
  return `${rounded} kg`;
}
