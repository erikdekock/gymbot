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

function main() {
  const wantJson = process.argv.includes("--json");
  const out = { ac1: {}, ac2: [], ac3: {}, ac4: {} };

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

  // AC2: engine produces a complete first-week program for all three.
  const runs = {};
  for (const name of Object.keys(FIXTURES)) {
    try {
      const result = runFixture(name, FIXTURES[name]);
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
  for (const name of Object.keys(FIXTURES)) {
    const r1 = runFixture(name, FIXTURES[name]);
    const r2 = runFixture(name, FIXTURES[name]);
    out.ac4[name] = {
      hash_run_1: r1.hash,
      hash_run_2: r2.hash,
      identical: r1.hash === r2.hash,
    };
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
  console.log("\nDone.");
}

main();
