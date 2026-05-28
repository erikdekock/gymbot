/**
 * Matching engine — deterministic profile → first-week-program function.
 *
 * Implements DS-01 v1.0 read-flow §2 plus the L5 Spec §9 carry-forward rules:
 *   - failure-type-conditioned fallback (FLAG 1)
 *   - L4 canonical for deload / macrocycle numbers
 *   - L5 Foundation for coupling-specific rules
 *
 * Pure function: `buildFirstWeekProgram(input)` → program object. No LLM,
 * no async, no timeout/fallback machinery. Throws if it can't build a
 * valid program. (Bug to fix at build time, per 12.3a brief.)
 */

import { getCouplingEntry, getExercise, getLayer5 } from "./kb-loader.mjs";
import { runHardFilters } from "./filters.mjs";
import { getTemplateSpec, MOVEMENT_PREP_DURATION, COOLDOWN_DURATION, TEMPLATE_SPECS } from "./template-slots.mjs";
import { loadPlaceholderFor } from "./load-calculator.mjs";
import { validateEngineInput } from "./schema.mjs";

const ENGINE_VERSION = "12.3a";

/**
 * DS-01 §3.6 phase resolution.
 *
 * Read order:
 *  1. `goal.current_phase` if explicitly set → use it.
 *  2. Comeback persona signal (from converter flags) → phase_1 if no
 *     reported lifts, else phase_2 (DS-01 §9.1 VF-A1 pattern).
 *  3. Non-comeback → pick the latest phase whose eligible templates
 *     contain the most encoded entries in TEMPLATE_SPECS (deterministic
 *     coverage signal). Tie-break by latest phase ordinal — per L5 Spec
 *     §9 FLAG 2 ordinal mapping for non-comeback users.
 */
function resolvePhase(input, entry) {
  if (entry.eligible_templates.type !== "phased") return null;
  if (input.goal.current_phase) return input.goal.current_phase;

  const flags = input.user_profile.flags || {};
  const comeback = flags.comeback_persona === true;
  if (comeback) {
    const hasLifts = Object.values(input.user_profile.reported_lifts).some(
      (v) => typeof v === "number" && v > 0
    );
    return hasLifts ? "phase_2" : "phase_1";
  }

  let best = null;
  for (const phaseBlock of entry.eligible_templates.phases) {
    const coverage = phaseBlock.eligible_templates.filter(
      (o) => o.template_id in TEMPLATE_SPECS
    ).length;
    if (!best || coverage > best.coverage || (coverage === best.coverage && comparePhaseOrdinal(phaseBlock.phase, best.phase) > 0)) {
      best = { phase: phaseBlock.phase, coverage };
    }
  }
  return best ? best.phase : "phase_1";
}

const PHASE_ORDINAL = { phase_1: 1, phase_2: 2, phase_3: 3 };
function comparePhaseOrdinal(a, b) {
  return PHASE_ORDINAL[a] - PHASE_ORDINAL[b];
}

/**
 * Walk the L5 entry's eligible_templates and return the ordered list of
 * candidate template_ids for the active phase (or single block).
 */
function eligibleTemplateIds(entry, phase) {
  if (entry.eligible_templates.type === "single_block") {
    return entry.eligible_templates.options
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((o) => o.template_id);
  }
  const block = entry.eligible_templates.phases.find((p) => p.phase === phase);
  if (!block) {
    throw new Error(
      `[engine] L5 ${entry.goal_id} has no phase block for ${phase}; available: ${entry.eligible_templates.phases.map((p) => p.phase).join(",")}`
    );
  }
  return block.eligible_templates
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((o) => o.template_id);
}

/**
 * DS-01 §4.3 prescriptive selection: walk L5 order, take the first
 * template_id that has a slot encoding in TEMPLATE_SPECS. Non-coverage
 * is non-fatal here (alpha scope limits encoded templates); the engine
 * falls through to the next listed option.
 */
function selectTemplates(orderedIds, sessionsTarget) {
  const selected = [];
  const dropped = [];
  for (const id of orderedIds) {
    try {
      const spec = getTemplateSpec(id);
      selected.push(spec);
    } catch {
      dropped.push({ template_id: id, reason: "not encoded in TEMPLATE_SPECS (alpha scope)" });
    }
  }
  if (selected.length === 0) {
    throw new Error(
      `[engine] no encoded template among L5 options [${orderedIds.join(",")}]`
    );
  }
  return { primary: selected[0], all: selected, dropped };
}

