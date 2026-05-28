/**
 * Layer 5 transform (B6, B7, B8 + medium-flag mappings) — turns faithful
 * structural L5 JSON into engine-ready Layer5Records per
 * [Spec] Layer-5 + Layer-8 Record Schemas v1.0 §2, §4.
 *
 *   B6: entry.eligible_templates → resolved, ordered, phase-structured
 *       template_id options (incl. persona-prefixed italics like A2).
 *   B7: entry.frequency_coupling → numeric {min_days,max_days,strict} per phase.
 *   B8: Foundation.frequency_defaults / combo / conditioning_patterns →
 *       resolved template_ids + goal_ids + conditioning subtype enum.
 *
 * Medium-flag transforms: entry.special_weeks_applicable mention-mapping;
 * entry.conditioning_subtypes prose → subtype enum.
 */

import { z } from "zod";
import {
  resolveTemplateId,
  scanTemplateMentions,
  normaliseName,
} from "./template-aliases.mjs";

// ---------- shared zod primitives (spec §2) ----------

export const GoalId = z.string().regex(/^[A-G][0-9]$/);
const TemplateId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const Phase = z.enum(["phase_1", "phase_2", "phase_3"]);
const ConditioningSubtype = z.enum([
  "polarized_base",
  "pyramidal_event",
  "hyrox_specific",
  "none",
]);
const SpecialWeekKind = z.enum(["deload", "race_event", "recovery", "symptom_flare"]);

const EligibleTemplateOption = z.object({
  template_id: TemplateId,
  order: z.number().int().min(1),
  condition: z.string().optional(),
});
const PhaseBlock = z.object({
  phase: Phase,
  phase_label: z.string(),
  eligible_templates: z.array(EligibleTemplateOption).min(1),
});
const EligibleTemplates = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single_block"), options: z.array(EligibleTemplateOption).min(1) }),
  z.object({ type: z.literal("phased"), phases: z.array(PhaseBlock).min(1) }),
]);

const FrequencyCoupling = z.object({
  phase: Phase.nullable(),
  min_days: z.number().int().min(1).max(7),
  max_days: z.number().int().min(1).max(7),
  strict: z.boolean(),
  breakdown: z.string().optional(),
  raw: z.string(),
});

const ConditioningCoupling = z.object({
  phase: Phase.nullable(),
  subtype: ConditioningSubtype,
  raw: z.string(),
});

const CouplingEntry = z.object({
  goal_id: GoalId,
  name: z.string(),
  cluster: z.string().regex(/^[A-G]$/),
  eligible_templates: EligibleTemplates,
  eligible_templates_context: z.string().optional(),
  frequency_coupling: z.array(FrequencyCoupling).min(1),
  conditioning_subtypes: z.array(ConditioningCoupling).min(1),
  phase_transitions_raw: z.string(),
  special_weeks_applicable: z.array(SpecialWeekKind),
  special_weeks_raw: z.string(),
  combo_session: z
    .object({
      available: z.boolean(),
      phase: Phase.optional(),
      template_ref: TemplateId.optional(),
      raw: z.string(),
    })
    .optional(),
  source_section: z.string(),
});

// Foundation sub-schemas.
const CanonicalDeload = z.object({
  volume_drop_pct: z.number().int(),
  load_drop_pct: z.number().int(),
  default_trigger: z.string(),
  raw: z.string(),
});
const MacrocycleStructure = z.object({
  pattern: z.string(),
  weeks_total: z.number().int(),
  mesocycles: z.number().int(),
  mesocycle_weeks: z.number().int(),
  load_step_pct: z.number().int(),
  raw: z.string(),
});
const FrequencyDefault = z.object({
  days: z.string(),
  default_template_ids: z.array(TemplateId),
  raw: z.string(),
});
const ConditioningPattern = z.object({
  subtype: ConditioningSubtype,
  default_goal_ids: z.array(GoalId),
  raw: z.string(),
});
const ComboSessionRule = z.object({
  available_template_ids: z.array(TemplateId),
  eligible_goal_ids: z.array(GoalId),
  raw: z.string(),
});
const SpecialWeekRule = z.object({
  kind: SpecialWeekKind,
  behaviour: z.string(),
  eligibility: z.string(),
  raw: z.string(),
});
const Foundation = z.object({
  canonical_deload: CanonicalDeload,
  macrocycle: MacrocycleStructure,
  frequency_defaults: z.array(FrequencyDefault).length(4),
  conditioning_patterns: z.array(ConditioningPattern).length(3),
  combo_session: ComboSessionRule,
  special_weeks: z.array(SpecialWeekRule).length(4),
});

