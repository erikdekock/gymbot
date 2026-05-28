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
 * Entry-phase doctrine — L5/L8 Spec §10 + §11 amendments (supersedes the
 * §9 FLAG 2 "max encoded coverage, latest ordinal" generalisation that
 * 12.3a shipped). §11 extends rule 3 enumeration to include C4 and adds
 * the phase-awareness guard for goals whose non-comeback carve-out is a
 * parallel non-phased branch.
 *
 * For any phase-aware goal at signup (`goal.current_phase` null):
 *   1. Default = Phase 1.
 *   2. Clinical-progression goals (E1–E6 rehab, F4 postpartum, F1–F3
 *      pregnancy): ALWAYS Phase 1. Hard-locked. Latest-ordinal never applies.
 *      Progression is gated by L4 clinical achievement markers + medical
 *      clearance, not auto-advanced at signup.
 *   3. Comeback-arc goals (A1, A5, C4, E7) with comeback persona: entry by
 *      retained-capacity attribute — reported lifts present OR experience
 *      ≥ active → Phase 2; cold / starter / no reported lifts → Phase 1.
 *      Phase 3 is reached only by progression, never as a signup entry.
 *   4. A2 returning-athlete persona ONLY: non-comeback (trained, no
 *      extended pause) → trained-user templates (phase_3-equivalent), via
 *      the latest-ordinal-with-coverage signal. SOLE legitimate
 *      "skip to latest" case; keyed on the explicit non-comeback condition.
 *
 * Non-comeback carve-outs (§11):
 *   - Nested in Phase 1 block (A1, A5, E7): engine returns `phase_1` and
 *     within-phase template selection (condition-first, then order) picks
 *     the non-comeback option from the phase_1 list.
 *   - Parallel non-phased branch (C4): engine returns `goal_phase = null`
 *     (phase-awareness guard) and walks the non-comeback template pool —
 *     the broadest phase block filtered to non-comeback-keyed templates.
 *
 * If `goal.current_phase` is explicitly set on input it overrides everything
 * — that is the in-app progression path (L4 markers fired).
 */
const CLINICAL_PROGRESSION_GOALS = new Set(["E1", "E2", "E3", "E4", "E5", "E6", "F1", "F2", "F3", "F4"]);
const COMEBACK_ARC_GOALS = new Set(["A1", "A5", "C4", "E7"]);
// Goals whose non-comeback carve-out is a parallel non-phased branch
// (single-block / trained-user templates, `goal_phase = null`). Per §11
// only C4 lands here today; A1/A5/E7 nest the carve-out inside phase_1.
const NONCOMEBACK_PARALLEL_BRANCH_GOALS = new Set(["C4"]);
const TRAINED_EXPERIENCE = new Set(["active", "experienced"]);

// Comeback-keyed template-id prefixes. Used by the §11 phase-awareness
// guard to derive the non-comeback template pool until B6 populates the
// per-option `condition` field (see TODO in selectTemplatesByCondition).
const COMEBACK_KEYED_PREFIXES = ["reactivator-", "hybrid-in-comeback-", "returning-athlete-"];

function isComebackKeyedTemplate(templateId) {
  return COMEBACK_KEYED_PREFIXES.some((p) => templateId.startsWith(p));
}

function hasReportedLifts(userProfile) {
  return Object.values(userProfile.reported_lifts).some(
    (v) => typeof v === "number" && v > 0
  );
}

function hasRetainedCapacity(userProfile) {
  return hasReportedLifts(userProfile) || TRAINED_EXPERIENCE.has(userProfile.experience_level);
}

function pickLatestOrdinalWithCoverage(entry) {
  let best = null;
  for (const phaseBlock of entry.eligible_templates.phases) {
    const coverage = phaseBlock.eligible_templates.filter(
      (o) => o.template_id in TEMPLATE_SPECS
    ).length;
    if (
      !best ||
      coverage > best.coverage ||
      (coverage === best.coverage && comparePhaseOrdinal(phaseBlock.phase, best.phase) > 0)
    ) {
      best = { phase: phaseBlock.phase, coverage };
    }
  }
  return best ? best.phase : "phase_1";
}

function resolvePhase(input, entry) {
  if (entry.eligible_templates.type !== "phased") return null;
  if (input.goal.current_phase) return input.goal.current_phase;

  const goalId = entry.goal_id;
  const userProfile = input.user_profile;
  const flags = userProfile.flags || {};
  const comeback = flags.comeback_persona === true;

  // Rule 2 — clinical-progression goals: hard-locked to Phase 1. SAFETY.
  if (CLINICAL_PROGRESSION_GOALS.has(goalId)) return "phase_1";

  // Rule 4 — A2 non-comeback: trained-user templates (phase_3-equiv).
  //          SOLE latest-ordinal case.
  if (goalId === "A2" && !comeback) return pickLatestOrdinalWithCoverage(entry);

  // §11 phase-awareness guard — non-comeback on a goal with a parallel
  // non-phased carve-out (C4): return null. Template selection then walks
  // the non-comeback pool (eligibleTemplateIds handles the null + goalId).
  if (NONCOMEBACK_PARALLEL_BRANCH_GOALS.has(goalId) && !comeback) return null;

  // Rule 3 — comeback-arc goals (A1, A5, C4, E7) with comeback persona:
  //          retained-capacity gate → Phase 2 / Phase 1.
  if (COMEBACK_ARC_GOALS.has(goalId) && comeback) {
    return hasRetainedCapacity(userProfile) ? "phase_2" : "phase_1";
  }

  // Rule 1 — default Phase 1 (incl. A2 comeback, non-comeback on a
  //          comeback-arc goal without a parallel branch, any other
  //          phased goal at signup).
  return "phase_1";
}

