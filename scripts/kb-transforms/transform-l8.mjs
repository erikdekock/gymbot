/**
 * Layer 8 transform (B1–B5 + minor cleanups) — turns the faithful 12.1b
 * structural JSON into engine-ready ExerciseRecord[] per
 * [Spec] Layer-5 + Layer-8 Record Schemas v1.0 §1, §4.
 *
 *   B1: equipment → token sets (OR-groups) + bodyweight_only
 *   B2: substitution_alternatives → ordered [{order, exercise_id?, name, external}]
 *   B3: difficulty → {floor, ceiling, raw}
 *   B4: movement_pattern → {family, raw} (feeds B5 contra derivation)
 *   B5: contraindications — DERIVED ENGINE-SIDE, no KB field. See
 *       lib/engine/contra-map.mjs.
 *
 * Minor cleanups: unilateral Yes/No parse, goal_applicability (XX) parse,
 * video_url "*placeholder*" → null.
 */

import { z } from "zod";

// ---------- shared zod primitives (spec §1) ----------

export const ExerciseId = z.number().int().min(1).max(99);
export const GoalId = z.string().regex(/^[A-G][0-9]$/);
export const ExperienceLevel = z.enum(["beginner", "intermediate", "advanced"]);

export const MovementFamily = z.enum([
  "squat",
  "hinge",
  "lunge",
  "vertical_push",
  "horizontal_push",
  "vertical_pull",
  "horizontal_pull",
  "carry",
  "core",
  "isolation",
  "conditioning",
  "mobility",
]);

const MovementPattern = z.object({
  family: MovementFamily,
  raw: z.string(),
});

const EquipmentRequirement = z.object({
  required_any_of: z.array(z.array(z.string()).min(1)).min(1),
  bodyweight_only: z.boolean(),
  raw: z.string(),
});

const Difficulty = z.object({
  floor: ExperienceLevel,
  ceiling: ExperienceLevel,
  raw: z.string(),
});

const SubstitutionAlternative = z.object({
  order: z.number().int().min(1),
  exercise_id: ExerciseId.optional(),
  name: z.string(),
  external: z.boolean(),
});

const GoalApplicability = z.object({
  goal_id: GoalId,
  raw_label: z.string(),
  inline_code: z.boolean(),
});

export const ExerciseRecord = z.object({
  id: ExerciseId,
  name: z.string(),
  cluster: z.number().int().min(1).max(3),
  movement_pattern: MovementPattern,
  unilateral: z.boolean(),
  unilateral_note: z.string().optional(),
  difficulty: Difficulty,
  equipment: EquipmentRequirement,
  substitution_alternatives: z.array(SubstitutionAlternative),
  goal_applicability: z.array(GoalApplicability),
  primary_muscles: z.string(),
  secondary_muscles: z.string(),
  tags: z.array(z.string()),
  form_cues: z.array(z.string()),
  common_errors: z.array(z.string()),
  pairing_logic: z.string(),
  video_url: z.string().nullable(),
  sources: z.array(z.string()),
  source_section: z.string(),
});

// Top-level wrapper. We keep title/content_hash/version alongside `meta`-style
// fields for determinism + parity with the other layer outputs; the spec's
// suggestion of `extracted_at: datetime` is dropped because a per-build
// timestamp would defeat AC4 (two builds identical). version is constant 1.0.
export const Layer8Records = z.object({
  layer: z.literal(8),
  title: z.string().min(1),
  source_page_id: z.string().min(1),
  content_hash: z.string().length(64),
  version: z.literal("1.0"),
  exercises: z.array(ExerciseRecord).length(62),
});

// ---------- markdown field parser ----------
// L8 content_markdown is a fixed 15-field template, one bold marker per line
// for header-style fields and multi-line bullet-less lists for cues/errors.
// We parse by collecting each `**Field**:` block until the next `**Field**:`.

