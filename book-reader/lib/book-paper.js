// ===========================================================================
//  Aged-paper variation + pencil marginalia — the tuning file.
//
//  Everything here is DETERMINISTIC: page N of chapter C always renders
//  identically, because every value is derived from a seed built out of
//  (chapter number, page index). Nothing calls Math.random(), so a page looks
//  the same on every visit, on every machine, and after every reload.
//
//  Tune the constants in PAPER / MARGINALIA_* below to taste — nothing else
//  needs to change.
// ===========================================================================

export const PAPER = {
  // Roughly 1 page in N carries a pencil note in the outer margin.
  marginaliaEveryNth: 4,
  // Foxing (the small rust-brown age spots).
  foxingMin: 7,
  foxingMax: 16,
  foxingRadius: [0.15, 0.6], // in viewBox units; ≈2–8px on screen
  foxingOpacity: [0.05, 0.13],
  // Larger faint tea-ring stains.
  stainChance: 0.34,
  secondStainChance: 0.12,
  // A softly folded corner.
  dogEarChance: 0.18,
  // Paper tone drifts ±3% page to page.
  toneJitter: 0.03,
  // A small ornament sits under the running head on some pages.
  ornamentChance: 0.45,
}

// The only words that can ever appear in the margin. Deliberately short,
// harmless, period-plausible reader's marks.
export const MARGINALIA_PHRASES = [
  'ср. гл. 3',
  'хорошо',
  'см. выше',
  'N.B.',
  'не забыть',
  'ещё раз',
  'почему?',
  'да',
  'здесь',
  '12.III.',
  'Н.К.',
]

// Single-character marks that stand alone.
export const MARGINALIA_MARKS = ['?', '!', 'NB']

// The page-head ornaments (rotated a hair per page).
export const ORNAMENTS = ['❦', '✦', '⁂']

// --- deterministic PRNG -----------------------------------------------------

// mulberry32: tiny, fast, good enough for decorative scatter.
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Seed from chapter + page only — never from time, viewport or reader.
export function pageSeed(chapterNumber, pageIndex) {
  return (Math.imul(chapterNumber || 1, 73856093) ^ Math.imul((pageIndex || 0) + 1, 19349663)) >>> 0
}

const lerp = (r, [lo, hi]) => lo + r * (hi - lo)
const round = (n, p = 2) => Number(n.toFixed(p))

/**
 * Paper character for one page. Coordinates are in the page's SVG viewBox
 * (100 wide × 140 tall), so they scale with the page.
 */
export function paperFor(chapterNumber, pageIndex) {
  const r = mulberry32(pageSeed(chapterNumber, pageIndex))

  const tone = round((r() * 2 - 1) * PAPER.toneJitter, 4)

  const count = PAPER.foxingMin + Math.floor(r() * (PAPER.foxingMax - PAPER.foxingMin + 1))
  const foxing = []
  for (let i = 0; i < count; i++) {
    foxing.push({
      x: round(r() * 100),
      y: round(r() * 140),
      r: round(lerp(r(), PAPER.foxingRadius)),
      o: round(lerp(r(), PAPER.foxingOpacity), 3),
    })
  }

  const stains = []
  const pushStain = () => {
    stains.push({
      x: round(12 + r() * 76),
      y: round(14 + r() * 112),
      rx: round(6 + r() * 9),
      ry: round(4 + r() * 7),
      rot: round(r() * 180),
      o: round(0.05 + r() * 0.05, 3),
    })
  }
  if (r() < PAPER.stainChance) pushStain()
  if (r() < PAPER.secondStainChance) pushStain()

  return {
    tone,
    foxing,
    stains,
    dogEar: r() < PAPER.dogEarChance,
    edgePhase: Math.floor(r() * 100),
    ornament: r() < PAPER.ornamentChance,
    ornamentIndex: Math.floor(r() * ORNAMENTS.length),
    ornamentRot: round(r() * 8 - 4),
  }
}

/**
 * The pencil note (if any) for one page. Always lands in the OUTER margin
 * strip — the caller positions it there, so it can never touch the text column.
 * Returns null on most pages.
 */
export function marginaliaFor(chapterNumber, pageIndex) {
  const r = mulberry32((pageSeed(chapterNumber, pageIndex) ^ 0x9e3779b9) >>> 0)

  if (r() >= 1 / PAPER.marginaliaEveryNth) return null

  const roll = r()
  const kind = roll < 0.55 ? 'note' : roll < 0.75 ? 'mark' : roll < 0.9 ? 'underline' : 'bracket'
  const list = kind === 'mark' ? MARGINALIA_MARKS : MARGINALIA_PHRASES
  const text = list[Math.floor(r() * list.length)]

  return {
    kind,
    text,
    top: round(10 + r() * 68), // % down the text area
    rot: round(r() * 10 - 5),
    opacity: round(0.3 + r() * 0.16, 3),
    scale: round(0.9 + r() * 0.3),
  }
}
