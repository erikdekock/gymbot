/**
 * Archetype contract evidence — ticket 3714fef0d1ea817f974ee9f32ed9123d.
 *
 * Pattern R: this is the structural fix to the test-corpus gap. The existing
 * 12.3a/12.3b fixtures HAND-AUTHOR `detected_archetype` as a short code,
 * bypassing the real Prelude UI seam. The verbose slug the UI actually emitted
 * (e.g. "A2_returning_athlete") therefore never reached the converter in any
 * test — which is how the Screen-8 ContractError shipped.
 *
 * This fixture closes that gap: it builds synthetic OnboardingState objects and
 * runs each through the REAL UI deriver → converter → engine:
 *
 *     deriveArchetype(state)  →  convertPreludeToEngineInput  →  buildFirstWeekProgram
 *
 * Coverage: every archetype path the UI can produce (A1, A2, A3, A5, A6, A8,
 * and F7 — see the F7 note below). Run: `node scripts/archetype-contract-evidence.mjs`.
 */

import { deriveArchetype } from "../app/onboarding/_state/archetype.js";
import { initialOnboardingState } from "../app/onboarding/_state/initial-state.js";
import { convertPreludeToEngineInput } from "../lib/prelude/converter.mjs";
import { buildFirstWeekProgram } from "../lib/engine/index.mjs";
import { ContractError } from "../lib/engine/schema.mjs";

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${msg}`);
  if (!cond) failures++;
};

// Deep clone so each case starts from the real initial state shape.
const clone = (o) => JSON.parse(JSON.stringify(o));
function makeState(overrides) {
  const s = clone(initialOnboardingState);
  s.experience_level = overrides.experience_level ?? "active";
  s.archetype_flags = { ...s.archetype_flags, ...(overrides.archetype_flags ?? {}) };
  s.training_history_cross_modal = overrides.training_history_cross_modal ?? false;
  s.days_per_week = 3;
  s.equipment_available = ["full_gym"];
  s.bodyweight_kg = 80;
  s.reported_lifts = { squat: 80, deadlift: 100, bench: 60, ohp: 40, row: 55 };
  s.goal_id = "A1"; // goal is independent of archetype; this resolves to a valid L5 entry
  return s;
}

// Each case sets only the fields that drive deriveArchetype to the target code.
const CASES = [
  { code: "A1", state: makeState({ experience_level: "reactivator", archetype_flags: { recent_inactivity_months: 24 } }) },
  { code: "A2", state: makeState({ experience_level: "experienced", archetype_flags: { recent_inactivity_months: 8 } }) },
  { code: "A3", state: makeState({ experience_level: "starter" }) },
  { code: "A5", state: makeState({ experience_level: "active", training_history_cross_modal: true }) },
  { code: "A6", state: makeState({ experience_level: "active", archetype_flags: { postpartum_months: 4 } }) },
  { code: "A8", state: makeState({ experience_level: "active", archetype_flags: { age: 65 } }) },
  // F7: in-contract per the UI deriver, but NOT yet in the engine ARCHETYPES
  // enum (pending PD ruling). Expected to throw a clean ContractError — that
  // is the documented, bounded behaviour, not a regression.
  { code: "F7", state: makeState({ experience_level: "active", archetype_flags: { age: 16 } }), expectContractError: true },
];

console.log("=".repeat(72));
console.log("AC3 — per-archetype path: deriveArchetype → converter → engine");
console.log("=".repeat(72));

const passList = [];
for (const c of CASES) {
  // Mirror the real UI: deriveArchetype writes detected_archetype into state.
  const derived = deriveArchetype(c.state);
  c.state.detected_archetype = derived;

  console.log(`\n[${c.code}] derived=${JSON.stringify(derived)}`);
  ok(derived === c.code, `deriveArchetype emits short code "${c.code}" (no verbose slug)`);
  ok(!String(derived).includes("_"), `"${derived}" contains no underscore (canonical short form)`);

  if (c.expectContractError) {
    let threw = null;
    try {
      buildFirstWeekProgram(convertPreludeToEngineInput(c.state));
    } catch (e) {
      threw = e;
    }
    ok(threw instanceof ContractError, `F7 throws a clean ContractError (bounded, pending PD)`);
    ok(
      threw && threw.path === "$.user_profile.detected_archetype",
      `F7 ContractError points at $.user_profile.detected_archetype`
    );
    if (threw) console.log(`       ↳ ${threw.message}`);
    passList.push(`${c.code} (clean ContractError — pending PD)`);
    continue;
  }

  const input = convertPreludeToEngineInput(c.state);
  ok(input.user_profile.detected_archetype === c.code, `converter writes short "${c.code}" into engine input`);
  const program = buildFirstWeekProgram(input);
  ok(program && Array.isArray(program.sessions) && program.sessions.length > 0, `engine builds a non-empty program`);
  console.log(`       ↳ engine OK: ${program.sessions.length} sessions, goal=${program.goal.goal_id}, v=${program.meta.engine_version}`);
  passList.push(`${c.code} → ${program.sessions.length} sessions`);
}

console.log("\n" + "=".repeat(72));
console.log("AC4 — converter-side normalize (defense-in-depth)");
console.log("=".repeat(72));
// A verbose value passed DIRECTLY to the converter (stale client / future
// source) must normalize to the short code, not slip through.
const verbosePrelude = clone(CASES[1].state); // the A2 case
verbosePrelude.detected_archetype = "A2_returning_athlete";
const normInput = convertPreludeToEngineInput(verbosePrelude);
ok(normInput.user_profile.detected_archetype === "A2", `"A2_returning_athlete" normalizes to "A2" in the converter`);
const normProgram = buildFirstWeekProgram(normInput);
ok(normProgram.sessions.length > 0, `verbose-input program builds after normalize`);

console.log("\n" + "=".repeat(72));
console.log("AC1 — A2 verbose archetype path completes to a valid engine call (Screen 9)");
console.log("=".repeat(72));
// Reproduce the exact symptom path end-to-end and show it now completes.
const a2 = clone(CASES[1].state);
a2.detected_archetype = "A2_returning_athlete"; // the value that threw at Screen 8
const trace = buildFirstWeekProgram(convertPreludeToEngineInput(a2));
console.log(JSON.stringify({
  engine_input_archetype: convertPreludeToEngineInput(a2).user_profile.detected_archetype,
  program: {
    engine_version: trace.meta.engine_version,
    goal: trace.goal,
    sessions: trace.sessions.length,
    first_session: trace.sessions[0]?.title ?? trace.sessions[0]?.focus ?? "(session)",
  },
}, null, 2));
ok(trace.sessions.length > 0, `A2 verbose path → valid program (Screen 9 renders)`);

console.log("\n" + "=".repeat(72));
console.log("AC6 — determinism (build each case twice, deep-equal)");
console.log("=".repeat(72));
let detOk = true;
for (const c of CASES) {
  if (c.expectContractError) continue;
  const a = JSON.stringify(buildFirstWeekProgram(convertPreludeToEngineInput(c.state)));
  const b = JSON.stringify(buildFirstWeekProgram(convertPreludeToEngineInput(c.state)));
  if (a !== b) { detOk = false; console.log(`  FAIL  ${c.code} non-deterministic`); }
}
ok(detOk, `all archetype programs are deterministic across runs`);

console.log("\n" + "=".repeat(72));
console.log("Per-archetype pass list:");
for (const p of passList) console.log(`  • ${p}`);
console.log("=".repeat(72));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