const FIELD_ORDER = [
  "Movement pattern",
  "Primary",
  "Secondary",
  "Equipment",
  "Unilateral",
  "Difficulty",
  "Tags",
  "Form cues",
  "Common errors",
  "Substitution alternatives",
  "Pairing logic",
  "Goal applicability",
  "Video URL",
  "Sources",
];

const FIELD_HEADER_RE = /^\*\*([^*]+)\*\*(?:\s*\*\([^)]*\)\*)?:\s*(.*)$/;

/**
 * Split content_markdown into { [field]: text } using `**Field**:` markers.
 * Trailing markers (Form cues / Common errors / Sources) often span several
 * lines; we accumulate until the next field marker.
 */
function parseFields(md) {
  const lines = md.split("\n");
  const out = {};
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) out[current] = buf.join("\n").trim();
  };
  for (const line of lines) {
    const m = line.match(FIELD_HEADER_RE);
    if (m && FIELD_ORDER.includes(m[1])) {
      flush();
      current = m[1];
      buf = m[2] ? [m[2]] : [];
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

// ---------- movement_pattern (B4) ----------

const FAMILY_KEYWORDS = [
  ["vertical pull", "vertical_pull"],
  ["vertical push", "vertical_push"],
  ["horizontal pull", "horizontal_pull"],
  ["horizontal push", "horizontal_push"],
  ["squat", "squat"],
  ["hinge", "hinge"],
  ["lunge", "lunge"],
  ["carry", "carry"],
  ["core", "core"],
  ["isolation", "isolation"],
  ["conditioning", "conditioning"],
  ["mobility", "mobility"],
];

function parseMovementPattern(raw) {
  const lower = raw.toLowerCase();
  for (const [keyword, family] of FAMILY_KEYWORDS) {
    if (lower.startsWith(keyword)) return { family, raw };
  }
  throw new Error(`L8 transform: movement_pattern "${raw}" matches no family keyword`);
}

// ---------- unilateral ----------

function parseUnilateral(raw) {
  const t = raw.trim();
  // "Yes" / "Yes (...)" → true; everything else (incl. "No", "Can be done…")
  // is treated as bilateral default per spec.
  const isYes = /^yes\b/i.test(t);
  const parenMatch = t.match(/\(([^)]+)\)/);
  return {
    unilateral: isYes,
    unilateral_note: parenMatch ? `(${parenMatch[1]})` : undefined,
  };
}

// ---------- difficulty (B3) ----------

const LEVEL_MAP = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
};

function parseDifficulty(raw) {
  // Strip the parenthetical (kept in raw) before splitting on en-dash.
  const stripped = raw.replace(/\([^)]*\)/g, "").trim();
  // en-dash, em-dash, hyphen-minus all observed as range separators.
  const parts = stripped.split(/[–—-]/).map((p) => p.trim().toLowerCase());
  const floor = LEVEL_MAP[parts[0]];
  const ceiling = parts[1] ? LEVEL_MAP[parts[1]] : floor;
  if (!floor || !ceiling) {
    throw new Error(`L8 transform: difficulty "${raw}" could not parse floor/ceiling`);
  }
  return { floor, ceiling, raw };
}

// ---------- equipment (B1) ----------

/**
 * Equipment line: `<requirement>. *Swaps*: <swap1> · <swap2> ...`
 * Strip the *Swaps* tail (handled separately by substitution_alternatives via
 * its own field; the Equipment-line swaps are a doc convenience that
 * duplicates that data).
 */
function splitEquipmentFromSwaps(raw) {
  const idx = raw.search(/\.\s*\*Swaps\*:/i);
  return idx >= 0 ? raw.slice(0, idx).trim() : raw.trim();
}