const PHASE_ORDINAL = { phase_1: 1, phase_2: 2, phase_3: 3 };
function comparePhaseOrdinal(a, b) {
  return PHASE_ORDINAL[a] - PHASE_ORDINAL[b];
}

/**
 * Walk the L5 entry's eligible_templates and return the ordered candidate
 * options for the active phase. Options carry `{template_id, order,
 * condition?}` so downstream selection can run §11's condition-first rule.
 *
 * When `phase` is null on a phased entry the engine is on the §11 parallel
 * non-phased branch (C4 non-comeback today): the pool is derived from the
 * broadest phase block (max template count) with comeback-keyed templates
 * filtered out. Until B6 populates the per-option `condition` field, the
 * template_id-prefix heuristic is the deterministic discriminator.
 */
function eligibleTemplateOptions(entry, phase) {
  if (entry.eligible_templates.type === "single_block") {
    return entry.eligible_templates.options
      .slice()
      .sort((a, b) => a.order - b.order);
  }
  if (phase === null) {
    // §11 phase-awareness guard — pick the broadest phase block (most
    // options encoded in L5) and strip comeback-keyed templates so we
    // emit the trained-user / non-comeback subset.
    let broadest = entry.eligible_templates.phases[0];
    for (const p of entry.eligible_templates.phases) {
      if (p.eligible_templates.length > broadest.eligible_templates.length) broadest = p;
    }
    const filtered = broadest.eligible_templates
      .slice()
      .filter((o) => !isComebackKeyedTemplate(o.template_id))
      .sort((a, b) => a.order - b.order);
    if (filtered.length === 0) {
      throw new Error(
        `[engine] L5 ${entry.goal_id} non-comeback branch: no non-comeback-keyed templates in broadest phase ${broadest.phase}`
      );
    }
    return filtered;
  }
  const block = entry.eligible_templates.phases.find((p) => p.phase === phase);
  if (!block) {
    throw new Error(
      `[engine] L5 ${entry.goal_id} has no phase block for ${phase}; available: ${entry.eligible_templates.phases.map((p) => p.phase).join(",")}`
    );
  }
  return block.eligible_templates
    .slice()
    .sort((a, b) => a.order - b.order);
}

/**
 * Evaluate whether a user profile satisfies a per-option `condition` string.
 * Populated values seen so far are short qualifier phrases per the B6 spec
 * (example: "non-comeback / no extended pause"). Recognised qualifiers:
 *   - "non-comeback / no extended pause"  → comeback_persona === false
 *   - "time-constrained"                  → no profile signal, treat as
 *                                           satisfied so the option survives
 *
 * Unknown qualifier → treat as satisfied (don't silently drop options the
 * engine doesn't understand). All unknown qualifiers warn via the alerts
 * channel at the call site so v1.1 can extend the matcher.
 */
function conditionSatisfied(condition, userProfile) {
  if (!condition) return { matched: null, satisfied: true };
  const lc = condition.toLowerCase();
  const flags = userProfile.flags || {};
  if (/non-?comeback|no extended pause/.test(lc)) {
    return { matched: "non-comeback", satisfied: flags.comeback_persona !== true };
  }
  if (/time-constrained/.test(lc)) {
    return { matched: "time-constrained", satisfied: true };
  }
  return { matched: "unknown", satisfied: true };
}

/**
 * §11 within-phase selection — condition-first, then order:
 *   1. Drop options whose `condition` is present and NOT satisfied.
 *   2. If any surviving option has a satisfied (non-empty) `condition`,
 *      those condition-matched options take precedence over unconditioned
 *      defaults (a matched condition is the more specific signal).
 *   3. Order tie-breaks within the surviving specificity tier.
 *
 * The encoded-template filter (alpha-scope TEMPLATE_SPECS coverage) runs
 * AFTER the specificity filter so a fall-through to a non-coverage option
 * is recorded as dropped, not as an order-bypass.
 */
function selectTemplates(orderedOptions, userProfile, alerts) {
  // Step 1 — condition filter.
  const surviving = [];
  for (const opt of orderedOptions) {
    const { matched, satisfied } = conditionSatisfied(opt.condition, userProfile);
    if (matched === "unknown" && opt.condition) {
      alerts.push({
        severity: "info",
        message: `template ${opt.template_id} carries unrecognised condition="${opt.condition}" — kept as satisfied (extend matcher in v1.1)`,
      });
    }
    if (satisfied) surviving.push(opt);
  }

  // Step 2 — specificity precedence: prefer satisfied-condition options.
  const matched = surviving.filter((o) => o.condition);
  const tier = matched.length > 0 ? matched : surviving;

  // Step 3 — within the surviving tier, walk by `order` and pick the first
  // template_id that has a slot encoding in TEMPLATE_SPECS. Non-coverage
  // falls through to the next option (alpha scope).
  const selected = [];
  const dropped = [];
  for (const opt of tier) {
    try {
      const spec = getTemplateSpec(opt.template_id);
      selected.push(spec);
    } catch {
      dropped.push({ template_id: opt.template_id, reason: "not encoded in TEMPLATE_SPECS (alpha scope)" });
    }
  }
  if (selected.length === 0) {
    throw new Error(
      `[engine] no encoded template among L5 options [${tier.map((o) => o.template_id).join(",")}]`
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

  const substitutions = [];
  const alerts = [];

  const orderedOptions = eligibleTemplateOptions(entry, phase);
  const { primary, all, dropped } = selectTemplates(orderedOptions, input.user_profile, alerts);

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
