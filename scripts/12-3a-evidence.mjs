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

const ALL_FIXTURES = { ...FIXTURES, ...DOCTRINE_FIXTURES };

function main() {
  const wantJson = process.argv.includes("--json");
  const out = { ac1: {}, ac2: [], ac3: {}, ac4: {}, ac5: [] };

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

  console.log("\n--- AC5 SPOT-CHECK 2 (FLAG-5 retained-capacity gate) ---");
  console.log(
    `  VF-A1 (comeback + lifts) → ${out.ac5_spot_flag5.vf_a1_phase}; VF-A1-cold (comeback, no lifts) → ${out.ac5_spot_flag5.vf_a1_cold_phase}`
  );
  console.log(`  → FLAG-5: ${out.ac5_spot_flag5.pass ? "PASS" : "FAIL"}`);
  console.log(`  ${out.ac5_spot_flag5.note}`);

  console.log("\nDone.");
}

main();
