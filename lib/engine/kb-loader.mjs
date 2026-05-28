/**
 * KB layer loader. Reads engine-ready JSON from data/kb/ at module init.
 *
 * The JSON files are produced by scripts/build-kb.mjs + the 12.2b transforms
 * (PR #8). Engine reads them synchronously; no async I/O at match-time.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = join(__dirname, "..", "..", "data", "kb");

function loadLayer(n) {
  const path = join(KB_DIR, `layer-${n}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

let _l5 = null;
let _l8 = null;
let _l8Index = null;

export function getLayer5() {
  if (!_l5) _l5 = loadLayer(5);
  return _l5;
}

export function getLayer8() {
  if (!_l8) _l8 = loadLayer(8);
  return _l8;
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
