#!/usr/bin/env node
/**
 * 12.3b acceptance-criteria evidence runner.
 *
 * Runs the same fixtures the 12.3a evidence script uses, but through the
 * code path the /api/prelude/complete route exercises:
 *   converter → engine → JSON round-trip (simulating wire + persistence).
 *
 * The JSON round-trip is the key gap closure: AC3 asks for "3 alpha fixtures
 * via API match the evidence script's isolated output (determinism
 * end-to-end)" and the "persistence diverges from engine isolation" stop
 * condition is detectable here without a live server.
 *
 * AC4 asks for "6 Entry-Phase Set fixtures via API — E1/F4 land phase_1
 * (SAFETY)". The script asserts each entry phase and flags any clinical
 * fixture that does not land on phase_1.
 *
 * Usage: `node scripts/12-3b-evidence.mjs [--json]`
 */

import { createHash } from "node:crypto";
import { convertPreludeToEngineInput } from "../lib/prelude/converter.mjs";
import { buildFirstWeekProgram } from "../lib/engine/index.mjs";

const ALPHA_FIXTURES = {
  "VF-A1": {
    description: "Mark · Reactivator · A1 Get lean · 3 days · 36mo inactivity",
    expected_phase: "phase_2",
    prelude: {
      experience_level: "reactivator",
      archetype_flags: { recent_inactivity_months: 36, age: 38, postpartum_months: null, pregnancy_gestational_week: null },
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
    expected_phase: "phase_1",
    prelude: {
      experience_level: "experienced",
      archetype_flags: { recent_inactivity_months: 8, age: 34, postpartum_months: null, pregnancy_gestational_week: null },
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
    expected_phase: null,
    prelude: {
      experience_level: "active",
      archetype_flags: { recent_inactivity_months: 0, age: 35, postpartum_months: null, pregnancy_gestational_week: null },
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

const ENTRY_PHASE_FIXTURES = {
  "VF-A1-cold": {
    description: "Reactivator · A1 Get lean · cold (no reported lifts, starter) · 24mo inactivity",
    expected_phase: "phase_1",
    safety_critical: false,
    prelude: {
      experience_level: "starter",
      archetype_flags: { recent_inactivity_months: 24, age: 42, postpartum_months: null, pregnancy_gestational_week: null },
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
  "VF-A1": {
    description: "Reactivator · A1 · comeback + retained capacity (mirrors alpha)",
    expected_phase: "phase_2",
    safety_critical: false,
    prelude: ALPHA_FIXTURES["VF-A1"].prelude,
  },
  "VF-A1-noncomeback": {
    description: "Non-comeback · A1 Get lean · trained, no extended pause",
    expected_phase: "phase_1",
    safety_critical: false,
    prelude: {
      experience_level: "experienced",
      archetype_flags: { recent_inactivity_months: 0, age: 32, postpartum_months: null, pregnancy_gestational_week: null },
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
    safety_critical: false,
    prelude: {
      experience_level: "experienced",
      archetype_flags: { recent_inactivity_months: 0, age: 30, postpartum_months: null, pregnancy_gestational_week: null },
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
    safety_critical: true,
    prelude: {
      experience_level: "experienced",
      archetype_flags: { recent_inactivity_months: 0, age: 34, postpartum_months: null, pregnancy_gestational_week: null },
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
    description: "F4 Postpartum reconditioning · 4mo postpartum [SAFETY]",
    expected_phase: "phase_1",
    safety_critical: true,
    prelude: {
      experience_level: "active",
      archetype_flags: { recent_inactivity_months: 4, age: 33, postpartum_months: 4, pregnancy_gestational_week: null },
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

function hashProgram(p) {
  return createHash("sha256").update(JSON.stringify(p)).digest("hex").slice(0, 16);
}

/**
 * Engine-isolated run — what scripts/12-3a-evidence.mjs sees.
 */
function runIsolated(prelude) {
  const input = convertPreludeToEngineInput(prelude);
  return buildFirstWeekProgram(input);
}

/**
 * "API path" run — mirrors app/api/prelude/complete/route.js:
 *   1. converter
 *   2. engine
 *   3. JSON serialize → deserialize (simulates the response wire + the
 *      jsonb persistence round-trip via user_program)
 * Returns the post-round-trip program object the client would receive.
 */
function runApiPath(prelude) {
  const input = convertPreludeToEngineInput(prelude);
  const program = buildFirstWeekProgram(input);
  const wire = JSON.stringify({ program });
  return JSON.parse(wire).program;
}

function main() {
  const wantJson = process.argv.includes("--json");
  const ALL = { ...ALPHA_FIXTURES, ...ENTRY_PHASE_FIXTURES };
  const out = {
    ac3_alpha_through_api_matches_isolated: [],
    ac4_entry_phase_through_api: [],
    safety_blockers: [],
  };

  // AC3 — 3 alpha fixtures: API-path hash MUST match engine-isolated hash.
  for (const name of Object.keys(ALPHA_FIXTURES)) {
    const isolated = runIsolated(ALPHA_FIXTURES[name].prelude);
    const api = runApiPath(ALPHA_FIXTURES[name].prelude);
    const isolatedHash = hashProgram(isolated);
    const apiHash = hashProgram(api);
    out.ac3_alpha_through_api_matches_isolated.push({
      name,
      description: ALPHA_FIXTURES[name].description,
      isolated_hash: isolatedHash,
      api_hash: apiHash,
      identical: isolatedHash === apiHash,
    });
  }

  // AC4 — 6 Entry-Phase Set fixtures through API path land correct phase.
  // Both safety fixtures (E1, F4) MUST land phase_1; any deviation flags a
  // release blocker.
  for (const [name, fx] of Object.entries(ENTRY_PHASE_FIXTURES)) {
    let observedPhase = null;
    let primaryTemplate = null;
    let err = null;
    try {
      const program = runApiPath(fx.prelude);
      observedPhase = program.goal?.goal_phase ?? null;
      primaryTemplate = program.templates_selected?.[0]?.template_id ?? null;
    } catch (e) {
      err = e.message;
    }
    const pass = observedPhase === fx.expected_phase && !err;
    out.ac4_entry_phase_through_api.push({
      name,
      description: fx.description,
      expected_phase: fx.expected_phase,
      observed_phase: observedPhase,
      primary_template: primaryTemplate,
      safety_critical: fx.safety_critical,
      pass,
      error: err,
    });
    if (fx.safety_critical && !pass) {
      out.safety_blockers.push({
        name,
        description: fx.description,
        expected_phase: fx.expected_phase,
        observed_phase: observedPhase,
        error: err,
      });
    }
  }

  if (wantJson) {
    process.stdout.write(JSON.stringify(out, null, 2));
    return out.safety_blockers.length === 0 ? 0 : 1;
  }

  console.log("=".repeat(72));
  console.log("12.3b AC EVIDENCE — fixtures via API code path");
  console.log("=".repeat(72));

  console.log("\n--- AC3: 3 alpha fixtures through API path match engine-isolated ---");
  for (const r of out.ac3_alpha_through_api_matches_isolated) {
    const tag = r.identical ? "PASS" : "FAIL";
    console.log(`  ${r.name}: isolated=${r.isolated_hash} api=${r.api_hash} → ${tag}`);
    if (!r.identical) {
      console.log(`    Persistence/serialization diverged from engine isolation — flag MD.`);
    }
  }

  console.log("\n--- AC4: 6 Entry-Phase Set fixtures through API path ---");
  for (const r of out.ac4_entry_phase_through_api) {
    const tag = r.pass ? "PASS" : "FAIL";
    const safety = r.safety_critical ? " [SAFETY]" : "";
    const tpl = r.primary_template ? `  primary=${r.primary_template}` : "";
    const errMsg = r.error ? `  error="${r.error}"` : "";
    console.log(
      `  ${r.name}${safety}: expected_phase=${r.expected_phase} observed=${r.observed_phase} → ${tag}${tpl}${errMsg}`
    );
  }
  const ac4Pass = out.ac4_entry_phase_through_api.every((r) => r.pass);
  const safetyPass = out.safety_blockers.length === 0;
  console.log(
    `  → AC4 all-assertions: ${ac4Pass ? "PASS" : "FAIL"}; safety subset (E1/F4): ${safetyPass ? "PASS" : "FAIL — RELEASE BLOCKER"}`
  );

  if (!safetyPass) {
    console.log("\n!!! SAFETY BLOCKERS — DO NOT DEPLOY !!!");
    for (const b of out.safety_blockers) {
      console.log(
        `  ${b.name}: expected ${b.expected_phase}, observed ${b.observed_phase}${b.error ? ` (${b.error})` : ""}`
      );
    }
  }

  console.log("\nDone.");
  if (!ac4Pass || !safetyPass) process.exitCode = 1;
}

main();
