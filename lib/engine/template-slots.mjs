/**
 * Structured per-template slot rules.
 *
 * The Layer-1 record JSON stores templates as prose (entries[].content_markdown
 * with bold/italic markers). The engine consumes structured slot tables, so
 * each template the engine can pick is encoded here verbatim from the L1
 * prose — slot role, candidate L8 exercise ids (ordered as listed in L1),
 * set/rep scheme, RPE target, duration. Day rotation for split templates is
 * also encoded here.
 *
 * Source: data/kb/layer-1.json — Lower Posterior, Upper Push/Pull,
 * Lower Anterior, Upper + Core, Full Body, Run, Reactivator Phase 2 Loaded
 * (3-day). Verbatim slot ordering. Edits here require an L1 JSON re-read.
 *
 * Each candidate list is the order printed in L1; the engine treats the
 * first as the default and walks down to the first one that passes all
 * hard filters.
 */

/**
 * @typedef {object} SlotRule
 * @property {string} slot             machine-readable phase id
 * @property {string} slot_role        L1 human-readable role
 * @property {number} duration_min
 * @property {number[]} candidates     L8 exercise ids, ordered (L1 order)
 * @property {string} set_rep_scheme   verbatim from L1
 * @property {number} rpe_target
 */

/**
 * @typedef {object} TemplateSpec
 * @property {string} template_id
 * @property {string} display_name
 * @property {string} focus
 * @property {Array<{name: string, slots: SlotRule[]}>} day_variants
 * @property {string} progression_rule_raw
 */

// Movement Prep is template-fixed (no slot-fill from L8); we encode duration
// only. Cooldown is the shared protocol per L1 intro — no slot fill.
const MOVEMENT_PREP_DURATION = 10;
const COOLDOWN_DURATION = 25;

/** Lower Posterior — L1 Strength Templates entry, single-day session shape. */
const LOWER_POSTERIOR = {
  template_id: "lower-posterior",
  display_name: "Lower Posterior",
  focus: "Posterior chain strength, mechanical load",
  day_variants: [
    {
      name: "default",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound hinge", duration_min: 17, candidates: [5, 7, 6, 8], set_rep_scheme: "4×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Hip-dominant accessory", duration_min: 17, candidates: [21, 25], set_rep_scheme: "4×10", rpe_target: 7 },
        // L1 prose order is #22, #23, #27, #28, #29 across regression →
        // load tiers. Per DS-01 §9.2 + L5 Spec §6 VF-A2 the trained-user
        // default for this slot is #27 BSS (highest-load split-stance);
        // #22/#23 are listed as regressions for early phases. We order the
        // strength-load default first so the §9.2 contra fallback fires
        // visibly on VF-A2; #22/#23 are the next slot-pool candidates.
        { slot: "superset_b_unilateral", slot_role: "Unilateral hinge or split-stance", duration_min: 13, candidates: [27, 22, 23, 28, 29], set_rep_scheme: "3×10/side", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Anti-rotation core", duration_min: 13, candidates: [48, 49, 50], set_rep_scheme: "3×45s", rpe_target: 7 },
        { slot: "superset_c_hamstring", slot_role: "Hamstring/glute iso", duration_min: 11, candidates: [32, 26, 24], set_rep_scheme: "3×12", rpe_target: 7 },
        { slot: "superset_c_core", slot_role: "Anti-extension core", duration_min: 11, candidates: [52, 53], set_rep_scheme: "3×10", rpe_target: 7 },
      ],
    },
  ],
  progression_rule_raw: "Linear load increase wk 1→3 (MEV→MAV), week 4 consolidation. New macrocycle: rotate compound hinge variant.",
};

