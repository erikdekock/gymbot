/**
 * Engine input contract — the typed object the converter produces and the
 * engine consumes. Derived from DS-01 Matching Engine §1–§3 and §6.5 sparse
 * defaults.
 *
 * Validation is plain-JS (no zod runtime cost) — the contract has fewer than
 * 20 keys and the check is exhaustive. Schema mismatches throw an explicit
 * ContractError so the converter call-site fails loudly at build time per
 * the 12.3a "no silent fallback" rule.
 */

export const EXPERIENCE_LEVELS = ["starter", "reactivator", "active", "experienced"];
export const L4_GOAL_RE = /^[A-G][0-9]$/;
export const PHASES = ["phase_1", "phase_2", "phase_3"];
export const ARCHETYPES = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];

export class ContractError extends Error {
  constructor(message, path) {
    super(`[engine-input-contract] ${path}: ${message}`);
    this.name = "ContractError";
    this.path = path;
  }
}

function need(cond, msg, path) {
  if (!cond) throw new ContractError(msg, path);
}

function isInt(n, min, max) {
  return Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Validate an engine input object. Throws ContractError on the first
 * failure. Returns the input unchanged on success (callers chain).
 */
export function validateEngineInput(input) {
  need(input && typeof input === "object", "must be an object", "$");
  need(input.user_profile && typeof input.user_profile === "object", "missing user_profile", "$.user_profile");
  need(input.goal && typeof input.goal === "object", "missing goal", "$.goal");

  const up = input.user_profile;
  need(
    EXPERIENCE_LEVELS.includes(up.experience_level),
    `expected one of ${EXPERIENCE_LEVELS.join("|")}, got ${JSON.stringify(up.experience_level)}`,
    "$.user_profile.experience_level"
  );
  need(isInt(up.days_per_week, 2, 6), "must be int 2..6", "$.user_profile.days_per_week");
  need(Array.isArray(up.equipment_available), "must be string[]", "$.user_profile.equipment_available");
  for (const t of up.equipment_available) {
    need(typeof t === "string", "items must be string", "$.user_profile.equipment_available[]");
  }
  need(typeof up.bodyweight_kg === "number" && up.bodyweight_kg > 0, "must be positive number", "$.user_profile.bodyweight_kg");
  need(up.reported_lifts && typeof up.reported_lifts === "object", "missing reported_lifts", "$.user_profile.reported_lifts");
  for (const k of ["squat", "deadlift", "bench", "ohp", "row"]) {
    const v = up.reported_lifts[k];
    need(v === null || (typeof v === "number" && v >= 0), `${k} must be number|null`, `$.user_profile.reported_lifts.${k}`);
  }
  need(Array.isArray(up.contraindications), "must be string[]", "$.user_profile.contraindications");
  need(
    up.detected_archetype === null || ARCHETYPES.includes(up.detected_archetype),
    `expected null or A1..A8, got ${JSON.stringify(up.detected_archetype)}`,
    "$.user_profile.detected_archetype"
  );
  need(
    up.recent_inactivity_months === null || (typeof up.recent_inactivity_months === "number" && up.recent_inactivity_months >= 0),
    "must be non-negative number|null",
    "$.user_profile.recent_inactivity_months"
  );
  need(
    up.age === null || (typeof up.age === "number" && up.age >= 0),
    "must be non-negative number|null",
    "$.user_profile.age"
  );
  need(up.flags && typeof up.flags === "object", "missing flags", "$.user_profile.flags");
  need(typeof up.training_history_cross_modal === "boolean", "must be bool", "$.user_profile.training_history_cross_modal");

  const g = input.goal;
  need(L4_GOAL_RE.test(g.goal_id), `must match ${L4_GOAL_RE} (Layer-4 code)`, "$.goal.goal_id");
  need(typeof g.goal_provisional === "boolean", "must be bool", "$.goal.goal_provisional");
  need(
    g.current_phase === null || PHASES.includes(g.current_phase),
    `expected null|${PHASES.join("|")}, got ${JSON.stringify(g.current_phase)}`,
    "$.goal.current_phase"
  );

  return input;
}