/** Split on commas NOT inside parentheses. */
function splitTopLevelCommas(s) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function normaliseEquipmentToken(token) {
  return token
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9+]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseEquipment(raw) {
  const requirement = splitEquipmentFromSwaps(raw);
  const andGroups = splitTopLevelCommas(requirement);
  const required_any_of = [];
  for (const group of andGroups) {
    // "or"-separated within a comma group → OR-group.
    const orOptions = group
      .split(/\s+or\s+/i)
      .map(normaliseEquipmentToken)
      .filter(Boolean);
    if (orOptions.length > 0) required_any_of.push(orOptions);
  }
  // "Bodyweight" alone (with optional parenthetical/qualifier) → bodyweight_only.
  const lower = requirement.toLowerCase();
  const bodyweight_only =
    /^bodyweight\b/.test(lower.trim()) &&
    !/\b(barbell|dumbbell|kettlebell|machine|cable|bench|rack|bar)\b/.test(lower);
  return { required_any_of, bodyweight_only, raw };
}

// ---------- substitution_alternatives (B2) ----------

const INLINE_ID_RE = /#(\d+)\b/;

/**
 * Build a name → exercise_id resolver from the structural L8 records (after
 * cluster-section flattening). The map is keyed by `normaliseName(name)`; we
 * register both the full heading ("7. Romanian Deadlift (RDL)") and the bare
 * name ("Romanian Deadlift (RDL)" / "Romanian Deadlift" / "RDL").
 */
export function buildExerciseNameResolver(flatEntries) {
  const map = new Map();
  const register = (name, id) => {
    if (!name) return;
    const key = normaliseExerciseName(name);
    if (!key) return;
    if (!map.has(key)) map.set(key, id);
  };
  for (const e of flatEntries) {
    const id = Number(e.key);
    register(e.heading, id); // "7. Romanian Deadlift (RDL)"
    const bareName = e.heading.replace(/^\d+\.\s*/, "");
    register(bareName, id); // "Romanian Deadlift (RDL)"
    // Strip parenthetical aliases — "Romanian Deadlift" and "RDL".
    const noParen = bareName.replace(/\s*\([^)]*\)\s*$/, "").trim();
    register(noParen, id);
    const parenMatch = bareName.match(/\(([^)]+)\)/);
    if (parenMatch) register(parenMatch[1], id);
  }
  // A few well-known abbreviations the KB uses in prose but doesn't surface
  // as parenthetical aliases on the heading.
  const ABBREV = [
    ["bss", 27],
    ["bulgarian split squat", 27],
    ["rdl", 7],
    ["ohp", 12],
    ["db bench press", 34],
    ["db bench", 34],
    ["db row", 37],
    ["db row one-arm", 37],
    ["db shoulder press", 35],
    ["push-up", 36],
    ["pushup", 36],
  ];
  for (const [n, id] of ABBREV) register(n, id);
  return map;
}

