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