export const Layer5Records = z.object({
  layer: z.literal(5),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  version: z.literal("1.0"),
  foundation: Foundation,
  coupling_entries: z.array(CouplingEntry).min(35),
});

// ---------- small helpers ----------

const PHASE_LABEL_RE = /Phase\s+(\d)/i;

function phaseEnumFor(label, ordinalIndex) {
  const m = label.match(PHASE_LABEL_RE);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 3) return `phase_${n}`;
  }
  // Persona-prefixed italics without numeric phase → fall back to ordinal.
  const n = Math.min(Math.max(ordinalIndex + 1, 1), 3);
  return `phase_${n}`;
}

/**
 * Expand a label's phase reference into the full set of phase enums it
 * covers. Handles "Phase 2-3", "Phase 1 / 2 / 3", "Phase 2/3" — each yields
 * multiple phase enums. A single "Phase N" returns `[phase_N]`. A label with
 * no numeric phase falls back to the ordinal position (single enum).
 *
 * Without this, a "Phase 2-3" block would emit only phase_2 and phase_3
 * would silently inherit from a different italic block (or go missing) —
 * exactly the collision flagged in AC5.
 */
function expandPhaseLabel(label, ordinalIndex) {
  // Match all phase-N tokens in the label, then expand ranges/lists.
  const seen = new Set();
  // First pass: ranges like "Phase 2-3" / "Phase 2–3".
  const rangeRe = /Phase\s+(\d)\s*[-–]\s*(\d)/gi;
  let m;
  while ((m = rangeRe.exec(label)) !== null) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    for (let n = start; n <= end; n++) if (n >= 1 && n <= 3) seen.add(`phase_${n}`);
  }
  // Second pass: lists like "Phase 1 / 2 / 3".
  const listRe = /Phase\s+(\d)(?:\s*\/\s*(\d))(?:\s*\/\s*(\d))?/gi;
  while ((m = listRe.exec(label)) !== null) {
    for (const g of [m[1], m[2], m[3]]) {
      if (!g) continue;
      const n = Number(g);
      if (n >= 1 && n <= 3) seen.add(`phase_${n}`);
    }
  }
  // Third pass: any remaining "Phase N" singletons.
  if (seen.size === 0) {
    const allRe = /Phase\s+(\d)/gi;
    while ((m = allRe.exec(label)) !== null) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 3) seen.add(`phase_${n}`);
    }
  }
  if (seen.size === 0) {
    // No numeric phase in label → ordinal position fallback.
    const n = Math.min(Math.max(ordinalIndex + 1, 1), 3);
    return [`phase_${n}`];
  }
  return [...seen].sort();
}

// ---------- eligible_templates (B6) ----------

/**
 * Scan a block of L5 option prose for template references and return the
 * resolved, ordered EligibleTemplateOption[]. We use a longest-alias-first
 * substring scan (via `scanTemplateMentions`) instead of punctuation-based
 * splitting because L5 prose mixes slash-lists, OR-clauses, and prose
 * commentary too freely for a clean split to survive.
 *
 * Variant-branching syntax — "(N-day or M-day variant)" — is detected here
 * and expands the base name into BOTH variant ids when both are aliased.
 *
 * Condition qualifiers ("for time-constrained users", "with peak-week
 * tapering") are not extracted per-option in the scanner approach; they live
 * in the source prose. The schema's `condition` field is reserved for
 * future tightening (the engine doesn't consume condition in v1.0).
 */