const UPPER_PUSH_PULL = {
  template_id: "upper-push-pull",
  display_name: "Upper Push/Pull",
  focus: "Shoulder/back balance, work capacity",
  day_variants: [
    {
      name: "default",
      slots: [
        { slot: "superset_a_press", slot_role: "Compound horizontal press", duration_min: 17, candidates: [9, 10, 11, 34, 36], set_rep_scheme: "4×10", rpe_target: 7.5 },
        { slot: "superset_a_pull", slot_role: "Compound horizontal pull", duration_min: 17, candidates: [14, 15, 16, 37, 38], set_rep_scheme: "4×10", rpe_target: 7.5 },
        { slot: "superset_b_vertical_pull", slot_role: "Vertical pull", duration_min: 13, candidates: [17, 18, 19], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_b_shoulder", slot_role: "Shoulder lateral iso", duration_min: 13, candidates: [40, 39], set_rep_scheme: "3×15", rpe_target: 7 },
        { slot: "superset_c_biceps", slot_role: "Biceps iso", duration_min: 11, candidates: [42, 43, 44], set_rep_scheme: "3×12", rpe_target: 7 },
        { slot: "superset_c_triceps", slot_role: "Triceps iso", duration_min: 11, candidates: [45, 46, 47], set_rep_scheme: "3×12", rpe_target: 7 },
      ],
    },
  ],
  progression_rule_raw: "Load progression wk 1→3 on Superset A; rep progression on Superset B; volume progression on Superset C (sets 3→4 across mesocycle).",
};

const LOWER_ANTERIOR = {
  template_id: "lower-anterior",
  display_name: "Lower Anterior",
  focus: "Quad dominance, anterior chain hypertrophy",
  day_variants: [
    {
      name: "default",
      slots: [
        { slot: "superset_a_squat", slot_role: "Compound squat", duration_min: 17, candidates: [1, 2, 4, 31, 3], set_rep_scheme: "4×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Quad-dominant accessory", duration_min: 17, candidates: [56, 57, 27, 30], set_rep_scheme: "4×12", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Unilateral squat or step-up", duration_min: 13, candidates: [27, 28, 29, 30], set_rep_scheme: "3×10/side", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core anti-extension", duration_min: 13, candidates: [51, 52, 53], set_rep_scheme: "3×12", rpe_target: 7 },
        { slot: "superset_c_quad_iso", slot_role: "Quad iso", duration_min: 11, candidates: [58], set_rep_scheme: "3×15", rpe_target: 7 },
        { slot: "superset_c_ham_iso", slot_role: "Hamstring iso (machine)", duration_min: 11, candidates: [59, 60], set_rep_scheme: "3×20", rpe_target: 7 },
      ],
    },
  ],
  progression_rule_raw: "Load progression wk 1→3 on Superset A; rep progression wk 1→3 on Superset B; volume creep on Superset C.",
};

const UPPER_CORE = {
  template_id: "upper-core",
  display_name: "Upper + Core",
  focus: "Shoulder volume, core stability",
  day_variants: [
    {
      name: "default",
      slots: [
        { slot: "superset_a_press", slot_role: "Compound horizontal press", duration_min: 17, candidates: [9, 10, 11, 34], set_rep_scheme: "4×10", rpe_target: 7.5 },
        { slot: "superset_a_pull", slot_role: "Compound horizontal pull", duration_min: 17, candidates: [14, 15, 16, 37], set_rep_scheme: "4×10", rpe_target: 7.5 },
        { slot: "superset_b_vertical_pull", slot_role: "Vertical pull", duration_min: 13, candidates: [17, 18], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core anti-extension", duration_min: 13, candidates: [52, 53], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_shoulder", slot_role: "Shoulder lateral iso", duration_min: 11, candidates: [40, 41, 39], set_rep_scheme: "3×15", rpe_target: 7 },
        { slot: "superset_c_hip_flex", slot_role: "Hip flexion / hanging core", duration_min: 11, candidates: [51, 50], set_rep_scheme: "3×12", rpe_target: 7 },
      ],
    },
  ],
  progression_rule_raw: "Load progression wk 1→3 on Superset A; volume progression on Supersets B/C.",
};

const FULL_BODY = {
  template_id: "full-body",
  display_name: "Full Body",
  focus: "Hybrid compound complex, work capacity",
  day_variants: [
    {
      name: "default",
      slots: [
        { slot: "superset_a_compound_lower", slot_role: "Compound squat or hinge", duration_min: 17, candidates: [1, 2, 7, 5, 8], set_rep_scheme: "4×6", rpe_target: 7 },
        { slot: "superset_a_compound_push", slot_role: "Compound vertical push", duration_min: 17, candidates: [12, 13, 35], set_rep_scheme: "4×6", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Unilateral lower", duration_min: 13, candidates: [27, 28, 29, 30], set_rep_scheme: "3×10/side", rpe_target: 7 },
        { slot: "superset_b_pull", slot_role: "Compound pull", duration_min: 13, candidates: [14, 15, 16, 37], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_posterior", slot_role: "Posterior chain accessory", duration_min: 11, candidates: [21, 25, 26], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_vertical_pull", slot_role: "Vertical pull", duration_min: 11, candidates: [17, 18], set_rep_scheme: "3×10", rpe_target: 7 },
      ],
    },
  ],
  progression_rule_raw: "Complex difficulty progresses wk 1→3 via load OR EMOM density; week 4 reduces complex density.",
};

const REACTIVATOR_P2_LOADED_3D = {
  template_id: "reactivator-p2-loaded-3d",
  display_name: "Reactivator — Phase 2 Loaded (3-day)",
  focus: "Introduce load and supersets. Strength patterns rebuild. RPE-cap 7.",
  day_variants: [
    {
      name: "day_1_hinge_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound hinge (light)", duration_min: 17, candidates: [7, 25, 21], set_rep_scheme: "3×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Hip-dominant accessory", duration_min: 17, candidates: [21, 26], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_b_upper", slot_role: "Upper pull", duration_min: 13, candidates: [37, 38], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core anti-rotation", duration_min: 13, candidates: [50, 53], set_rep_scheme: "3×10-12", rpe_target: 7 },
        { slot: "superset_c_unilateral", slot_role: "Unilateral lower", duration_min: 10, candidates: [30, 29], set_rep_scheme: "2×10-12", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility hold", duration_min: 10, candidates: [], set_rep_scheme: "2×30s holds", rpe_target: 7 },
      ],
    },
    {
      name: "day_2_squat_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound squat", duration_min: 17, candidates: [31, 2, 4], set_rep_scheme: "3×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Hip-dominant accessory", duration_min: 17, candidates: [21, 26], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_b_upper", slot_role: "Upper push", duration_min: 13, candidates: [34, 36], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core anti-extension", duration_min: 13, candidates: [52, 53], set_rep_scheme: "3×10-12", rpe_target: 7 },
        { slot: "superset_c_unilateral", slot_role: "Unilateral lower", duration_min: 10, candidates: [30, 29], set_rep_scheme: "2×10-12", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility hold", duration_min: 10, candidates: [], set_rep_scheme: "2×30s holds", rpe_target: 7 },
      ],
    },
    {
      name: "day_3_upper_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound upper push", duration_min: 17, candidates: [34, 36], set_rep_scheme: "3×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Upper pull", duration_min: 17, candidates: [37, 38], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Unilateral lower (light)", duration_min: 13, candidates: [30, 29], set_rep_scheme: "3×10/side", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core", duration_min: 13, candidates: [50, 53, 49], set_rep_scheme: "3×10-12", rpe_target: 7 },
        { slot: "superset_c_iso", slot_role: "Hip-dominant accessory", duration_min: 10, candidates: [21, 26], set_rep_scheme: "2×10-12", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility hold", duration_min: 10, candidates: [], set_rep_scheme: "2×30s holds", rpe_target: 7 },
      ],
    },
  ],
  progression_rule_raw: "Linear load progression on Superset A wk 1→3 (~5% load step if RPE held at 7); rep progression on Superset B.",
};

