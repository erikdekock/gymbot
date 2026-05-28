/**
 * L1 template-display-name → template_id resolution table.
 *
 * Built once from layer-1.json template headings, plus the well-known short
 * aliases ("Lower P", "Upper PP", "Lower A") and phase-bare references
 * ("Reactivator Phase 2") that L5 prose uses.
 *
 * Resolution is intentionally permissive: callers normalise via `normaliseName`
 * and look up in `TEMPLATE_ALIASES`. Unresolved names → null + caller emits a
 * non-fatal warning (L4 convention).
 */

/**
 * Heading text (as it appears in L1 H3 keys) → template_id (kebab-case).
 * These are the canonical entries; aliases below all resolve to one of these
 * ids.
 */
export const L1_TEMPLATE_HEADINGS = [
  ["Lower Posterior", "lower-posterior"],
  ["Upper Push/Pull", "upper-push-pull"],
  ["Lower Anterior", "lower-anterior"],
  ["Upper + Core", "upper-core"],
  ["Full Body", "full-body"],
  ["Mobility", "mobility"],
  ["Run", "run"],
  ["Reactivator — Phase 1 Foundation (2-day)", "reactivator-p1-foundation-2d"],
  ["Reactivator — Phase 2 Loaded (3-day)", "reactivator-p2-loaded-3d"],
  ["Reactivator — Phase 3 Capacity (3-day)", "reactivator-p3-capacity-3d"],
  ["Reactivator — Phase 3 Capacity (4-day variant)", "reactivator-p3-capacity-4d"],
  ["Returning Athlete — Phase 1 Re-entry (3-day)", "returning-athlete-p1-reentry-3d"],
  ["Returning Athlete — Phase 2 Loaded (4-day)", "returning-athlete-p2-loaded-4d"],
  ["Returning Athlete — Phase 3 Capacity (4-day)", "returning-athlete-p3-capacity-4d"],
  [
    "Hybrid-in-comeback — Phase 1 Foundation (3-day strength + light conditioning)",
    "hybrid-in-comeback-p1-foundation-3d",
  ],
  ["Hybrid-in-comeback — Phase 2 Loaded (4-day mixed)", "hybrid-in-comeback-p2-loaded-4d"],
  ["Hybrid-in-comeback — Phase 3 Capacity (4-day balanced)", "hybrid-in-comeback-p3-capacity-4d"],
];

/**
 * Normalise a display-name for lookup: lowercase, em/en-dash → hyphen, drop
 * any parenthetical, collapse non-word runs to a single space, trim.
 * Kept as a pure string transform so callers can use it on raw and aliased
 * names interchangeably.
 */