function parseOptionListScanner(text, warn) {
  if (!text) return [];
  let body = text.replace(/^\s*\([^)]*\)\s*/, "").trim();
  // Variant-branching: when a Reactivator Phase-3 reference has the
  // "(3-day or 4-day variant)" form, we want BOTH ids in the output.
  // The base scanner only picks up one (longest-alias-first), so detect the
  // syntax up-front and inject the second variant inline.
  body = body.replace(
    /(Reactivator\s+Phase\s+3\s+Capacity)\s*\(3-day\s+or\s+4-day(?:\s+variant)?\)/gi,
    "$1 (3-day) OR $1 (4-day)"
  );
  // "Hybrid-in-comeback Phase 1 / 2 / 3" → 3 separate phase references.
  // Similar "Reactivator Phase 2-3" / "Phase 2 / 3" / "Phase 2-3" patterns.
  body = body.replace(
    /([A-Za-z][A-Za-z-]*(?:\s+[A-Z][A-Za-z-]*)*)\s+Phase\s+(\d)\s*(?:\/|-|–)\s*(\d)(?:\s*(?:\/|-|–)\s*(\d))?/g,
    (m, persona, a, b, c) => {
      const parts = [a, b, c].filter(Boolean);
      return parts.map((n) => `${persona} Phase ${n}`).join(" OR ");
    }
  );

  const ids = scanTemplateMentions(body);
  return ids.map((id, i) => ({ template_id: id, order: i + 1 }));
}

/**
 * Legacy splitter parser. Retained as a fallback only — used inside
 * `parseOptionList` when the scanner returns zero ids on a non-empty text
 * (so the schema's `.min(1)` constraint doesn't fail on an entry where the
 * scanner missed something obvious).
 */
function parseOptionList(text, warn) {
  const scanned = parseOptionListScanner(text, warn);
  if (scanned.length > 0) return scanned;
  // Scanner returned nothing — fall back to the splitter so non-empty text
  // doesn't trip the schema's .min(1) constraint. If both return zero, the
  // caller decides whether to drop the (empty) phase block.
  return parseOptionListSplitter(text, warn);
}