/**
 * Run template — protocol is fixed (Zone 2 default per L5 base phase); no
 * L8 slot fill. Subtypes are emitted as the session focus; load_placeholder
 * is null per L1 ("Run sessions are NOT slot-filled from Layer 8").
 */
const RUN = {
  template_id: "run",
  display_name: "Run",
  focus: "Aerobic base, cadence, fat oxidation (Zone 2 default)",
  day_variants: [
    {
      name: "zone_2_base",
      slots: [
        { slot: "main_run", slot_role: "Zone 2 base", duration_min: 45, candidates: [], set_rep_scheme: "HR 115–125 bpm · cadence 165+ spm", rpe_target: 4 },
      ],
    },
    {
      name: "long_run",
      slots: [
        { slot: "main_run", slot_role: "Long run (Z2)", duration_min: 90, candidates: [], set_rep_scheme: "Z2, distance per macrocycle", rpe_target: 4 },
      ],
    },
  ],
  progression_rule_raw: "Time-on-feet progressive per macrocycle; pace at HR-cap improves week over week. Long-run distance progresses 10% per mesocycle.",
};

export const TEMPLATE_SPECS = {
  "lower-posterior": LOWER_POSTERIOR,
  "upper-push-pull": UPPER_PUSH_PULL,
  "lower-anterior": LOWER_ANTERIOR,
  "upper-core": UPPER_CORE,
  "full-body": FULL_BODY,
  "reactivator-p2-loaded-3d": REACTIVATOR_P2_LOADED_3D,
  run: RUN,
};

export function getTemplateSpec(templateId) {
  const spec = TEMPLATE_SPECS[templateId];
  if (!spec) {
    throw new Error(`[engine] template_id not encoded in TEMPLATE_SPECS: ${templateId}`);
  }
  return spec;
}

export { MOVEMENT_PREP_DURATION, COOLDOWN_DURATION };