/**
 * Fallback walker for a slot when the slot's L1-ordered candidate list is
 * exhausted by hard-filter failures. Carry-forward rules per L5 Spec §9:
 *
 *   - CONTRA failure → re-walk the slot's L1 candidate pool, re-filtered
 *     against contra+equipment+difficulty. (NOT the failed exercise's
 *     sub_alt list — sub_alts are similarity-biased and will re-fail.)
 *   - EQUIPMENT failure → walk the failed exercise's substitution_alternatives
 *     first (re-filtered); on exhaustion fall through to the slot pool.
 *
 * The slot's L1 candidate pool is the slot's `candidates[]` array minus
 * already-tried ids.
 */
function fallbackForSlot({ slot, failedExercise, failure, userProfile, triedIds }) {
  const slotPool = slot.candidates.filter((id) => !triedIds.has(id));
  const tertiarySubAlts = (failedExercise.substitution_alternatives || [])
    .filter((s) => !s.external && s.exercise_id && !triedIds.has(s.exercise_id))
    .sort((a, b) => a.order - b.order)
    .map((s) => s.exercise_id);

  const path = [];
  let primary, secondary;

  if (failure.failure_type === "contraindication") {
    primary = slotPool;
    secondary = tertiarySubAlts;
    path.push("contra_failure → slot_pool", "contra_failure → sub_alt (tertiary)");
  } else if (failure.failure_type === "equipment") {
    primary = tertiarySubAlts;
    secondary = slotPool;
    path.push("equipment_failure → sub_alt", "equipment_failure → slot_pool");
  } else if (failure.failure_type === "skill_gate") {
    primary = failure.fallback_exercise_id ? [failure.fallback_exercise_id] : [];
    secondary = slotPool;
    path.push("skill_gate_failure → SKILL_GATES fallback", "skill_gate_failure → slot_pool");
  } else {
    primary = slotPool;
    secondary = tertiarySubAlts;
    path.push("difficulty_failure → slot_pool", "difficulty_failure → sub_alt");
  }

  for (const id of [...primary, ...secondary]) {
    if (triedIds.has(id)) continue;
    triedIds.add(id);
    const ex = getExercise(id);
    const r = runHardFilters(ex, userProfile);
    if (r.pass) {
      return { exercise: ex, path };
    }
  }
  return null;
}

/**
 * Resolve a single slot: pick the first L1 candidate that passes filters;
 * on failure, run fallback. Emits an `applied_substitutions` entry if the
 * default was replaced.
 */
function resolveSlot(slot, userProfile, substitutions) {
  if (slot.candidates.length === 0) return null;
  const triedIds = new Set();
  const defaultId = slot.candidates[0];
  let firstFailure = null;
  let firstFailedExercise = null;

  for (const id of slot.candidates) {
    triedIds.add(id);
    const ex = getExercise(id);
    const r = runHardFilters(ex, userProfile);
    if (r.pass) {
      if (id !== defaultId) {
        // Tag the fallback path according to the first-failure type per the
        // L5 Spec §9 FLAG 1 carry-forward rule:
        //   CONTRA failure → "L1 slot-pool re-filtered against CONTRA_MAP"
        //   EQUIPMENT failure → sub_alt walk would come first, but if the
        //                       primary's sub_alt is itself in the slot pool
        //                       this still counts as slot_pool order.
        const pathLabel =
          firstFailure?.failure_type === "contraindication"
            ? "contra_failure → L1_slot_pool (re-filtered against CONTRA_MAP)"
            : "l1_slot_pool_walk_in_order";
        substitutions.push({
          slot: slot.slot,
          from_exercise_id: defaultId,
          to_exercise_id: id,
          failure_type: firstFailure?.failure_type ?? "unknown",
          reason: firstFailure ? firstFailure.reason : "default-failed-walk-l1-list",
          fallback_path: [pathLabel],
        });
      }
      return ex;
    }
    if (!firstFailure) {
      firstFailure = r;
      firstFailedExercise = ex;
    }
  }

  const fb = fallbackForSlot({
    slot,
    failedExercise: firstFailedExercise,
    failure: firstFailure,
    userProfile,
    triedIds,
  });
  if (fb) {
    substitutions.push({
      slot: slot.slot,
      from_exercise_id: defaultId,
      to_exercise_id: fb.exercise.id,
      reason: firstFailure.reason,
      fallback_path: fb.path,
    });
    return fb.exercise;
  }
  throw new Error(
    `[engine] slot ${slot.slot} unresolvable: every candidate failed and no fallback succeeded. tried=${[...triedIds].join(",")}`
  );
}