function parseOptionListSplitter(text, warn) {
  // 1. Strip a leading parenthetical context note (handled separately by the
  //    caller via `eligible_templates_context`), but parse() may still pass
  //    one in for phase blocks — drop it here too.
  let body = text.replace(/^\s*\([^)]*\)\s*/, "").trim();

  // 2. Sentence segmentation: each sentence in the body is its own
  //    alternative group ("...4-day split. Full Body 2-day or 3-day for
  //    time-constrained users.").
  const sentences = body
    .split(/(?<=\.)\s+(?=[A-Z(])/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter(Boolean);

  const options = [];
  let order = 1;
  for (const sentence of sentences) {
    // 3. Split each sentence by " OR " (case-sensitive — lower-case "or"
    //    inside parentheticals like "(3-day or 4-day variant)" is preserved
    //    by the parenthetical guard below).
    const orParts = splitOutsideParens(sentence, /\s+OR\s+/);
    for (const raw of orParts) {
      // 4. Detect the "(N-day or M-day variant)" branching pattern. If found,
      //    emit BOTH N-day and M-day expansions of the same base name.
      const variantMatch = raw.match(/^(.*?)\s*\((\d+)-day\s+or\s+(\d+)-day(?:\s+variant)?\)(.*)$/);
      const candidates = variantMatch
        ? [
            `${variantMatch[1].trim()} (${variantMatch[2]}-day)`,
            `${variantMatch[1].trim()} (${variantMatch[3]}-day)`,
          ].map((c) => c + variantMatch[4])
        : [raw];

      for (const candidate of candidates) {
        // 5. Split a candidate on " / " if it looks like a short-code list
        //    (e.g. "Lower P / Upper PP / Lower A / Upper + Core 4-day split").
        //    The trailing suffix after the last slash ("4-day split") applies
        //    to all slash items, but for our resolver the bare codes
        //    ("Lower P") already resolve, so we apply suffixes only as fallback.
        const condBoundary = candidate.search(
          /\s+(?:for|with|when|if|where|includes\s|in\s+early|in\s+late)\s+/i
        );
        let namePart = candidate;
        let cond;
        if (condBoundary >= 0) {
          namePart = candidate.slice(0, condBoundary).trim();
          cond = candidate.slice(condBoundary).trim();
        }
        // Strip leading filler ("full", "the", "a") that L5 prose sometimes
        // prepends to enumerations.
        namePart = namePart.replace(/^(?:full|the|a|an)\s+/i, "").trim();

        const slashParts = namePart.split(/\s*\/\s*/);
        if (slashParts.length > 1) {
          // Carry a trailing N-day suffix from the LAST slash element back
          // to the earlier (suffix-less) ones — but only for resolution.
          const suffixMatch = slashParts[slashParts.length - 1].match(
            /\s+(\d+-day\s+(?:split|mix))\s*$/i
          );
          const suffix = suffixMatch ? ` ${suffixMatch[1]}` : "";
          for (const sp of slashParts) {
            const piece = sp.trim();
            if (!piece) continue;
            const id =
              resolveTemplateId(piece) ||
              resolveTemplateId(piece + suffix) ||
              resolveTemplateId(piece.replace(/\s+\d+-day.*$/, ""));
            if (id) {
              options.push({
                template_id: id,
                order: order++,
                ...(cond ? { condition: cond } : {}),
              });
            } else if (looksLikeTemplateRef(piece)) {
              warn(`unresolved template fragment: "${piece}"`);
            }
          }
        } else {
          const id = resolveTemplateId(namePart);
          if (id) {
            options.push({
              template_id: id,
              order: order++,
              ...(cond ? { condition: cond } : {}),
            });
          } else if (looksLikeTemplateRef(namePart)) {
            warn(`unresolved template fragment: "${namePart}"`);
          }
        }
      }
    }
  }
  // Deduplicate by template_id+condition (variant expansion can emit dups
  // when both N-day variants resolve to the same id).
  const seen = new Set();
  const deduped = [];
  for (const opt of options) {
    const key = `${opt.template_id}|${opt.condition || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...opt, order: deduped.length + 1 });
  }
  return deduped;
}

/** Split `s` on `re` boundaries that are NOT inside parentheses. */
function splitOutsideParens(s, re) {
  const out = [];
  let depth = 0;
  let buf = "";
  // Manual scan because JS doesn't have a clean lookbehind for parens.
  const reSource = re.source;
  const tester = new RegExp("^" + reSource);
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const rest = s.slice(i);
      const m = rest.match(tester);
      if (m) {
        out.push(buf.trim());
        buf = "";
        i += m[0].length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Best-effort filter: only warn about strings that look like they could be
 * template references (proper-cased phrase or a known short code). Avoids
 * warning on prose tails like "non-back-loaded" or "week".
 */
function looksLikeTemplateRef(s) {
  const t = s.trim();
  if (!t) return false;
  if (/^\d+×|^×|^week\b|^\d+-day\b/i.test(t)) return false;
  if (t.length < 3) return false;
  // Must start with an alpha char and contain at least one capitalised word.
  return /^[A-Z]/.test(t) && /[A-Z][a-z]/.test(t);
}

/**
 * Detect italic sub-blocks in eligible-templates markdown. Returns either
 * { type: "single_block", options } or { type: "phased", phases, leading_context }.
 *
 * Italic sub-blocks look like `*Label*: ...` at line start. The leading text
 * before the first italic block (which may be a parenthetical context note)
 * is captured as `eligible_templates_context`.
 */
function parseEligibleTemplates(md, warn) {
  // Remove the "**Eligible templates**:" marker if still present.
  const body = md.replace(/^\*\*Eligible templates\*\*:\s*/i, "").trim();
  // Find italic sub-block boundaries: lines starting with `*` immediately
  // followed by text and ending with `*:` (in markdown italic syntax).
  const lines = body.split("\n");
  const blocks = [];
  let leading = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^\s*\*([^*][^*]*?)\*:\s*(.*)$/);
    if (m) {
      if (current) blocks.push(current);
      current = { label: m[1].trim(), text: m[2] };
    } else if (current) {
      current.text += " " + line.trim();
    } else {
      leading.push(line.trim());
    }
  }
  if (current) blocks.push(current);

  const context = leading
    .join(" ")
    .replace(/^\(|\)$/g, "")
    .trim();

  if (blocks.length === 0) {
    // Pure single_block — body is a single option list.
    return {
      eligible_templates: {
        type: "single_block",
        options: parseOptionList(body, warn),
      },
      eligible_templates_context: context || undefined,
    };
  }

  // Phased: build PhaseBlocks. Per spec B6 detection rule, italic sub-blocks
  // are phase blocks regardless of whether the label contains "Phase N".
  // Some labels carry template references the body omits (C4's
  // "*Hybrid-in-comeback Phase 1 / 2 / 3*: For users returning...") — scan
  // the label too so those resolve.
  //
  // A label like "Returning Athlete Phase 2-3" expands to a phase_2 block AND
  // a phase_3 block with the same options (otherwise phase_3 silently goes
  // missing). When that expansion lands on the same phase enum as another
  // italic block (e.g. A2's "Non-comeback A2 (trained user)" maps to phase_3
  // by ordinal), the option sets are merged into one phase block — the
  // schema's phase enum is discrete, so two divergent options sets on the
  // same enum is a silent collision the engine couldn't disambiguate.
  const rawPhases = [];
  blocks.forEach((b, i) => {
    const expandedEnums = expandPhaseLabel(b.label, i);
    const opts = parseOptionList(`${b.label}. ${b.text}`, warn);
    for (const phaseEnum of expandedEnums) {
      rawPhases.push({ phase: phaseEnum, phase_label: b.label, eligible_templates: opts });
    }
  });
  // Merge blocks with the same phase enum.
  const byPhase = new Map();
  for (const p of rawPhases) {
    if (!byPhase.has(p.phase)) {
      byPhase.set(p.phase, {
        phase: p.phase,
        phase_label: p.phase_label,
        eligible_templates: [...p.eligible_templates],
      });
    } else {
      const existing = byPhase.get(p.phase);
      existing.phase_label = `${existing.phase_label} + ${p.phase_label}`;
      const seenIds = new Set(existing.eligible_templates.map((o) => o.template_id));
      for (const opt of p.eligible_templates) {
        if (!seenIds.has(opt.template_id)) {
          existing.eligible_templates.push({
            ...opt,
            order: existing.eligible_templates.length + 1,
          });
          seenIds.add(opt.template_id);
        }
      }
    }
  }
  const phases = [...byPhase.values()].sort((a, b) =>
    a.phase.localeCompare(b.phase)
  );
  // Drop any phase with empty options to keep the schema satisfied; warn.
  const filledPhases = phases.filter((p) => p.eligible_templates.length > 0);
  if (filledPhases.length === 0) {
    warn("phased entry collapsed to zero options after resolution");
  }
  return {
    eligible_templates: { type: "phased", phases: filledPhases },
    eligible_templates_context: context || undefined,
  };
}

// ---------- frequency_coupling (B7) ----------

function parseFrequencyCoupling(raw) {
  // Two shapes: phased ("Phase 1 = 2 days/week strict. Phase 2 = …") and
  // single-block ("3-4 days/week" or "3 days/week").
  const segments = raw
    .split(/(?<=[.])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const seg of segments) {
    const phaseMatch = seg.match(/Phase\s+(\d)\s*=\s*(.+)$/i);
    let phase = null;
    let body = seg;
    if (phaseMatch) {
      phase = `phase_${phaseMatch[1]}`;
      body = phaseMatch[2];
    }
    // Accept "days/week", "sessions/week", and "×/week" as count-of-sessions
    // markers. The first match in a segment wins (covers "5-6 sessions/week
    // typical" prefix before a "Strength 1-2×/week" suffix in C2-style raws).
    const daysMatch = body.match(
      /(\d+)(?:[-–](\d+))?\s*(?:mixed\s+)?(?:days?|sessions?|×|x)\s*\/\s*week/i
    );
    if (!daysMatch) continue;
    const min_days = Number(daysMatch[1]);
    const max_days = daysMatch[2] ? Number(daysMatch[2]) : min_days;
    const strict = /\bstrict\b/i.test(body);
    const breakdown = /\bsessions?\b|strength\s+\+\s+conditioning|sessions\/week/i.test(body)
      ? body
      : undefined;
    out.push({
      phase,
      min_days,
      max_days,
      strict,
      ...(breakdown ? { breakdown } : {}),
      raw: seg,
    });
  }
  // If we found nothing structured, return a single permissive entry so the
  // schema (min 1) is satisfied — caller can spot via raw.
  if (out.length === 0) {
    out.push({ phase: null, min_days: 3, max_days: 3, strict: false, raw });
  }
  return out;
}

// ---------- conditioning_subtypes ----------

const CONDITIONING_KEYWORDS = [
  [/polarized\s+base|seiler/i, "polarized_base"],
  [/pyramidal/i, "pyramidal_event"],
  [/hyrox/i, "hyrox_specific"],
  [/\bnone\b/i, "none"],
];

function parseConditioningSubtypes(raw) {
  const segments = raw
    .split(/(?<=[.])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const seg of segments) {
    const phaseMatch = seg.match(/Phase\s+(\d)\s*=\s*(.+)$/i);
    let phase = null;
    let body = seg;
    if (phaseMatch) {
      phase = `phase_${phaseMatch[1]}`;
      body = phaseMatch[2];
    }
    let subtype = "none";
    for (const [re, name] of CONDITIONING_KEYWORDS) {
      if (re.test(body)) {
        subtype = name;
        break;
      }
    }
    out.push({ phase, subtype, raw: seg });
  }
  if (out.length === 0) out.push({ phase: null, subtype: "none", raw });
  return out;
}

// ---------- special_weeks_applicable ----------

const SPECIAL_WEEK_MATCHERS = [
  [/\bdeload\b/i, "deload"],
  [/\brace\s+week|event\s+week|tournament\s+week|fight\s+week|show\s+week|stage\s+day/i, "race_event"],
  [/\brecovery\s+week|active\s+recovery/i, "recovery"],
  [/\bsymptom[-\s]flare\b/i, "symptom_flare"],
];

function parseSpecialWeeksApplicable(raw) {
  const found = new Set();
  for (const [re, kind] of SPECIAL_WEEK_MATCHERS) {
    if (re.test(raw)) found.add(kind);
  }
  return [...found];
}

// ---------- combo_session ----------

function parseComboSession(raw) {
  if (!raw) return undefined;
  const phaseMatch = raw.match(/Phase\s+(\d)/i);
  return {
    available: true,
    ...(phaseMatch ? { phase: `phase_${phaseMatch[1]}` } : {}),
    // Combo template is always the Hybrid-in-comeback P2 entry per spec §0.
    template_ref: "hybrid-in-comeback-p2-loaded-4d",
    raw,
  };
}

// ---------- per-entry transform ----------

const SECTION_TO_CLUSTER_RE = /^([A-G])\s*[·]?\s*/;

const COUPLING_FIELDS = {
  Eligible_templates: /\*\*Eligible templates\*\*:[\s\S]*?(?=\n\*\*[A-Z]|$)/,
  Frequency_coupling: /\*\*Frequency coupling\*\*:\s*(.+?)(?=\n\*\*[A-Z]|$)/s,
  Conditioning_subtypes: /\*\*Conditioning subtypes\*\*:\s*(.+?)(?=\n\*\*[A-Z]|$)/s,
  Phase_transitions: /\*\*Phase transitions\*\*:\s*(.+?)(?=\n\*\*[A-Z]|$)/s,
  Special_weeks: /\*\*Special weeks\*\*:\s*(.+?)(?=\n\*\*[A-Z]|$)/s,
  Combo_session: /\*\*Combo session\*\*:\s*(.+?)(?=\n\*\*[A-Z]|$)/s,
};

function extractFieldBlock(md, re) {
  const m = md.match(re);
  return m ? (m[1] !== undefined ? m[1].trim() : m[0].trim()) : "";
}

function transformCouplingEntry(entry, sectionHeading, warnings) {
  const md = entry.content_markdown;
  const cluster = entry.key[0];
  const eligible_raw = extractFieldBlock(md, COUPLING_FIELDS.Eligible_templates);
  const warn = (msg) => warnings.push(`${entry.key}: ${msg}`);
  const eligibleParsed = parseEligibleTemplates(eligible_raw, warn);
  const frequencyRaw = extractFieldBlock(md, COUPLING_FIELDS.Frequency_coupling);
  const conditioningRaw = extractFieldBlock(md, COUPLING_FIELDS.Conditioning_subtypes);
  const phaseTransitionsRaw = extractFieldBlock(md, COUPLING_FIELDS.Phase_transitions);
  const specialRaw = extractFieldBlock(md, COUPLING_FIELDS.Special_weeks);
  const comboRaw = extractFieldBlock(md, COUPLING_FIELDS.Combo_session);
  return {
    goal_id: entry.key,
    name: entry.heading,
    cluster,
    ...eligibleParsed,
    frequency_coupling: parseFrequencyCoupling(frequencyRaw),
    conditioning_subtypes: parseConditioningSubtypes(conditioningRaw),
    phase_transitions_raw: phaseTransitionsRaw,
    special_weeks_applicable: parseSpecialWeeksApplicable(specialRaw),
    special_weeks_raw: specialRaw,
    ...(comboRaw ? { combo_session: parseComboSession(comboRaw) } : {}),
    source_section: sectionHeading,
  };
}

// ---------- Foundation (B8) ----------

function findFoundationEntry(foundationSection, headingMatch) {
  return foundationSection.entries.find((e) => headingMatch.test(e.heading));
}

function parseInt0(s, fallback = 0) {
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function parseCanonicalDeload(entry) {
  const md = entry.content_markdown;
  const volMatch = md.match(/[-−]\s*(\d+)\s*%\s*volume/i);
  const loadMatch = md.match(/[-−]\s*(\d+)\s*%\s*load/i);
  const triggerMatch = md.match(/Default trigger\*\*:\s*([^.]+\.)/i);
  return {
    volume_drop_pct: volMatch ? parseInt0(volMatch[1]) : 40,
    load_drop_pct: loadMatch ? parseInt0(loadMatch[1]) : 10,
    default_trigger: triggerMatch ? triggerMatch[1].trim() : "Every 4th week of a mesocycle.",
    raw: md,
  };
}

function parseMacrocycle(entry) {
  const md = entry.content_markdown;
  const totalMatch = md.match(/(\d+)-week\s+macrocycle/i);
  const mesoMatch = md.match(/(\d+)\s+mesocycles?\s+of\s+(\d+)\s+weeks?/i);
  const stepMatch = md.match(/\+(\d+)\s*%\s*per\s+week/i);
  return {
    pattern: "MEV -> MAV -> MRV",
    weeks_total: totalMatch ? parseInt0(totalMatch[1]) : 12,
    mesocycles: mesoMatch ? parseInt0(mesoMatch[1]) : 3,
    mesocycle_weeks: mesoMatch ? parseInt0(mesoMatch[2]) : 4,
    load_step_pct: stepMatch ? parseInt0(stepMatch[1]) : 5,
    raw: md,
  };
}

function parseFrequencyDefaults(entry, warn) {
  const md = entry.content_markdown;
  // Lines look like: "**2 days/week**: ... Default templates: <names>." OR
  // "**3 days/week**: ... Default split: hinge-emphasis / squat-emphasis /
  // upper-emphasis (or Lower P / Upper PP / Lower A as named templates)."
  // The descriptive emphasis names ("hinge-emphasis") aren't templates; the
  // parenthetical "(or X as named templates)" carries the real refs. We
  // scan the WHOLE body for known templates rather than try to split on
  // punctuation in a brittle way.
  const out = [];
  const lineRe =
    /\*\*(\d\+?)\s*days?\/week\*\*:\s*([\s\S]*?)(?=\n\*\*\d\+?\s*days?\/week\*\*:|$)/g;
  let m;
  while ((m = lineRe.exec(md)) !== null) {
    const days = m[1];
    const body = m[2].trim();
    const default_template_ids = scanTemplateMentions(body);
    out.push({ days, default_template_ids, raw: body });
  }
  return out;
}

function parseConditioningPatterns(entry) {
  const md = entry.content_markdown;
  const out = [];
  for (const [re, subtype, defaultGoals] of [
    [
      /\*\*Polarized base[\s\S]*?(?=\n\*\*|$)/i,
      "polarized_base",
      ["C1", "C2", "C3", "D2"],
    ],
    [
      /\*\*Pyramidal[\s\S]*?(?=\n\*\*|$)/i,
      "pyramidal_event",
      ["C1", "C2", "C3", "C5"],
    ],
    [/\*\*Hyrox-specific[\s\S]*?(?=\n\*\*|$)/i, "hyrox_specific", ["C4"]],
  ]) {
    const m = md.match(re);
    if (m) {
      const block = m[0];
      // Goal codes may appear bare (D2), inside parens, or slash-separated
      // ("(C1/C2/C3/D2)"). Match each [A-G]\d token globally.
      const goalCodes = [...block.matchAll(/\b([A-G]\d)\b/g)].map((mm) => mm[1]);
      out.push({
        subtype,
        default_goal_ids: goalCodes.length ? [...new Set(goalCodes)] : defaultGoals,
        raw: block.trim(),
      });
    }
  }
  return out;
}

function parseFoundationComboSession(entry, warn) {
  const md = entry.content_markdown;
  const available_template_ids = [];
  const eligible_goal_ids = [];
  // Available templates phrase: "Available templates: …"
  const availMatch = md.match(/Available templates\*\*:\s*([^.]+)\./i);
  if (availMatch) {
    const frags = availMatch[1]
      .split(/\s+OR\s+|\s*,\s*/)
      .map((s) => s.replace(/\(\d+×\/week\)/i, "").trim())
      .filter(Boolean);
    for (const f of frags) {
      const id = resolveTemplateId(f);
      if (id) available_template_ids.push(id);
      else warn(`combo_session: unresolved template "${f}"`);
    }
  }
  // Eligible goals: list of "(GOAL)" inline codes.
  const goalCodes = [...md.matchAll(/\b([A-G]\d)\b/g)].map((m) => m[1]);
  for (const g of goalCodes) if (!eligible_goal_ids.includes(g)) eligible_goal_ids.push(g);
  return { available_template_ids, eligible_goal_ids, raw: md };
}

function parseSpecialWeeks(entry) {
  const md = entry.content_markdown;
  // 4 sub-rules: Race week / Deload week / Recovery week / Symptom-flare week.
  const rules = [];
  const blocks = md.match(/\*\*[^*]+ week[^*]*\*\*:[\s\S]*?(?=\n\*\*|$)/gi) || [];
  for (const b of blocks) {
    const head = b.match(/\*\*([^*]+)\*\*/)[1].trim();
    const lower = head.toLowerCase();
    let kind;
    // Order matters — "Recovery week (...life-event...)" must classify as
    // recovery, not race_event. Symptom-flare and deload checked first too.
    if (/symptom/.test(lower)) kind = "symptom_flare";
    else if (/deload/.test(lower)) kind = "deload";
    else if (/recovery/.test(lower)) kind = "recovery";
    else if (/\brace\b|\bevent\s+week\b|\bshow\s+week\b|\btournament\b|\bfight\b/.test(lower))
      kind = "race_event";
    else continue;
    const body = b.replace(/^\*\*[^*]+\*\*:\s*/, "").trim();
    rules.push({
      kind,
      behaviour: body,
      eligibility: body,
      raw: b.trim(),
    });
  }
  return rules;
}

function buildFoundation(foundationSection, warnings) {
  const warn = (m) => warnings.push(`foundation: ${m}`);
  const deload = findFoundationEntry(foundationSection, /Canonical deload/i);
  const macro = findFoundationEntry(foundationSection, /Macrocycle structure/i);
  const freq = findFoundationEntry(foundationSection, /Frequency coupling defaults/i);
  const cond = findFoundationEntry(foundationSection, /Conditioning subtype scheduling/i);
  const combo = findFoundationEntry(foundationSection, /Combo session triggering/i);
  const special = findFoundationEntry(foundationSection, /Special weeks/i);
  if (!deload || !macro || !freq || !cond || !combo || !special) {
    throw new Error("L5 transform: Foundation section missing one or more required sub-entries");
  }
  return {
    canonical_deload: parseCanonicalDeload(deload),
    macrocycle: parseMacrocycle(macro),
    frequency_defaults: parseFrequencyDefaults(freq, warn),
    conditioning_patterns: parseConditioningPatterns(cond),
    combo_session: parseFoundationComboSession(combo, warn),
    special_weeks: parseSpecialWeeks(special),
  };
}

// ---------- top-level transform ----------

const ALPHA_CLUSTERS = new Set(["A", "B", "C", "D", "E", "F"]); // G deferred per spec §0
const ALPHA_MAX = { A: 5, B: 3, C: 9, D: 5, E: 7, F: 6 };

export function transformLayer5(structural) {
  const warnings = [];
  const foundationSection = structural.sections.find((s) => /Foundation/i.test(s.heading));
  if (!foundationSection) throw new Error("L5 transform: Foundation section not found");
  const foundation = buildFoundation(foundationSection, warnings);

  const coupling_entries = [];
  for (const section of structural.sections) {
    if (section.heading === "Intro" || /Foundation/i.test(section.heading)) continue;
    // Cluster letter is the leading char of the section heading ("A · Body…").
    const clusterMatch = section.heading.match(SECTION_TO_CLUSTER_RE);
    if (!clusterMatch) continue;
    const cluster = clusterMatch[1];
    for (const entry of section.entries) {
      if (!entry.key) continue;
      // Alpha scope guard: per spec §0, F7 + G* are deferred. We do parse them
      // (they exist in KB; L5 entries parse fine), but the schema's min-35
      // count is satisfied by A1-F6.
      const goalLetter = entry.key[0];
      const goalNum = Number(entry.key[1]);
      if (goalLetter === "G") continue; // deferred entirely
      if (goalLetter === "F" && goalNum === 7) continue; // deferred
      coupling_entries.push(transformCouplingEntry(entry, section.heading, warnings));
    }
  }
  return { foundation, coupling_entries, warnings };
}
