#!/usr/bin/env node
/**
 * 12.3a acceptance-criteria evidence runner.
 *
 * Runs converter + engine against VF-A1, VF-A2, VF-A5 fixtures (DS-01 §9)
 * plus a deliberately malformed profile for AC1, and a determinism re-run
 * for AC4. Output is stdout JSON + a short per-fixture summary.
 *
 * Usage: `node scripts/12-3a-evidence.mjs [--json]`
 */

import { createHash } from "node:crypto";
import { convertPreludeToEngineInput } from "../lib/prelude/converter.mjs";
import { buildFirstWeekProgram } from "../lib/engine/index.mjs";
import { getCouplingEntry } from "../lib/engine/kb-loader.mjs";

const FIXTURES = {
  "VF-A1": {
    description: "Mark · Reactivator · A1 Get lean · 3 days · 36mo inactivity",
    prelude: {
      experience_level: "reactivator",
      archetype_flags: {
        recent_inactivity_months: 36,
        age: 38,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 3,
      equipment_available: ["full_gym"],
      bodyweight_kg: 82,
      reported_lifts: { squat: 80, deadlift: 100, bench: 70, ohp: 45, row: 60 },
      contraindications: [],
      goal_id: "A1",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A1",
    },
  },
  "VF-A2": {
    description: "Returning Athlete · C2 race long-distance · 4 days · left_knee_post_surgery · 8mo inactivity",
    prelude: {
      experience_level: "experienced",
      archetype_flags: {
        recent_inactivity_months: 8,
        age: 34,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 4,
      equipment_available: ["full_gym"],
      bodyweight_kg: 78,
      reported_lifts: { squat: 100, deadlift: 130, bench: 80, ohp: 55, row: 70 },
      contraindications: ["left_knee_post_surgery"],
      goal_id: "C2",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A2",
    },
  },
  "VF-A5": {
    description: "Hybrid Athlete · C4 Hyrox · 5 days · no inactivity",
    // §11 amendment: VF-A5's profile is non-comeback (inactivity=0, trained,
    // reported lifts) → Non-comeback C4 branch → goal_phase=null. Delivered
    // program (trained mixed week: full-body + run + lower-posterior +
    // upper-push-pull) is unchanged from 12.3a; only the phase label.
    doctrine_assertion: {
      expected_phase: null,
      expected_primary_template: "full-body",
      notes: "§11 — non-comeback C4 → goal_phase=null (parallel non-phased branch). Delivered program = trained mixed week.",
    },
    prelude: {
      experience_level: "active",
      archetype_flags: {
        recent_inactivity_months: 0,
        age: 35,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: true,
      days_per_week: 5,
      equipment_available: ["full_gym"],
      bodyweight_kg: 80,
      reported_lifts: { squat: 120, deadlift: 150, bench: 90, ohp: 60, row: 80 },
      contraindications: [],
      goal_id: "C4",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A5",
    },
  },
};

/**
 * 12.3a-fix new fixtures — entry-phase doctrine (L5/L8 Spec §10).
 *
 * Five fixtures cover the doctrine branches the alpha set didn't reach.
 * Two of them (VF-E1-entry, VF-F4-entry) are SAFETY fixtures: clinical
 * goals MUST resolve to phase_1, never phase_3, regardless of training
 * status.
 */
const DOCTRINE_FIXTURES = {
  "VF-A1-cold": {
    description: "Reactivator · A1 Get lean · cold (no reported lifts, starter) · 24mo inactivity",
    expected_phase: "phase_1",
    notes: "Rule 3 — comeback-arc A1, comeback persona, no retained capacity → Phase 1.",
    prelude: {
      experience_level: "starter",
      archetype_flags: {
        recent_inactivity_months: 24,
        age: 42,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 2,
      equipment_available: ["full_gym"],
      bodyweight_kg: 80,
      reported_lifts: { squat: null, deadlift: null, bench: null, ohp: null, row: null },
      contraindications: [],
      goal_id: "A1",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A1",
    },
  },
  "VF-A1-noncomeback": {
    description: "Non-comeback · A1 Get lean · trained, no extended pause",
    expected_phase: "phase_1",
    notes: "Rule 1 default — non-comeback on a comeback-arc goal falls through to Phase 1.",
    prelude: {
      experience_level: "experienced",
      archetype_flags: {
        recent_inactivity_months: 0,
        age: 32,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 3,
      equipment_available: ["full_gym"],
      bodyweight_kg: 78,
      reported_lifts: { squat: 110, deadlift: 140, bench: 90, ohp: 60, row: 75 },
      contraindications: [],
      goal_id: "A1",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: null,
    },
  },
  "VF-A2-noncomeback": {
    description: "Returning Athlete persona · A2 Build muscle · trained, no layoff",
    expected_phase: "phase_3",
    notes: "Rule 4 — A2 non-comeback ONLY: trained-user templates via latest-ordinal-with-coverage. SOLE legitimate skip-to-latest.",
    prelude: {
      experience_level: "experienced",
      archetype_flags: {
        recent_inactivity_months: 0,
        age: 30,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 4,
      equipment_available: ["full_gym"],
      bodyweight_kg: 82,
      reported_lifts: { squat: 130, deadlift: 160, bench: 100, ohp: 65, row: 85 },
      contraindications: [],
      goal_id: "A2",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A2",
    },
  },
  "VF-E1-entry": {
    description: "E1 Knee rehab · currently training · no layoff [SAFETY]",
    expected_phase: "phase_1",
    notes: "Rule 2 — clinical-progression goal hard-locked to Phase 1 regardless of training status. SAFETY: must NEVER auto-advance past medical clearance.",
    prelude: {
      experience_level: "experienced",
      archetype_flags: {
        recent_inactivity_months: 0,
        age: 34,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 3,
      equipment_available: ["full_gym"],
      bodyweight_kg: 76,
      reported_lifts: { squat: 100, deadlift: 130, bench: 80, ohp: 55, row: 70 },
      contraindications: ["left_knee_post_surgery"],
      goal_id: "E1",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: null,
    },
  },
  "VF-F4-entry": {
    description: "F4 Postpartum reconditioning · 4mo postpartum · clearance true [SAFETY]",
    expected_phase: "phase_1",
    notes: "Rule 2 — clinical-progression goal hard-locked to Phase 1. SAFETY: bypassing clearance + diastasis/doming gates is unacceptable.",
    prelude: {
      experience_level: "active",
      archetype_flags: {
        recent_inactivity_months: 4,
        age: 33,
        postpartum_months: 4,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 3,
      equipment_available: ["full_gym"],
      bodyweight_kg: 68,
      reported_lifts: { squat: 70, deadlift: 90, bench: 50, ohp: 35, row: 50 },
      contraindications: [],
      goal_id: "F4",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: null,
    },
  },
};

/**
 * Pattern R fixture-gap close — ticket 3724fef0d1ea81d6a0a9fb0b046c6ee4.
 *
 * These fixtures encode the EXACT failure mode Erik hit on his first real
 * Prelude completion: a profile carrying a knee contraindication routed to a
 * template whose lower-body slot pool is composed entirely of `family:"squat"`
 * exercises. `CONTRA_MAP.knee` biases the whole squat (and lunge) family, so
 * every primary candidate fails the contraindication filter; the §9
 * contra-failure fallback then re-walks the same all-squat slot pool plus the
 * failed exercise's substitution_alternatives (similarity-biased → also
 * squats), so nothing survives and `resolveSlot` throws "... unresolvable".
 *
 * BASELINE FAIL on these fixtures is CORRECT until the DS-01 §9 ruling lands.
 * They are intentionally expected to throw today; once Program Designer rules
 * on the slot-architecture doctrine (substitute-cross-family / drop-slot /
 * slot-redefinition / doctrine-routing) and that ruling is implemented in the
 * engine, each fixture flips from `expects_throw:true` (assertion: it threw at
 * the named squat-pattern slot) to a normal pass.
 *
 * These fixtures are deliberately NOT added to ALL_FIXTURES: the AC2/AC4/AC5
 * machinery calls buildFirstWeekProgram outside try/catch (AC4 determinism),
 * so an expected-throw fixture there would crash the whole runner and regress
 * the existing 8. They are exercised only by the dedicated Pattern-R section
 * below, which expects and asserts the throw.
 */
const PATTERN_R_KNEE_FIXTURES = {
  "VF-A2-noncomeback-knee": {
    description:
      "Returning Athlete persona · A2 Build muscle · trained, no layoff · knee contra — ERIK'S EXACT PROFILE",
    ticket: "3724fef0d1ea81d6a0a9fb0b046c6ee4",
    expects_throw: true,
    expected_throw_slot: "superset_a_squat",
    notes:
      "Clone of VF-A2-noncomeback + contraindications:['knee']. Rule 4 → phase_3 " +
      "trained-user templates; primary lower-posterior resolves via hinge defaults, " +
      "secondary lower-anterior throws on superset_a_squat (candidates [1,2,4,31,3] " +
      "all family=squat; fallback sub_alt #27 BSS also family=squat). BASELINE FAIL " +
      "until DS-01 §9 ruling lands.",
    prelude: {
      experience_level: "experienced",
      archetype_flags: {
        recent_inactivity_months: 0,
        age: 30,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 4,
      equipment_available: ["full_gym"],
      bodyweight_kg: 82,
      reported_lifts: { squat: 130, deadlift: 160, bench: 100, ohp: 65, row: 85 },
      contraindications: ["knee"],
      goal_id: "A2",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A2",
    },
  },
  "VF-A2-comeback-knee": {
    description:
      "Returning Athlete · A2 Build muscle · comeback persona (8mo layoff) · knee contra",
    ticket: "3724fef0d1ea81d6a0a9fb0b046c6ee4",
    expects_throw: true,
    expected_throw_slot: "superset_b_unilateral",
    notes:
      "Same archetype, comeback_persona=true (inactivity 8mo). Rule 1 default → " +
      "phase_1 → returning-athlete-p1-reentry-3d. day_1_hinge_emphasis throws on " +
      "superset_b_unilateral (candidates [27,29,30] all family=squat) before the " +
      "day_2 squat compound is even reached. BASELINE FAIL until DS-01 §9 ruling.",
    prelude: {
      experience_level: "active",
      archetype_flags: {
        recent_inactivity_months: 8,
        age: 34,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 4,
      equipment_available: ["full_gym"],
      bodyweight_kg: 85,
      reported_lifts: { squat: 120, deadlift: 150, bench: 90, ohp: 60, row: 80 },
      contraindications: ["knee"],
      goal_id: "A2",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A2",
    },
  },
  "VF-A1-knee": {
    description:
      "Reactivator · A1 Get lean · cold (starter, no reported lifts) · 24mo layoff · knee contra",
    ticket: "3724fef0d1ea81d6a0a9fb0b046c6ee4",
    expects_throw: true,
    expected_throw_slot: "block_a_squat",
    notes:
      "Clone of VF-A1-cold + contraindications:['knee']. Rule 3 → phase_1 → " +
      "reactivator-p1-foundation-2d. block_a_hinge resolves (hinge, knee-safe); " +
      "block_a_squat (candidates [31] Goblet Squat, family=squat) throws — this is " +
      "the literal slot id from the original ticket. Reproduces the exact " +
      "single-candidate squat pool. BASELINE FAIL until DS-01 §9 ruling.",
    prelude: {
      experience_level: "starter",
      archetype_flags: {
        recent_inactivity_months: 24,
        age: 42,
        postpartum_months: null,
        pregnancy_gestational_week: null,
      },
      training_history_cross_modal: false,
      days_per_week: 2,
      equipment_available: ["full_gym"],
      bodyweight_kg: 80,
      reported_lifts: { squat: null, deadlift: null, bench: null, ohp: null, row: null },
      contraindications: ["knee"],
      goal_id: "A1",
      goal_provisional: false,
      provisional_goal_source: null,
      user_words_goal: null,
      detected_archetype: "A1",
    },
  },
};

const MALFORMED = {
  description: "Deliberately malformed: days_per_week=0, missing reported_lifts.squat key",
  prelude: {
    experience_level: "active",
    archetype_flags: { recent_inactivity_months: 0, age: 30, postpartum_months: null, pregnancy_gestational_week: null },
    training_history_cross_modal: false,
    days_per_week: 0, // < schema min
    equipment_available: ["barbell"],
    bodyweight_kg: 70,
    reported_lifts: { deadlift: 100, bench: 70, ohp: 45, row: 60 }, // squat key missing entirely
    contraindications: [],
    goal_id: "A1",
    goal_provisional: false,
    provisional_goal_source: null,
    user_words_goal: null,
    detected_archetype: "A1",
  },
};

function hashProgram(program) {
  return createHash("sha256").update(JSON.stringify(program)).digest("hex").slice(0, 16);
}

function summarizeSessions(program) {
  return program.sessions.map((s) => ({
    day: s.day_of_week,
    template: s.template_id,
    variant: s.day_variant,
    exercises: s.phases
      .filter((p) => p.exercise_id)
      .map((p) => ({
        slot: p.slot,
        id: p.exercise_id,
        name: p.exercise_name,
        scheme: p.set_rep_scheme,
        rpe: p.rpe_target,
        load: p.load_placeholder,
      })),
  }));
}

function runFixture(name, fx) {
  const input = convertPreludeToEngineInput(fx.prelude);
  const program = buildFirstWeekProgram(input);
  const hash = hashProgram(program);
  return { name, description: fx.description, input, program, hash };
}

/**
 * VF-clinical-entry-trained — parametric safety fixture per PD §11
 * follow-up. For EACH canonical clinical-progression goal, assert that a
 * retained-capacity profile (experienced + reported lifts present)
 * resolves to a SAFE phase (phase_1 for phased entries; null for
 * single-block entries — F1–F3 are non-phase-aware in the L5 KB and
 * resolvePhase short-circuits before the clinical hard-lock). The goal
 * list is hardcoded here, not pulled from the engine's
 * CLINICAL_PROGRESSION_GOALS set, so membership drift in the engine
 * (e.g. someone fat-fingering E1 out of the clinical set into the
 * comeback-arc set) fails this fixture without silently shifting the
 * assertion baseline.
 */
const CANONICAL_CLINICAL_GOALS = [
  { goal_id: "E1", phase_type: "phased",       expected_phase: "phase_1" },
  { goal_id: "E2", phase_type: "phased",       expected_phase: "phase_1" },
  { goal_id: "E3", phase_type: "phased",       expected_phase: "phase_1" },
  { goal_id: "E4", phase_type: "phased",       expected_phase: "phase_1" },
  { goal_id: "E5", phase_type: "phased",       expected_phase: "phase_1" },
  { goal_id: "E6", phase_type: "phased",       expected_phase: "phase_1" },
  { goal_id: "F1", phase_type: "single_block", expected_phase: null },
  { goal_id: "F2", phase_type: "single_block", expected_phase: null },
  { goal_id: "F3", phase_type: "single_block", expected_phase: null },
  { goal_id: "F4", phase_type: "phased",       expected_phase: "phase_1" },
];

function makeRetainedCapacityClinicalPrelude(goalId) {
  return {
    experience_level: "experienced",
    archetype_flags: {
      recent_inactivity_months: 0,
      age: 34,
      postpartum_months: goalId === "F4" ? 4 : null,
      pregnancy_gestational_week:
        goalId === "F1" ? 8 : goalId === "F2" ? 20 : goalId === "F3" ? 34 : null,
    },
    training_history_cross_modal: false,
    days_per_week: 3,
    equipment_available: ["full_gym"],
    bodyweight_kg: 76,
    reported_lifts: { squat: 100, deadlift: 130, bench: 80, ohp: 55, row: 70 },
    contraindications: goalId === "E1" ? ["left_knee_post_surgery"] : [],
    goal_id: goalId,
    goal_provisional: false,
    provisional_goal_source: null,
    user_words_goal: null,
    detected_archetype: null,
  };
}

const ALL_FIXTURES = { ...FIXTURES, ...DOCTRINE_FIXTURES };

function main() {
  const wantJson = process.argv.includes("--json");
  const out = { ac1: {}, ac2: [], ac3: {}, ac4: {}, ac5: [], ac6_clinical_entry_trained: [] };

  // AC1: converter produces valid input for all three; throws on malformed.
  for (const [name, fx] of Object.entries(FIXTURES)) {
    try {
      const input = convertPreludeToEngineInput(fx.prelude);
      out.ac1[name] = { status: "PASS", engine_input: input };
    } catch (e) {
      out.ac1[name] = { status: "FAIL", error: e.message };
    }
  }
  try {
    convertPreludeToEngineInput(MALFORMED.prelude);
    out.ac1.malformed = { status: "UNEXPECTED_PASS" };
  } catch (e) {
    out.ac1.malformed = { status: "THREW_AS_EXPECTED", error: e.message };
  }

  // AC2: engine produces a complete first-week program for all fixtures
  // (alpha set + doctrine set).
  const runs = {};
  for (const name of Object.keys(ALL_FIXTURES)) {
    try {
      const result = runFixture(name, ALL_FIXTURES[name]);
      runs[name] = result;
      out.ac2.push({
        name,
        description: result.description,
        goal_id: result.program.goal.goal_id,
        goal_phase: result.program.goal.goal_phase,
        templates: result.program.templates_selected,
        sessions: summarizeSessions(result.program),
        substitutions: result.program.applied_substitutions,
        alerts: result.program.engine_alerts,
        hash: result.hash,
      });
    } catch (e) {
      out.ac2.push({ name, status: "FAIL", error: e.message, stack: e.stack });
    }
  }

  // AC3: VF-A2 knee contra excludes #27 BSS via L1 slot-pool fallback (not sub_alt).
  const vfA2 = runs["VF-A2"];
  if (vfA2) {
    const a2lowerP = vfA2.program.sessions.find((s) => s.template_id === "lower-posterior");
    const subs = vfA2.program.applied_substitutions.filter((s) => /contra/.test(s.reason));
    out.ac3 = {
      lower_posterior_session: a2lowerP ? summarizeSessions({ sessions: [a2lowerP] })[0] : null,
      contra_substitutions: subs,
      proof: subs.length
        ? {
            excluded_27_bss:
              subs.some((s) => s.from_exercise_id === 27 || a2lowerP?.phases.every((p) => p.exercise_id !== 27)) ||
              !a2lowerP?.phases.some((p) => p.exercise_id === 27),
            fallback_via_slot_pool: subs.every((s) =>
              (s.fallback_path || []).some((p) => /slot_pool/.test(p))
            ),
          }
        : null,
    };
  }

  // AC4: determinism. Re-run each fixture and confirm identical SHA256.
  for (const name of Object.keys(ALL_FIXTURES)) {
    const r1 = runFixture(name, ALL_FIXTURES[name]);
    const r2 = runFixture(name, ALL_FIXTURES[name]);
    out.ac4[name] = {
      hash_run_1: r1.hash,
      hash_run_2: r2.hash,
      identical: r1.hash === r2.hash,
    };
  }

  // AC5 (12.3a-fix): entry-phase doctrine. The 5 doctrine fixtures + any
  // alpha fixture carrying a doctrine_assertion are checked against the
  // expected phase (and primary template when asserted). The two clinical
  // safety fixtures MUST land on phase_1.
  const assertions = [
    ...Object.entries(DOCTRINE_FIXTURES).map(([name, fx]) => ({
      name,
      description: fx.description,
      notes: fx.notes,
      expected_phase: fx.expected_phase,
      expected_primary_template: null,
    })),
    ...Object.entries(FIXTURES)
      .filter(([, fx]) => fx.doctrine_assertion)
      .map(([name, fx]) => ({
        name,
        description: fx.description,
        notes: fx.doctrine_assertion.notes,
        expected_phase: fx.doctrine_assertion.expected_phase,
        expected_primary_template: fx.doctrine_assertion.expected_primary_template ?? null,
      })),
  ];
  for (const a of assertions) {
    const result = runs[a.name];
    const observed = result?.program?.goal?.goal_phase ?? null;
    const primary = result?.program?.templates_selected?.[0]?.template_id ?? null;
    const phaseOk = observed === a.expected_phase;
    const templateOk = a.expected_primary_template === null || primary === a.expected_primary_template;
    const safety = /SAFETY/.test(a.description);
    out.ac5.push({
      name: a.name,
      description: a.description,
      notes: a.notes,
      expected_phase: a.expected_phase,
      observed_phase: observed,
      expected_primary_template: a.expected_primary_template,
      observed_primary_template: primary,
      pass: phaseOk && templateOk,
      safety_critical: safety,
    });
  }

  // SPOT-CHECK 1 (B6) — confirm transformed L5 JSON carries per-option
  // `condition` qualifiers for non-comeback carve-outs. PD's canonical
  // within-phase selection rule (§11 FLAG 2) depends on this data: an
  // empty `condition` means the engine cannot distinguish comeback from
  // non-comeback options within a phase block.
  const b6 = {
    checks: [
      { goal_id: "A1", phase: "phase_1", expectCondition: "full-body" },
      { goal_id: "A2", phase: "phase_3", expectCondition: "any" },
      { goal_id: "C4", phase: "phase_2", expectCondition: "any" },
    ],
    results: [],
  };
  for (const c of b6.checks) {
    const entry = getCouplingEntry(c.goal_id);
    const phaseBlock = entry.eligible_templates.phases?.find((p) => p.phase === c.phase);
    const options = phaseBlock?.eligible_templates ?? [];
    const populated = options.some((o) => typeof o.condition === "string" && o.condition.length > 0);
    const sample =
      c.expectCondition === "full-body"
        ? options.find((o) => o.template_id === "full-body")?.condition ?? null
        : options.map((o) => o.condition ?? null);
    b6.results.push({
      goal_id: c.goal_id,
      phase: c.phase,
      any_condition_populated: populated,
      sample_condition: sample,
    });
  }
  const b6Dropped = b6.results.every((r) => !r.any_condition_populated);
  out.ac5_spot_b6 = {
    populated: !b6Dropped,
    results: b6.results,
    note: b6Dropped
      ? "B6 DROPPED — every checked phase block has empty `condition` fields. The KB prose carries the qualifier ('For non-comeback A1 users... Full Body 2-day OR 3-day') but the transform did not capture it per the EligibleTemplateOption.condition schema. The engine-side condition-first selection rule (§11 FLAG 2) is wired but data-starved; without a B6 transform fix VF-A1-noncomeback continues to resolve to reactivator-p1-foundation-2d (option 1 by L5 order). Flagged to MD."
      : "B6 OK — `condition` fields populated.",
  };

  // AC6 (PD §11 follow-up): VF-clinical-entry-trained parametric guard.
  // For every canonical clinical goal, a retained-capacity profile must
  // resolve to a SAFE phase. Catches membership drift in
  // CLINICAL_PROGRESSION_GOALS that the per-fixture VF-E1-entry /
  // VF-F4-entry assertions only spot-check.
  for (const c of CANONICAL_CLINICAL_GOALS) {
    let observedPhase = "<engine-error>";
    let observedTemplate = null;
    let error = null;
    try {
      const input = convertPreludeToEngineInput(makeRetainedCapacityClinicalPrelude(c.goal_id));
      const program = buildFirstWeekProgram(input);
      observedPhase = program.goal.goal_phase;
      observedTemplate = program.templates_selected?.[0]?.template_id ?? null;
    } catch (e) {
      error = e.message;
    }
    out.ac6_clinical_entry_trained.push({
      goal_id: c.goal_id,
      phase_type: c.phase_type,
      retained_capacity_profile: "experience=experienced, lifts present",
      expected_phase: c.expected_phase,
      observed_phase: observedPhase,
      primary_template: observedTemplate,
      pass: observedPhase === c.expected_phase,
      error,
    });
  }

  // SPOT-CHECK 2 (FLAG-5 gate) — confirm the comeback-arc Phase-2 bump
  // fires BECAUSE reported_lifts present (or experience ≥ active), not
  // unconditionally. Evidence: VF-A1 (comeback + lifts) → phase_2;
  // VF-A1-cold (comeback, no lifts, starter) → phase_1. Same goal, same
  // comeback persona, opposite retained-capacity → opposite phase.
  const vfA1 = runs["VF-A1"]?.program?.goal?.goal_phase ?? null;
  const vfA1Cold = runs["VF-A1-cold"]?.program?.goal?.goal_phase ?? null;
  const flag5Pass = vfA1 === "phase_2" && vfA1Cold === "phase_1";
  out.ac5_spot_flag5 = {
    pass: flag5Pass,
    vf_a1_phase: vfA1,
    vf_a1_cold_phase: vfA1Cold,
    note: flag5Pass
      ? "FLAG-5 OK — comeback Phase-2 bump is gated on retained-capacity, not persona alone. Same goal A1, same comeback persona; different retained-capacity → different phase."
      : "FLAG-5 FAIL — the comeback Phase-2 bump did not differentiate retained-capacity from cold.",
  };

  // AC7 (Pattern R fixture-gap, ticket 3724fef0…): knee contra × squat-pattern
  // slot. Each fixture is EXPECTED to throw at a named squat-pattern slot
  // today (BASELINE FAIL is correct until the DS-01 §9 ruling lands). The
  // assertion here is inverted relative to the other ACs: `pass` means the
  // engine threw "... unresolvable" at the expected squat slot. These are run
  // in their own try/catch and are NOT part of ALL_FIXTURES, so they cannot
  // crash AC2/AC4/AC5 or regress the existing 8 fixtures.
  out.ac7_pattern_r_knee = [];
  for (const [name, fx] of Object.entries(PATTERN_R_KNEE_FIXTURES)) {
    let threw = false;
    let message = null;
    let observedSlot = null;
    try {
      const input = convertPreludeToEngineInput(fx.prelude);
      buildFirstWeekProgram(input);
    } catch (e) {
      threw = true;
      message = e.message;
      const m = /slot (\S+) unresolvable/.exec(e.message || "");
      observedSlot = m ? m[1] : null;
    }
    const slotOk = observedSlot === fx.expected_throw_slot;
    // "pass" = behaved as expected for this pre-fix baseline: it threw, at the
    // squat-pattern slot we predicted, with the squat-contra unresolvable shape.
    const pass = fx.expects_throw ? threw && slotOk : !threw;
    out.ac7_pattern_r_knee.push({
      name,
      description: fx.description,
      ticket: fx.ticket,
      notes: fx.notes,
      expects_throw: fx.expects_throw,
      expected_throw_slot: fx.expected_throw_slot,
      observed_threw: threw,
      observed_throw_slot: observedSlot,
      error_message: message,
      baseline_fail_is_expected: true,
      pass,
    });
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify(out, null, 2));
    return;
  }

  // Human summary
  console.log("=".repeat(72));
  console.log("12.3a AC EVIDENCE");
  console.log("=".repeat(72));

  console.log("\n--- AC1: Converter validation ---");
  for (const [name, r] of Object.entries(out.ac1)) {
    console.log(`  ${name}: ${r.status}${r.error ? " — " + r.error : ""}`);
  }

  console.log("\n--- AC2: Engine output per fixture ---");
  for (const f of out.ac2) {
    if (f.status === "FAIL") {
      console.log(`  ${f.name}: FAIL — ${f.error}`);
      continue;
    }
    console.log(`\n  [${f.name}] ${f.description}`);
    console.log(`    goal=${f.goal_id} phase=${f.goal_phase} hash=${f.hash}`);
    console.log(`    templates: ${f.templates.map((t) => `${t.template_id}(${t.day_variant},${t.role})`).join(" + ")}`);
    for (const s of f.sessions) {
      console.log(`    Day ${s.day} · ${s.template} · ${s.variant}`);
      for (const ex of s.exercises) {
        const load = ex.load === null ? "load:tbd" : `load:${ex.load}`;
        console.log(`      ${ex.slot.padEnd(28)} #${ex.id} ${ex.name.padEnd(28)} ${ex.scheme.padEnd(14)} RPE${ex.rpe} ${load}`);
      }
    }
    if (f.substitutions.length) {
      console.log("    substitutions:");
      for (const s of f.substitutions) {
        console.log(`      slot=${s.slot} from=#${s.from_exercise_id} → to=#${s.to_exercise_id} reason="${s.reason}" path=[${s.fallback_path.join(" → ")}]`);
      }
    }
    if (f.alerts.length) {
      console.log("    alerts:");
      for (const a of f.alerts) console.log(`      [${a.severity}] ${a.message}`);
    }
  }

  console.log("\n--- AC3: VF-A2 knee contra fallback ---");
  if (out.ac3.contra_substitutions?.length) {
    for (const s of out.ac3.contra_substitutions) {
      console.log(`  slot=${s.slot} from=#${s.from_exercise_id} → to=#${s.to_exercise_id}`);
      console.log(`    reason: ${s.reason}`);
      console.log(`    path: [${s.fallback_path.join(" → ")}]`);
    }
    console.log(`  PROOF excluded_27_bss=${out.ac3.proof?.excluded_27_bss}`);
    console.log(`  PROOF fallback_via_slot_pool=${out.ac3.proof?.fallback_via_slot_pool}`);
  } else {
    console.log("  NO CONTRA SUBSTITUTION RECORDED — AC3 may not be satisfied.");
  }

  console.log("\n--- AC4: Determinism (re-run hash compare) ---");
  for (const [name, r] of Object.entries(out.ac4)) {
    console.log(`  ${name}: run1=${r.hash_run_1} run2=${r.hash_run_2} identical=${r.identical}`);
  }

  console.log("\n--- AC5 (12.3a-fix): Entry-phase doctrine — L5/L8 Spec §10 + §11 ---");
  for (const r of out.ac5) {
    const tag = r.pass ? "PASS" : "FAIL";
    const safety = r.safety_critical ? " [SAFETY]" : "";
    const tpl = r.expected_primary_template
      ? `  template_expected=${r.expected_primary_template} observed=${r.observed_primary_template}`
      : r.observed_primary_template
        ? `  (primary=${r.observed_primary_template})`
        : "";
    console.log(
      `  ${r.name}${safety}: expected_phase=${r.expected_phase} observed=${r.observed_phase} → ${tag}${tpl}`
    );
    console.log(`    ${r.notes}`);
  }
  const ac5AllPass = out.ac5.every((r) => r.pass);
  const ac5SafetyPass = out.ac5.every((r) => !r.safety_critical || r.pass);
  console.log(`  → AC5 all-assertions: ${ac5AllPass ? "PASS" : "FAIL"}; safety subset: ${ac5SafetyPass ? "PASS" : "FAIL"}`);

  console.log("\n--- AC5 SPOT-CHECK 1 (B6 condition-field presence) ---");
  for (const r of out.ac5_spot_b6.results) {
    console.log(
      `  ${r.goal_id} ${r.phase}: any_condition_populated=${r.any_condition_populated}  sample=${JSON.stringify(r.sample_condition)}`
    );
  }
  console.log(`  → B6: ${out.ac5_spot_b6.populated ? "OK" : "DROPPED — flag to MD"}`);
  console.log(`  ${out.ac5_spot_b6.note}`);

  console.log("\n--- AC6 (12.3a-fix): VF-clinical-entry-trained — parametric clinical guard ---");
  console.log("    Retained-capacity profile (experienced + reported lifts present) per clinical goal.");
  console.log("    Hardcoded set; catches engine-side membership drift in CLINICAL_PROGRESSION_GOALS.");
  for (const r of out.ac6_clinical_entry_trained) {
    const tag = r.pass ? "PASS" : "FAIL";
    const tpl = r.primary_template ? `  primary=${r.primary_template}` : "";
    const err = r.error ? `  error="${r.error}"` : "";
    console.log(
      `  ${r.goal_id} (${r.phase_type}): expected_phase=${r.expected_phase} observed=${r.observed_phase} → ${tag}${tpl}${err}`
    );
  }
  const ac6AllPass = out.ac6_clinical_entry_trained.every((r) => r.pass);
  console.log(`  → AC6: ${ac6AllPass ? "PASS" : "FAIL"} — ${out.ac6_clinical_entry_trained.filter((r) => r.pass).length}/${out.ac6_clinical_entry_trained.length} clinical goals land on safe phase.`);

  console.log("\n--- AC5 SPOT-CHECK 2 (FLAG-5 retained-capacity gate) ---");
  console.log(
    `  VF-A1 (comeback + lifts) → ${out.ac5_spot_flag5.vf_a1_phase}; VF-A1-cold (comeback, no lifts) → ${out.ac5_spot_flag5.vf_a1_cold_phase}`
  );
  console.log(`  → FLAG-5: ${out.ac5_spot_flag5.pass ? "PASS" : "FAIL"}`);
  console.log(`  ${out.ac5_spot_flag5.note}`);

  console.log("\n--- AC7 (Pattern R fixture-gap, ticket 3724fef0…): knee contra × squat slot ---");
  console.log("    BASELINE FAIL is correct until the DS-01 §9 ruling lands. `pass` below");
  console.log("    means the engine threw at the predicted squat-pattern slot, as expected.");
  for (const r of out.ac7_pattern_r_knee) {
    const tag = r.pass ? "PASS (threw as expected)" : "UNEXPECTED";
    console.log(`\n  [${r.name}] ${r.description}`);
    console.log(
      `    expects_throw=${r.expects_throw} expected_slot=${r.expected_throw_slot} → observed_threw=${r.observed_threw} observed_slot=${r.observed_throw_slot} → ${tag}`
    );
    if (r.error_message) console.log(`    error: ${r.error_message}`);
    console.log(`    ${r.notes}`);
  }
  const ac7AllExpected = out.ac7_pattern_r_knee.every((r) => r.pass);
  console.log(
    `\n  → AC7: ${ac7AllExpected ? "ALL FIXTURES THREW AS EXPECTED" : "DRIFT — a Pattern-R fixture did not behave as predicted"} ` +
      `(${out.ac7_pattern_r_knee.filter((r) => r.pass).length}/${out.ac7_pattern_r_knee.length}). ` +
      "These flip to normal pass once DS-01 §9 doctrine fix lands."
  );

  console.log("\nDone.");
}

main();
