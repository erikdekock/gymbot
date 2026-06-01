/**
 * DIAGNOSTIC HARNESS (throwaway) — alpha-blocker knee contra trace.
 * Does NOT modify engine behaviour. Imports engine internals read-only and
 * replays runHardFilters per candidate to surface the pass/fail trace.
 */
import { buildFirstWeekProgram } from "../lib/engine/index.mjs";
import { getExercise, getCouplingEntry } from "../lib/engine/kb-loader.mjs";
import { runHardFilters } from "../lib/engine/filters.mjs";
import { getTemplateSpec, TEMPLATE_SPECS } from "../lib/engine/template-slots.mjs";

function erikProfile({ comeback }) {
  // A2 returning athlete, full gym, knee contra, realistic A2 lifts.
  return {
    user_profile: {
      experience_level: "active", // returning athlete w/ pattern memory
      days_per_week: 4,
      equipment_available: ["full_gym"],
      bodyweight_kg: 85,
      reported_lifts: { squat: 120, deadlift: 160, bench: 90, ohp: 55, row: 80 },
      contraindications: ["knee"],
      detected_archetype: "A2",
      recent_inactivity_months: comeback ? 8 : null,
      age: 34,
      training_history_cross_modal: false,
      flags: { comeback_persona: comeback },
    },
    goal: { goal_id: "A2", goal_provisional: false, current_phase: null },
  };
}

function traceSlot(slot, up) {
  console.log(`\n  SLOT ${slot.slot} (${slot.slot_role}) candidates=[${slot.candidates.join(",")}]`);
  if (slot.candidates.length === 0) { console.log("    (protocol slot, no L8 fill)"); return; }
  let firstFail = null, firstFailEx = null;
  const tried = new Set();
  for (const id of slot.candidates) {
    tried.add(id);
    const ex = getExercise(id);
    const r = runHardFilters(ex, up);
    console.log(`    PRIMARY #${id} ${ex.name} [${ex.movement_pattern.family}] -> ${r.pass ? "PASS" : "FAIL: " + r.reason}`);
    if (r.pass) { console.log("    => resolved by primary walk"); return; }
    if (!firstFail) { firstFail = r; firstFailEx = ex; }
  }
  // replicate fallbackForSlot
  const slotPool = slot.candidates.filter((id) => !tried.has(id));
  const subAlts = (firstFailEx.substitution_alternatives || [])
    .filter((s) => !s.external && s.exercise_id && !tried.has(s.exercise_id))
    .sort((a, b) => a.order - b.order).map((s) => s.exercise_id);
  let primary, secondary, label;
  if (firstFail.failure_type === "contraindication") { primary = slotPool; secondary = subAlts; label = "contra"; }
  else if (firstFail.failure_type === "equipment") { primary = subAlts; secondary = slotPool; label = "equipment"; }
  else { primary = slotPool; secondary = subAlts; label = firstFail.failure_type; }
  console.log(`    -- fallback (first failure=${firstFail.failure_type}) order: [${label}] slotPool-remaining=[${slotPool.join(",")}] subAlts=[${subAlts.join(",")}]`);
  let resolved = false;
  for (const id of [...primary, ...secondary]) {
    if (tried.has(id)) continue;
    tried.add(id);
    const ex = getExercise(id);
    const r = runHardFilters(ex, up);
    console.log(`    FALLBACK #${id} ${ex.name} [${ex.movement_pattern.family}] -> ${r.pass ? "PASS" : "FAIL: " + r.reason}`);
    if (r.pass) { resolved = true; break; }
  }
  if (!resolved) console.log(`    !!! UNRESOLVABLE. tried=${[...tried].join(",")}`);
}

for (const comeback of [false, true]) {
  console.log("\n========================================================");
  console.log(`ERIK A2 — comeback_persona=${comeback}`);
  console.log("========================================================");
  const input = erikProfile({ comeback });
  const up = input.user_profile;
  // Determine which template(s) get picked by actually running the engine.
  try {
    const prog = buildFirstWeekProgram(input);
    console.log("ENGINE OK. phase=", prog.goal.goal_phase);
    console.log("templates:", prog.templates_selected.map((t) => t.template_id + "/" + t.day_variant).join(", "));
  } catch (e) {
    console.log("ENGINE THREW:", e.message);
    // Walk the templates that WOULD be built to find the offending slot(s).
    const entry = getCouplingEntry("A2");
    // brute: trace every template that has a squat/lower slot across the pool
    const candidatesTpls = comeback
      ? ["returning-athlete-p1-reentry-3d"]
      : ["lower-posterior", "upper-push-pull", "lower-anterior", "upper-core", "full-body"];
    for (const tid of candidatesTpls) {
      const spec = getTemplateSpec(tid);
      console.log(`\n  --- TEMPLATE ${tid} ---`);
      for (const v of spec.day_variants) {
        console.log(` VARIANT ${v.name}`);
        for (const slot of v.slots) traceSlot(slot, up);
      }
    }
  }
}
