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
 * Lower Anterior, Upper + Core, Full Body, Run, Mobility, Reactivator
 * Phase 1 Foundation (2-day), Reactivator Phase 2 Loaded (3-day),
 * Returning Athlete Phase 1 Re-entry (3-day), Hybrid-in-comeback Phase 1
 * Foundation (3-day). Verbatim slot ordering. Edits here require an L1
 * JSON re-read.
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
 * Reactivator Phase 1 Foundation (2-day) — L1 Comeback Templates.
 * 2 days/week strict, ≥48h between sessions. Movement re-acquaintance, low
 * load, NO supersets in Phase 1 (full ~90s rest between movements). RPE-cap 7.
 * Per L1: hinge = Cluster 2 #26 OR #25 (no barbell hinge in P1); squat = #31
 * default; push = #36 incline-progressed; pull = #38 high-angle-progressed.
 */
const REACTIVATOR_P1_FOUNDATION_2D = {
  template_id: "reactivator-p1-foundation-2d",
  display_name: "Reactivator — Phase 1 Foundation (2-day)",
  focus: "Movement re-acquaintance, low load, no soreness peaks. RPE-cap 7.",
  day_variants: [
    {
      name: "day_1_lower_emphasis",
      slots: [
        { slot: "block_a_hinge", slot_role: "Hinge regression", duration_min: 15, candidates: [26, 25], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_a_squat", slot_role: "Squat regression", duration_min: 15, candidates: [31], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_a_core", slot_role: "Core anti-extension", duration_min: 15, candidates: [53, 48], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_b_push", slot_role: "Upper push regression", duration_min: 15, candidates: [36], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_b_pull", slot_role: "Upper pull regression", duration_min: 15, candidates: [38], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_b_core", slot_role: "Core anti-rotation", duration_min: 15, candidates: [50, 49], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
      ],
    },
    {
      name: "day_2_lower_emphasis",
      slots: [
        { slot: "block_a_hinge", slot_role: "Hinge regression", duration_min: 15, candidates: [26, 25], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_a_squat", slot_role: "Squat regression", duration_min: 15, candidates: [31], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_a_core", slot_role: "Core anti-extension", duration_min: 15, candidates: [53, 48], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_b_push", slot_role: "Upper push regression", duration_min: 15, candidates: [36], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_b_pull", slot_role: "Upper pull regression", duration_min: 15, candidates: [38], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
        { slot: "block_b_core", slot_role: "Core anti-rotation", duration_min: 15, candidates: [50, 49], set_rep_scheme: "2×8-10", rpe_target: 6.5 },
      ],
    },
  ],
  progression_rule_raw: "Conservative — weeks 1–4 hold load steady; progress via reps only (8→10→12 across mesocycle). Phase 1 → Phase 2 transition: 4 consecutive sessions clean, no DOMS >48h, no joint flare-ups.",
};

/**
 * Returning Athlete Phase 1 Re-entry (3-day) — L1 Comeback Templates.
 * 3 days/week. Supersets present from Phase 1 (Returning Athlete archetype
 * retains pattern memory; can superset + load sooner than Reactivator).
 * Per L1: compound hinge = #7 / #8 OR Cluster 2 #21; compound squat = #2 /
 * #4 OR #31; press = #10 OR #34; pull = #14 / #15 OR #37; vertical pull
 * = #17 (or #38 rebuilding); unilateral = Cluster 2 #27/#29/#30; core =
 * Cluster 2 #50/#52/#53/#49.
 */
const RETURNING_ATHLETE_P1_REENTRY_3D = {
  template_id: "returning-athlete-p1-reentry-3d",
  display_name: "Returning Athlete — Phase 1 Re-entry (3-day)",
  focus: "Re-establish pattern competence at moderate load. RPE-cap 7.",
  day_variants: [
    {
      name: "day_1_hinge_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound hinge", duration_min: 17, candidates: [7, 8, 21], set_rep_scheme: "3×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Compound upper pull", duration_min: 17, candidates: [14, 15, 37], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Unilateral lower", duration_min: 13, candidates: [27, 29, 30], set_rep_scheme: "3×10/side", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core anti-rotation/anti-extension", duration_min: 13, candidates: [50, 52, 53, 49], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_accessory", slot_role: "Hypertrophy accessory", duration_min: 10, candidates: [21, 25, 26], set_rep_scheme: "2×10-12", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility hold", duration_min: 10, candidates: [], set_rep_scheme: "2×30s holds", rpe_target: 7 },
      ],
    },
    {
      name: "day_2_squat_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound squat", duration_min: 17, candidates: [2, 4, 31], set_rep_scheme: "3×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Compound upper push", duration_min: 17, candidates: [10, 34], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Vertical pull", duration_min: 13, candidates: [17, 38], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core anti-rotation/anti-extension", duration_min: 13, candidates: [50, 52, 53, 49], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_accessory", slot_role: "Hypertrophy accessory", duration_min: 10, candidates: [21, 25, 26], set_rep_scheme: "2×10-12", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility hold", duration_min: 10, candidates: [], set_rep_scheme: "2×30s holds", rpe_target: 7 },
      ],
    },
    {
      name: "day_3_full_body_lighter",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound hinge or squat", duration_min: 17, candidates: [7, 21, 31], set_rep_scheme: "3×8", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Compound upper push/pull", duration_min: 17, candidates: [34, 37], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Unilateral lower", duration_min: 13, candidates: [27, 29, 30], set_rep_scheme: "3×10/side", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core anti-rotation/anti-extension", duration_min: 13, candidates: [50, 52, 53, 49], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_accessory", slot_role: "Hypertrophy accessory", duration_min: 10, candidates: [21, 25, 26], set_rep_scheme: "2×10-12", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility hold", duration_min: 10, candidates: [], set_rep_scheme: "2×30s holds", rpe_target: 7 },
      ],
    },
  ],
  progression_rule_raw: "Load progression Superset A wk 1→3 (~5% steps if RPE ≤7); rep progression Superset B; volume progression Superset C (sets 2→3 across mesocycle). Phase 1 → Phase 2: 4 consecutive sessions clean, patterns feel \"owned\".",
};

