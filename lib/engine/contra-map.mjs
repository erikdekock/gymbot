/**
 * Engine-side derived tables — NOT extractor output, NOT KB fields.
 *
 * Per [Spec] Layer-5 + Layer-8 Record Schemas v1.0, Section 1:
 *   - SKILL_GATES resolves the free-text gate hints encoded only in
 *     Difficulty.raw on exercises #17/#19/#32.
 *   - CONTRA_MAP resolves the missing L8 `contraindications` field via
 *     movement_pattern.family + unilateral. MD ruling 28 May 2026.
 *
 * Both consts are read by the matching engine; they are not part of the
 * Kennisbank JSON and intentionally not produced by scripts/build-kb.mjs.
 * Seeded values are v1.0 — extended in v1.1 against E-cluster fixtures.
 */

export const SKILL_GATES = {
  17: {
    prerequisite: "bodyweight pull-up capacity >= 1",
    default_met: false,
    fallback_exercise_id: 38,
  },
  19: {
    prerequisite: "bodyweight pull-up >= 8 reps clean",
    default_met: false,
    fallback_exercise_id: 54,
  },
  32: {
    prerequisite: "advanced eccentric tolerance flag",
    default_met: false,
  },
};

export const CONTRA_MAP = {
  left_knee_post_surgery: [{ family: "squat" }, { family: "lunge" }],
  knee: [{ family: "squat" }, { family: "lunge" }],
  lower_back: [{ family: "hinge" }],
  shoulder: [{ family: "vertical_push" }, { family: "vertical_pull" }],
  hip: [{ family: "hinge", unilateral_only: true }, { family: "lunge" }],
};