function normaliseExerciseName(s) {
  return s
    .toLowerCase()
    .replace(/^\d+\.\s*/, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseSubstitutionAlternatives(raw, resolver) {
  if (!raw) return [];
  // The field text begins after `**Substitution alternatives**:` (or
  // `**Substitution alternatives** *(ordered by similarity)*:`). The first
  // line may contain just the colon — actual list begins on the next line.
  // parseFields already strips the marker; we just split here.
  const items = raw
    .replace(/\n/g, " ")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  items.forEach((name, i) => {
    const inline = name.match(INLINE_ID_RE);
    let exercise_id;
    let cleanName = name;
    if (inline) {
      exercise_id = Number(inline[1]);
      cleanName = name; // keep the verbatim "Cluster 3 #54 Lat Pulldown"
    } else {
      const key = normaliseExerciseName(name);
      if (resolver.has(key)) exercise_id = resolver.get(key);
    }
    out.push({
      order: i + 1,
      ...(exercise_id ? { exercise_id } : {}),
      name: cleanName,
      external: exercise_id === undefined,
    });
  });
  return out;
}

// ---------- goal_applicability ----------

const GOAL_INLINE_RE = /\(([A-G]\d)\)/;

function parseGoalApplicability(raw) {
  if (!raw) return [];
  const items = raw
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const item of items) {
    const m = item.match(GOAL_INLINE_RE);
    if (m) {
      out.push({ goal_id: m[1], raw_label: item, inline_code: true });
    } else {
      // No inline code — KB convention puts the code in parens at the end. If
      // it's truly missing, drop into a non-fatal warning by tagging
      // inline_code:false with no goal_id. To stay schema-valid we skip; the
      // L4 alias-table fallback only matters if a code-less entry surfaces in
      // alpha, which it doesn't today.
      continue;
    }
  }
  return out;
}

// ---------- list parsers (cues / errors / sources) ----------

function parseLineList(raw) {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDotList(raw) {
  if (!raw) return [];
  return raw
    .replace(/\n/g, " ")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------- video_url ----------

function parseVideoUrl(raw) {
  if (!raw) return null;
  if (/^\*placeholder\*$/i.test(raw.trim())) return null;
  return raw.trim();
}

// ---------- per-entry transform ----------

const CLUSTER_RE = /^Cluster\s+(\d+)/i;

function clusterForSection(heading) {
  const m = heading.match(CLUSTER_RE);
  if (!m) throw new Error(`L8 transform: section heading "${heading}" missing Cluster N`);
  const n = Number(m[1]);
  if (n < 1 || n > 3) throw new Error(`L8 transform: cluster ${n} out of range`);
  return n;
}

function transformEntry(entry, cluster, resolver, sourceSection) {
  const fields = parseFields(entry.content_markdown);
  const requireField = (name) => {
    const v = fields[name];
    if (v === undefined || v === "") {
      throw new Error(
        `L8 transform: exercise #${entry.key} (${entry.heading}) missing required field "${name}"`
      );
    }
    return v;
  };
  const movement = parseMovementPattern(requireField("Movement pattern"));
  const unilateral = parseUnilateral(requireField("Unilateral"));
  const difficulty = parseDifficulty(requireField("Difficulty"));
  const equipment = parseEquipment(requireField("Equipment"));
  const substitution_alternatives = parseSubstitutionAlternatives(
    fields["Substitution alternatives"],
    resolver
  );
  const goal_applicability = parseGoalApplicability(requireField("Goal applicability"));
  return {
    id: Number(entry.key),
    name: entry.heading.replace(/^\d+\.\s*/, ""),
    cluster,
    movement_pattern: movement,
    unilateral: unilateral.unilateral,
    ...(unilateral.unilateral_note ? { unilateral_note: unilateral.unilateral_note } : {}),
    difficulty,
    equipment,
    substitution_alternatives,
    goal_applicability,
    primary_muscles: requireField("Primary"),
    secondary_muscles: requireField("Secondary"),
    tags: parseDotList(requireField("Tags")),
    form_cues: parseLineList(requireField("Form cues")),
    common_errors: parseLineList(requireField("Common errors")),
    pairing_logic: requireField("Pairing logic"),
    video_url: parseVideoUrl(fields["Video URL"]),
    sources: parseDotList(requireField("Sources")),
    source_section: sourceSection,
  };
}

/**
 * Top-level transform: structural L8 JSON ({ sections:[{heading, entries:[…]}] })
 * → engine-ready { exercises:[…] }. Caller wraps with meta + content_hash.
 *
 * Two-pass: first build the exercise-name resolver from the flat list (so
 * substitution_alternatives can reference by name across clusters), then
 * transform each entry.
 */
export function transformLayer8(structural) {
  const flat = [];
  for (const section of structural.sections) {
    if (section.heading === "Intro") continue;
    for (const entry of section.entries) {
      flat.push({ ...entry, _section: section.heading });
    }
  }
  const resolver = buildExerciseNameResolver(flat);
  const exercises = [];
  for (const entry of flat) {
    const cluster = clusterForSection(entry._section);
    exercises.push(transformEntry(entry, cluster, resolver, entry._section));
  }
  exercises.sort((a, b) => a.id - b.id);
  return { exercises };
}