/**
 * Build the exercises array for a single L1 day variant.
 */
function buildSession({ template, variant, dayOfWeek, userProfile, archetype, substitutions, alerts }) {
  const phases = [
    { phase: "movement_prep", duration_min: MOVEMENT_PREP_DURATION, exercises: [] },
  ];

  for (const slot of variant.slots) {
    const ex = resolveSlot(slot, userProfile, substitutions);
    if (!ex && slot.candidates.length > 0) {
      alerts.push({ severity: "alert", message: `slot ${slot.slot} dropped — no exercise resolved` });
      continue;
    }
    const entry = {
      slot: slot.slot,
      slot_role: slot.slot_role,
      duration_min: slot.duration_min,
      set_rep_scheme: slot.set_rep_scheme,
      rpe_target: slot.rpe_target,
    };
    if (ex) {
      entry.exercise_id = ex.id;
      entry.exercise_name = ex.name;
      entry.load_placeholder = loadPlaceholderFor(ex, userProfile, archetype);
    } else {
      entry.exercise_id = null;
      entry.exercise_name = null;
      entry.load_placeholder = null;
    }
    phases.push(entry);
  }

  phases.push({ phase: "cooldown", duration_min: COOLDOWN_DURATION, exercises: [] });

  return {
    day_of_week: dayOfWeek,
    template_id: template.template_id,
    template_display_name: template.display_name,
    day_variant: variant.name,
    session_focus: template.focus,
    phases,
  };
}

/**
 * DS-01 §3.1 frequency cap. Reads the L5 frequency_coupling array; finds the
 * row matching the active phase (or `phase: null`); clamps the user's
 * days_per_week into [min,max]. If the user asks for more days than the
 * primary template covers, the L5 entry's secondary templates are added.
 *
 * Returns an ordered list of { template, variant_name } pairs of length
 * `days_count`.
 */
function planWeek({ entry, phase, primary, all, daysPerWeek, alerts }) {
  // Find the L5 frequency row that matches the active phase
  const freqRows = entry.frequency_coupling.filter((f) => f.phase === phase || f.phase === null);
  // Single phased row + single null row both legal; pick the phase-specific
  // row when present.
  const primaryFreq = freqRows.find((f) => f.phase === phase) || freqRows[0];
  if (!primaryFreq) {
    throw new Error(`[engine] no L5 frequency_coupling row matches phase ${phase} for goal ${entry.goal_id}`);
  }
  let strengthDays = Math.max(primaryFreq.min_days, Math.min(daysPerWeek, primaryFreq.max_days));
  if (daysPerWeek > primaryFreq.max_days) {
    alerts.push({
      severity: "warning",
      message: `frequency_capped: user days_per_week=${daysPerWeek} > L5 max=${primaryFreq.max_days}; capped`,
    });
  }
  if (daysPerWeek < primaryFreq.min_days) {
    alerts.push({
      severity: "warning",
      message: `frequency_short: user days_per_week=${daysPerWeek} < L5 min=${primaryFreq.min_days}; using min`,
    });
  }

  // Secondary template count = max(0, sum of all non-primary frequency rows).
  // Only emitted when goal has explicit multi-row frequency (Run + Strength
  // pattern, e.g. C2: "5-6 sessions/week" + "Strength 1-2×/week").
  let secondaryDays = 0;
  for (const row of entry.frequency_coupling) {
    if (row === primaryFreq) continue;
    if (row.phase !== null && row.phase !== phase) continue;
    secondaryDays += row.min_days;
  }

  const totalRequested = strengthDays + secondaryDays;
  // For multi-row goals, the L5 strength row min is the conditioning min
  // and the strength row is the secondary. Re-balance to user days_per_week.
  let plan = [];
  if (entry.frequency_coupling.length > 1 && secondaryDays > 0) {
    // C2-pattern: primary=conditioning (Run), secondary=strength.
    // Honor the secondary row's minimum first (the strength-maintenance
    // session is the load-bearing safety signal for a run goal); allocate
    // the rest to the primary. If the resulting primary count is below the
    // primary row's min, emit a frequency_short alert but do NOT silently
    // clamp up — clamping up here would drop the strength session and
    // silently violate the secondary row's min.
    const secondaryAllocate = Math.min(secondaryDays, daysPerWeek);
    const primaryAllocate = Math.max(0, daysPerWeek - secondaryAllocate);
    if (primaryAllocate < primaryFreq.min_days) {
      alerts.push({
        severity: "warning",
        message: `frequency_short: primary count=${primaryAllocate} < primary min=${primaryFreq.min_days} after honoring secondary min=${secondaryAllocate}`,
      });
    }

    const secondaryTemplate = all.find((t) => t.template_id !== primary.template_id);
    for (let i = 0; i < primaryAllocate; i++) {
      const variantName = pickVariant(primary, i, primaryAllocate);
      plan.push({ template: primary, variant_name: variantName, role: "primary" });
    }
    if (secondaryTemplate) {
      for (let i = 0; i < secondaryAllocate; i++) {
        const variantName = pickVariant(secondaryTemplate, i, secondaryAllocate);
        plan.push({ template: secondaryTemplate, variant_name: variantName, role: "secondary" });
      }
    }
  } else {
    // Single-row goal: rotate day_variants of the primary template across
    // `strengthDays`. If days > number of encoded variants, repeat. If
    // additional encoded templates exist in L5 (e.g. C4 phase_2 mixes
    // full-body + run + lower-posterior + upper-push-pull), distribute the
    // remaining day budget across them in L5 order.
    let dayBudget = strengthDays;
    let templateIdx = 0;
    while (dayBudget > 0 && templateIdx < all.length) {
      const tpl = all[templateIdx];
      const variants = tpl.day_variants;
      const dayCountForThisTemplate =
        templateIdx === 0
          ? Math.min(dayBudget, variants.length || 1)
          : 1; // secondary templates get 1 session in alpha scope
      for (let i = 0; i < dayCountForThisTemplate; i++) {
        const variantName = pickVariant(tpl, i, dayCountForThisTemplate);
        plan.push({ template: tpl, variant_name: variantName, role: templateIdx === 0 ? "primary" : "secondary" });
        dayBudget--;
        if (dayBudget === 0) break;
      }
      templateIdx++;
    }
    // Any remaining budget is filled by repeating the primary's first variant.
    while (dayBudget > 0) {
      plan.push({ template: primary, variant_name: primary.day_variants[0].name, role: "primary" });
      dayBudget--;
    }
  }
  return plan;
}

