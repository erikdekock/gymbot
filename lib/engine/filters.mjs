/**
 * Hard filters — DS-01 Matching Engine §3.
 *
 * Each filter returns { pass: boolean, reason?: string }. The slot-fill walker
 * (`pickExerciseForSlot` in index.mjs) chains these in order: equipment →
 * difficulty → contraindication. First failure shorts; the failure reason is
 * threaded through `applied_substitutions` per DS-01 §7.
 */

import { CONTRA_MAP, SKILL_GATES } from "./contra-map.mjs";

const DIFFICULTY_ORDER = { beginner: 1, intermediate: 2, advanced: 3 };

/**
 * Equipment alias expansion. The L8 12.1b/12.2b extractor preserved KB-prose
 * tokens verbatim ("dumbbells", "rack", "barbell_with_plates"); the engine
 * input contract uses high-level tokens. This map expands user tokens onto
 * the granular L8 vocabulary so the §3.2 subset test resolves correctly.
 *
 * `full_gym` is a wildcard sentinel — when present, equipmentFilter treats
 * any non-bodyweight-only exercise's required_any_of as satisfied. The
 * sentinel exists for fixture brevity; the converter does NOT emit it.
 */
const EQUIPMENT_ALIASES = {
  barbell: ["barbell", "barbell_with_plates", "or_barbell", "or_barbell_open_space", "straight_bar"],
  plates: ["plates", "plate", "plates_optional_rack", "plates_preferably_bumper", "competition_style_for_full_rom"],
  squat_rack: ["squat_rack", "rack"],
  bench: ["bench", "incline_bench", "no_bench", "bench_at_squat_depth"],
  dumbbell: ["dumbbell", "dumbbells", "heavy_dumbbells", "optional_dumbbell_on_hip", "optional_dumbbells_barbell"],
  kettlebell: ["kettlebell", "kettlebells"],
  cable: ["cable_machine", "cable_row_machine_with_foot_platform", "or_cables", "or_cable_+_rope", "cable_machine_with_lat_pulldown_attachment_typically_wide_bar_sometimes_v_handle"],
  rope_attachment: ["rope_attachment", "rope"],
  pullup_bar: ["pull_up_bar", "bar_in_rack_at_hip_to_chest_height", "fixed_grip_variants", "neutral_grip_bar"],
  hip_pad: ["hip_pad"],
  trap_bar: ["trap_bar"],
  ez_bar: ["ez_bar"],
  rings: ["gymnastic_rings", "or_trx"],
  leg_press: ["horizontal_leg_press_machine", "45_leg_press"],
  leg_extension: ["leg_extension_machine"],
  leg_curl: ["seated_leg_curl_machine_with_hip_pad_and_ankle_roller", "lying_leg_curl_machine"],
  hack_squat: ["hack_squat_machine"],
  chest_press_machine: ["chest_press_machine_plate_loaded", "selectorized_converging", "selectorized_converging_arm"],
  shoulder_press_machine: ["shoulder_press_machine_plate_loaded"],
  parallel_bars: ["parallel_bars", "dip_station_optional_dip_belt_for_loading", "dip_belt_+_plates"],
  band: ["band"],
  ab_wheel: ["ab_wheel"],
  weighted_vest: ["weighted_vest", "bodyweight_optional_weight_vest"],
  box: ["box", "plyo_box"],
  landmine: ["barbell_+_landmine_attachment_+_v_handle"],
  t_bar_row: ["t_bar_row_machine"],
  v_handle: ["v_handle", "v_bar", "or_specialty_trap_handles"],
};

function expandEquipment(tokens) {
  const expanded = new Set();
  for (const t of tokens) {
    expanded.add(t);
    const aliases = EQUIPMENT_ALIASES[t];
    if (aliases) for (const a of aliases) expanded.add(a);
  }
  return expanded;
}

const EXPERIENCE_TO_DIFFICULTY_CEIL = {
  starter: "beginner",
  reactivator: "intermediate",
  active: "intermediate",
  experienced: "advanced",
};

