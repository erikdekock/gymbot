// Session configuration. Mutated live by the setup screen and read by the
// session/audio modules. Optionally persisted to localStorage so the last-used
// settings are restored on next launch.

const STORAGE_KEY = 'ademsessie.settings'

// Total breath-cycle duration per tempo (ms). Measured from the WHM video:
// Standard ≈ 3.5s/cycle. The cycle is split into four phases below.
export const tempoTotal = { langzaam: 4550, normaal: 3500, snel: 2500 }

// Phase fractions of the cycle: grow (inhale) / top pause / shrink (exhale) /
// bottom pause — 35.7% / 20% / 14.3% / 30%, matching the video.
export const phases = { grow: 0.357, top: 0.2, shrink: 0.143, bottom: 0.3 }

export const defaults = {
  rounds: 3,
  breaths: 30,
  tempo: 'normaal',
  retention: 'feel', // 'feel' (hold until double-tap) | seconds | 'custom'
  customRetention: 120,
  recovery: 15,
  tone: true, // breath sounds
  ping: true, // bell/gong markers
  vibrate: true,
}

// The single live config object shared across modules.
export const cfg = { ...defaults }

const VALID = {
  tempo: ['langzaam', 'normaal', 'snel'],
}

function clampNum(v, min, max) {
  v = Number(v)
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null
}

// Normalise a stored retention value: 'feel', 'custom', or a clamped number.
function parseRetention(v) {
  if (v === 'feel' || v === 'custom') return v
  return clampNum(v, 30, 300)
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cfg
    const s = JSON.parse(raw)
    const rounds = clampNum(s.rounds, 1, 5)
    const breaths = clampNum(s.breaths, 20, 40)
    const recovery = [10, 15, 20].includes(Number(s.recovery)) ? Number(s.recovery) : null
    const customRetention = clampNum(s.customRetention, 30, 300)
    const retention = parseRetention(s.retention)

    if (rounds != null) cfg.rounds = rounds
    if (breaths != null) cfg.breaths = breaths
    if (VALID.tempo.includes(s.tempo)) cfg.tempo = s.tempo
    if (retention != null) cfg.retention = retention
    if (customRetention != null) cfg.customRetention = customRetention
    if (recovery != null) cfg.recovery = recovery
    if (typeof s.tone === 'boolean') cfg.tone = s.tone
    if (typeof s.ping === 'boolean') cfg.ping = s.ping
    if (typeof s.vibrate === 'boolean') cfg.vibrate = s.vibrate
  } catch {
    /* storage unavailable or corrupt — fall back to defaults */
  }
  return cfg
}

export function saveConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    /* storage unavailable (private mode, etc.) — non-fatal */
  }
}

// Resolve the effective retention hold in seconds for the current config.
// Only meaningful for timed holds ('feel' is handled separately by the session).
export function retentionSeconds() {
  return cfg.retention === 'custom' ? cfg.customRetention : cfg.retention
}

export const fmt = (s) =>
  String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