export function normaliseName(s) {
  // Note: parentheticals are NOT stripped — their content carries variant
  // distinguishers like "(3-day)" vs "(4-day)" that we need to keep distinct.
  // Non-alphanumeric (incl. parens, hyphens) collapse to single spaces.
  return s
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

/**
 * Full alias table — many L5 prose forms map to the same template_id. Keys are
 * passed through `normaliseName` for comparison so spelling/whitespace drift
 * is tolerated. Values are the canonical template_id strings.
 */
const RAW_ALIASES = [
  // Short codes used throughout L5 prose.
  ["Lower P", "lower-posterior"],
  ["Upper PP", "upper-push-pull"],
  ["Upper Push-Pull", "upper-push-pull"],
  ["Lower A", "lower-anterior"],
  ["Upper + Core", "upper-core"],
  ["Upper and Core", "upper-core"],
  ["Mobility template", "mobility"],
  ["Run template", "run"],

  // Reactivator phase variants.
  ["Reactivator Phase 1 Foundation (2-day)", "reactivator-p1-foundation-2d"],
  ["Reactivator Phase 1 Foundation", "reactivator-p1-foundation-2d"],
  ["Reactivator Phase 1", "reactivator-p1-foundation-2d"],
  ["Reactivator Phase 2 Loaded (3-day)", "reactivator-p2-loaded-3d"],
  ["Reactivator Phase 2 Loaded", "reactivator-p2-loaded-3d"],
  ["Reactivator Phase 2", "reactivator-p2-loaded-3d"],
  ["Reactivator Phase 3 Capacity (3-day)", "reactivator-p3-capacity-3d"],
  ["Reactivator Phase 3 Capacity (4-day)", "reactivator-p3-capacity-4d"],
  ["Reactivator Phase 3 Capacity (4-day variant)", "reactivator-p3-capacity-4d"],
  // Bare "Reactivator Phase 3" / "Reactivator Phase 3 Capacity" resolves to
  // the 3-day default — when both variants apply the L5 prose uses
  // "(3-day or 4-day variant)", which the splitter (parseEligibleTemplates)
  // handles by emitting both options.
  ["Reactivator Phase 3 Capacity", "reactivator-p3-capacity-3d"],
  ["Reactivator Phase 3", "reactivator-p3-capacity-3d"],

  // Returning Athlete.
  ["Returning Athlete Phase 1 Re-entry (3-day)", "returning-athlete-p1-reentry-3d"],
  ["Returning Athlete Phase 1 Re-entry", "returning-athlete-p1-reentry-3d"],
  ["Returning Athlete Phase 1", "returning-athlete-p1-reentry-3d"],
  ["Returning Athlete Phase 2 Loaded (4-day)", "returning-athlete-p2-loaded-4d"],
  ["Returning Athlete Phase 2 Loaded", "returning-athlete-p2-loaded-4d"],
  ["Returning Athlete Phase 2", "returning-athlete-p2-loaded-4d"],
  ["Returning Athlete Phase 3 Capacity (4-day)", "returning-athlete-p3-capacity-4d"],
  ["Returning Athlete Phase 3 Capacity", "returning-athlete-p3-capacity-4d"],
  ["Returning Athlete Phase 3", "returning-athlete-p3-capacity-4d"],

  // Hybrid-in-comeback.
  [
    "Hybrid-in-comeback Phase 1 Foundation (3-day strength + 2-day Z2)",
    "hybrid-in-comeback-p1-foundation-3d",
  ],
  [
    "Hybrid-in-comeback Phase 1 Foundation (3-day strength + light conditioning)",
    "hybrid-in-comeback-p1-foundation-3d",
  ],
  ["Hybrid-in-comeback Phase 1 Foundation", "hybrid-in-comeback-p1-foundation-3d"],
  ["Hybrid-in-comeback Phase 1", "hybrid-in-comeback-p1-foundation-3d"],
  [
    "Hybrid-in-comeback Phase 2 Loaded (4-day mixed, includes combo session)",
    "hybrid-in-comeback-p2-loaded-4d",
  ],
  ["Hybrid-in-comeback Phase 2 Loaded (4-day mixed)", "hybrid-in-comeback-p2-loaded-4d"],
  ["Hybrid-in-comeback Phase 2 Loaded", "hybrid-in-comeback-p2-loaded-4d"],
  ["Hybrid-in-comeback Phase 2", "hybrid-in-comeback-p2-loaded-4d"],
  [
    "Hybrid-in-comeback Phase 3 Capacity (4-day balanced)",
    "hybrid-in-comeback-p3-capacity-4d",
  ],
  ["Hybrid-in-comeback Phase 3 Capacity", "hybrid-in-comeback-p3-capacity-4d"],
  ["Hybrid-in-comeback Phase 3", "hybrid-in-comeback-p3-capacity-4d"],
];

const NORMALISED_ALIASES = new Map();
for (const [name, id] of [...L1_TEMPLATE_HEADINGS, ...RAW_ALIASES]) {
  NORMALISED_ALIASES.set(normaliseName(name), id);
}

/**
 * Resolve a single display-name (already comma/OR-split out of L5 prose) to a
 * template_id. Returns null when unresolved.
 */
export function resolveTemplateId(displayName) {
  if (!displayName) return null;
  const key = normaliseName(displayName);
  if (NORMALISED_ALIASES.has(key)) return NORMALISED_ALIASES.get(key);
  // Greedy longest-prefix fall-back: try trimming trailing tokens (handles
  // suffixes like "with peak-week tapering" or "with knee-aware overlay" that
  // L5 prose appends to template references).
  const tokens = key.split(" ");
  while (tokens.length > 2) {
    tokens.pop();
    const candidate = tokens.join(" ");
    if (NORMALISED_ALIASES.has(candidate)) return NORMALISED_ALIASES.get(candidate);
  }
  return null;
}

/**
 * The full list of template_ids that exist in L1 today. Used by the L1
 * extractor's schema check to assert that every heading resolves to one of
 * these — a drift guard if KB Editor ever adds a new template the alias table
 * doesn't know about.
 */
export const KNOWN_TEMPLATE_IDS = new Set(L1_TEMPLATE_HEADINGS.map(([, id]) => id));

// Pre-computed scanner: alias keys sorted by length DESC so longer phrases
// match first ("Reactivator Phase 2 Loaded (3-day)" wins over "Reactivator").
const SCAN_ALIASES = [...new Map(NORMALISED_ALIASES.entries()).entries()].sort(
  (a, b) => b[0].length - a[0].length
);

/**
 * Scan `text` for ALL template-name mentions and return resolved template_ids
 * in order of first appearance, deduplicated. Used in L5 prose blocks where
 * splitting on punctuation is too brittle (slash-lists, mixed prose, "Lower
 * P / Upper PP / Lower A / Upper + Core 4-day split", etc.).
 *
 * Matching is on the normalised (lowercase, punct-collapsed) form of `text`
 * against the same form of each alias. Word boundaries are enforced so that
 * short codes like "Lower P" don't accidentally match inside other phrases.
 */
export function scanTemplateMentions(text) {
  if (!text) return [];
  const normText = " " + normaliseName(text) + " ";
  // Walk the alias list longest-first and record match positions, masking out
  // matched ranges so shorter aliases don't double-claim a slice that a
  // longer alias already covered (e.g. "Reactivator Phase 2 Loaded" should
  // win over bare "Reactivator").
  const claimed = new Array(normText.length).fill(false);
  const hits = [];
  for (const [aliasKey, id] of SCAN_ALIASES) {
    const needle = " " + aliasKey + " ";
    let from = 0;
    while (true) {
      const at = normText.indexOf(needle, from);
      if (at === -1) break;
      // Only the inner range (excluding bounding spaces) is claimed/checked,
      // otherwise adjacent matches like " lower p " then " upper pp " would
      // overlap on the shared space between them.
      const innerStart = at + 1;
      const innerEnd = at + needle.length - 1;
      let free = true;
      for (let i = innerStart; i < innerEnd; i++) {
        if (claimed[i]) {
          free = false;
          break;
        }
      }
      if (free) {
        for (let i = innerStart; i < innerEnd; i++) claimed[i] = true;
        hits.push({ pos: at, id });
      }
      from = at + 1;
    }
  }
  hits.sort((a, b) => a.pos - b.pos);
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    out.push(h.id);
  }
  return out;
}