/**
 * DS-01 §3.2: `equipment.required_any_of` is an array of OR-groups; user
 * must satisfy ≥1 token per group. Bodyweight-only exercises always pass.
 */
export function equipmentFilter(exercise, equipmentAvailable) {
  if (exercise.equipment.bodyweight_only) return { pass: true };
  if (equipmentAvailable.includes("full_gym")) return { pass: true };
  const have = expandEquipment(equipmentAvailable);
  for (const orGroup of exercise.equipment.required_any_of) {
    const satisfied = orGroup.some((tok) => have.has(tok));
    if (!satisfied) {
      return {
        pass: false,
        reason: `equipment: missing all of [${orGroup.join("|")}]`,
      };
    }
  }
  return { pass: true };
}

/**
 * DS-01 §3.4: experience_level vs exercise.difficulty.floor. Beginner accepts
 * beginner-floor only; intermediate accepts beginner+intermediate; advanced
 * accepts all. The L5 spec uses `floor` as the acceptance threshold —
 * a beginner-floor exercise is accessible to all experience levels.
 */
export function difficultyFilter(exercise, experienceLevel) {
  const userCeil = EXPERIENCE_TO_DIFFICULTY_CEIL[experienceLevel];
  const userCeilN = DIFFICULTY_ORDER[userCeil];
  const exerciseFloorN = DIFFICULTY_ORDER[exercise.difficulty.floor];
  if (exerciseFloorN > userCeilN) {
    return {
      pass: false,
      reason: `difficulty: exercise floor=${exercise.difficulty.floor} > user ceil=${userCeil}`,
    };
  }
  return { pass: true };
}

/**
 * DS-01 §3.4 skill gates: Pull-up #17, Weighted Pull-up #19, Nordic #32.
 * Default `met=false` per CONTRA_MAP. The engine reads no user flag for
 * these in 12.3a — they always default to unmet. Returns no-op for ids
 * not in SKILL_GATES.
 */
export function skillGateFilter(exercise) {
  const gate = SKILL_GATES[exercise.id];
  if (!gate) return { pass: true };
  if (gate.default_met) return { pass: true };
  return {
    pass: false,
    reason: `skill_gate: ${gate.prerequisite} (default unmet)`,
    fallback_exercise_id: gate.fallback_exercise_id ?? null,
  };
}

/**
 * DS-01 §3.5 contraindication. For each user contra flag, look up
 * CONTRA_MAP and drop exercises whose movement_pattern.family matches a
 * biased-away family. `unilateral_only` biases only unilateral variants.
 */
export function contraindicationFilter(exercise, contraindications) {
  for (const flag of contraindications) {
    const rules = CONTRA_MAP[flag];
    if (!rules) continue;
    for (const rule of rules) {
      if (rule.family !== exercise.movement_pattern.family) continue;
      if (rule.unilateral_only && !exercise.unilateral) continue;
      return {
        pass: false,
        reason: `contraindication: ${flag} biases ${rule.family}${rule.unilateral_only ? " (unilateral-only)" : ""}`,
      };
    }
  }
  return { pass: true };
}

/**
 * Run all hard filters in order and return the first failure (or pass).
 * The order matters for diagnostic — equipment is the cheapest signal,
 * difficulty next, contra is most semantically meaningful.
 */
export function runHardFilters(exercise, userProfile) {
  const r1 = equipmentFilter(exercise, userProfile.equipment_available);
  if (!r1.pass) return { ...r1, failure_type: "equipment" };
  const r2 = difficultyFilter(exercise, userProfile.experience_level);
  if (!r2.pass) return { ...r2, failure_type: "difficulty" };
  const r3 = skillGateFilter(exercise);
  if (!r3.pass) return { ...r3, failure_type: "skill_gate" };
  const r4 = contraindicationFilter(exercise, userProfile.contraindications);
  if (!r4.pass) return { ...r4, failure_type: "contraindication" };
  return { pass: true };
}
