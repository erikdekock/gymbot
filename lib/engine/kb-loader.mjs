/**
 * KB layer loader. Provides engine-ready JSON from data/kb/.
 *
 * The JSON files are produced by scripts/build-kb.mjs + the 12.2b transforms
 * (PR #8). Engine reads them synchronously; no async I/O at match-time.
 *
 * The layers are pulled in via static `import` (not fs.readFileSync) so that
 * webpack/Next.js bundles them into the serverless function. A dynamic
 * readFileSync(join(__dirname, ...)) resolved to the build-time repo path
 * (/vercel/path0/data/kb/...) which does not exist in the Vercel lambda
 * filesystem at runtime — causing ENOENT even when outputFileTracingIncludes
 * copied the files in. Static imports are statically analyzable and inlined,
 * so there is no runtime path resolution to get wrong.
 */

import layer5 from "../../data/kb/layer-5.json" with { type: "json" };
import layer8 from "../../data/kb/layer-8.json" with { type: "json" };
// Cross-family ladder — Tier 3 of the contra-fallback walk (DS-01 §3.5, PD
// ruling). Keyed by slot_role (movement-PATTERN). PLACEHOLDER content today;
// KB Editor publishes the canonical ladder under scope item (ii). Static
// import (not fs.readFileSync) for the same Vercel-bundling reason as the
// layers above — see the header note.
import crossFamilyLadder from "../../data/kb/cross-family-ladder.json" with { type: "json" };

let _l8Index = null;

export function getLayer5() {
  return layer5;
}

export function getLayer8() {
  return layer8;
}

/** Map of exercise_id (int) → ExerciseRecord. Built on first call. */
export function getExerciseIndex() {
  if (_l8Index) return _l8Index;
  const l8 = getLayer8();
  _l8Index = new Map();
  for (const ex of l8.exercises) _l8Index.set(ex.id, ex);
  return _l8Index;
}

export function getExercise(id) {
  const idx = getExerciseIndex();
  const ex = idx.get(id);
  if (!ex) throw new Error(`[kb] exercise_id ${id} not in Layer 8`);
  return ex;
}

export function getCouplingEntry(goalId) {
  const l5 = getLayer5();
  const entry = l5.coupling_entries.find((e) => e.goal_id === goalId);
  if (!entry) throw new Error(`[kb] Layer-5 coupling entry not found for goal_id ${goalId}`);
  return entry;
}

export function getCrossFamilyLadder() {
  return crossFamilyLadder;
}

/**
 * Ordered cross-family ladder exercise ids for a slot_role (Tier 3 of the
 * contra-fallback walk, DS-01 §3.5). Returns `[]` when the role has no ladder
 * entry — the caller must then cleanly emit slot_dropped (§4.4 escape hatch),
 * never crash. The placeholder file uses `ladders[slot_role] = [{ order,
 * exercise_id }]`; we sort by `order` so ladder authorship order in the JSON
 * is irrelevant.
 */
export function getLadderForSlotRole(slotRole) {
  const ladder = getCrossFamilyLadder();
  const entries = ladder?.ladders?.[slotRole];
  if (!Array.isArray(entries) || entries.length === 0) return [];
  return entries
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((e) => e.exercise_id);
}