/**
 * Hybrid-in-comeback Phase 1 Foundation (3-day strength + light Z2) — L1
 * Comeback Templates. 3 strength sessions + 2 light Z2 conditioning. Per L1
 * the strength shape mirrors Reactivator with hybrid-flavoured unilateral
 * (Cluster 2 #30/#29). The conditioning sessions are protocol (no L8 fill);
 * the engine emits them via the Run template's Z2 variant when scheduled.
 */
const HYBRID_IN_COMEBACK_P1_FOUNDATION_3D = {
  template_id: "hybrid-in-comeback-p1-foundation-3d",
  display_name: "Hybrid-in-comeback — Phase 1 Foundation (3-day strength)",
  focus: "Movement patterns + aerobic base in parallel. RPE-cap 7 strength; Z2 conditioning HR-capped.",
  day_variants: [
    {
      name: "strength_day_1_hinge_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound regression (hinge)", duration_min: 17, candidates: [25, 26], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Hip-dominant accessory", duration_min: 17, candidates: [21], set_rep_scheme: "3×10-12", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Unilateral lower", duration_min: 13, candidates: [30, 29], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core", duration_min: 13, candidates: [53, 50, 49], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility flow", duration_min: 10, candidates: [], set_rep_scheme: "flow 10 min", rpe_target: 6 },
      ],
    },
    {
      name: "strength_day_2_squat_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Compound regression (squat)", duration_min: 17, candidates: [31], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Hip-dominant accessory", duration_min: 17, candidates: [21], set_rep_scheme: "3×10-12", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Upper push", duration_min: 13, candidates: [36, 34], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core", duration_min: 13, candidates: [53, 50, 49], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility flow", duration_min: 10, candidates: [], set_rep_scheme: "flow 10 min", rpe_target: 6 },
      ],
    },
    {
      name: "strength_day_3_upper_emphasis",
      slots: [
        { slot: "superset_a_compound", slot_role: "Upper pull", duration_min: 17, candidates: [38, 37], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_a_accessory", slot_role: "Upper push", duration_min: 17, candidates: [36, 34], set_rep_scheme: "3×10-12", rpe_target: 7 },
        { slot: "superset_b_unilateral", slot_role: "Unilateral lower (light)", duration_min: 13, candidates: [30, 29], set_rep_scheme: "3×8-10", rpe_target: 7 },
        { slot: "superset_b_core", slot_role: "Core", duration_min: 13, candidates: [53, 50, 49], set_rep_scheme: "3×10", rpe_target: 7 },
        { slot: "superset_c_mobility", slot_role: "Mobility flow", duration_min: 10, candidates: [], set_rep_scheme: "flow 10 min", rpe_target: 6 },
      ],
    },
  ],
  progression_rule_raw: "Strength: load progression Superset A wk 1→3; rep on B; flow time on C. Conditioning: duration progression first (30→35→40 min), then intensity. Phase 1 → Phase 2: 4 consecutive weeks clean across all 5 sessions.",
};

/**
 * Mobility — L1 Mobility & Conditioning Templates. Used by D5 primary,
 * G4, and ALL E-cluster Phase 1 (rehab) as compatible secondary. Per L1
 * prose, "Mobility flows are NOT slot-filled from Layer 8" — protocol
 * exercises are fixed by methodology; load is user-scaled. Mirrors the
 * Run template shape (empty candidate arrays per slot).
 */
const MOBILITY = {
  template_id: "mobility",
  display_name: "Mobility",
  focus: "End-range control, recovery, ROM progression",
  day_variants: [
    {
      name: "default",
      slots: [
        { slot: "warm_up", slot_role: "Light dynamic, blood flow", duration_min: 5, candidates: [], set_rep_scheme: "Generic dynamic 5 min", rpe_target: 4 },
        { slot: "main_flow", slot_role: "Hip → spine → shoulder progression", duration_min: 45, candidates: [], set_rep_scheme: "90/90 Hip Flow · Cossack Squat · Jefferson Curl · PAILs/RAILs · End-Range Iso", rpe_target: 5 },
      ],
    },
  ],
  progression_rule_raw: "Load on Cossack Squat / Jefferson Curl progresses wk 1→3; iso hold time 20→30→40s across mesocycle; ROM re-tested every 4 weeks.",
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
  "reactivator-p1-foundation-2d": REACTIVATOR_P1_FOUNDATION_2D,
  "reactivator-p2-loaded-3d": REACTIVATOR_P2_LOADED_3D,
  "returning-athlete-p1-reentry-3d": RETURNING_ATHLETE_P1_REENTRY_3D,
  "hybrid-in-comeback-p1-foundation-3d": HYBRID_IN_COMEBACK_P1_FOUNDATION_3D,
  mobility: MOBILITY,
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