function pickVariant(template, index, count) {
  const variants = template.day_variants;
  if (variants.length === 0) return "default";
  return variants[index % variants.length].name;
}

/**
 * Main entry point: validate input, run DS-01 read-flow, emit program object.
 */
export function buildFirstWeekProgram(input) {
  validateEngineInput(input);

  const entry = getCouplingEntry(input.goal.goal_id);
  const phase = resolvePhase(input, entry);

  const orderedIds = eligibleTemplateIds(entry, phase);
  const { primary, all, dropped } = selectTemplates(orderedIds);

  const substitutions = [];
  const alerts = [];
  if (dropped.length > 0) {
    for (const d of dropped) {
      alerts.push({ severity: "info", message: `template ${d.template_id} dropped: ${d.reason}` });
    }
  }

  const plan = planWeek({
    entry,
    phase,
    primary,
    all,
    daysPerWeek: input.user_profile.days_per_week,
    alerts,
  });

  const sessions = plan.map((slot, idx) => {
    const variant =
      slot.template.day_variants.find((v) => v.name === slot.variant_name) ||
      slot.template.day_variants[0];
    return buildSession({
      template: slot.template,
      variant,
      dayOfWeek: idx,
      userProfile: input.user_profile,
      archetype: input.user_profile.detected_archetype,
      substitutions,
      alerts,
    });
  });

  return {
    meta: {
      engine_version: ENGINE_VERSION,
      kb_l5_version: getLayer5().version,
      generated_at: null, // intentionally null — determinism requires no timestamp
    },
    goal: {
      goal_id: entry.goal_id,
      goal_name: entry.name,
      goal_phase: phase,
      goal_provisional: input.goal.goal_provisional,
    },
    macrocycle: {
      pattern: "MEV → MAV → MRV",
      weeks_total: 12,
      mesocycles: 3,
      mesocycle_weeks: 4,
      current_mesocycle_week: 1,
      is_special_week: null,
    },
    templates_selected: plan.map((p) => ({
      template_id: p.template.template_id,
      role: p.role,
      day_variant: p.variant_name,
    })),
    sessions,
    applied_substitutions: substitutions,
    engine_alerts: alerts,
  };
}

export { ENGINE_VERSION };
