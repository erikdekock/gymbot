// Web Audio engine. Reproduces the prototype's tuned node graph + envelopes:
// an airy noise whoosh layered with a warm detuned-triangle bass that both
// follow the breath direction, plus a bell-like `ping` (fundamental + partials)
// for phase markers, round transitions and the per-minute retention gong. The
// AudioContext is created/resumed on the first user gesture (the "Begin" tap).
// Breath sounds respect `cfg.tone`; bells respect `cfg.ping`.

import { cfg } from './config.js'

let actx = null
let noiseBuf = null
let activeNodes = []
let activeGains = []

// Create or resume the context. Call from a user gesture.
export function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)()
    if (actx.state === 'suspended') actx.resume()
  } catch {
    /* Web Audio unsupported — degrade silently */
  }
}

function buildNoise() {
  const len = Math.floor(actx.sampleRate * 2)
  noiseBuf = actx.createBuffer(1, len, actx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
}

// Bell ping tuned to the video: ~2452Hz fundamental + two partials, each with
// an exponential ring. Used for phase markers and the retention gong.
export function ping(ringSec, vol) {
  if (!cfg.ping || !actx) return
  const t = actx.currentTime
  ;[
    [2452, 1],
    [4904, 0.32],
    [5862, 0.12],
  ].forEach(([f, a]) => {
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol * a, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + ringSec)
    o.connect(g)
    g.connect(actx.destination)
    o.start(t)
    o.stop(t + ringSec + 0.05)
  })
}

// Airy breath whoosh + warm synth-bass layer underneath; both follow the breath.
// Inhale is mid + long; exhale is bright + short (see `exhaleMs` in session).
export function breathTone(dir, durMs) {
  if (!cfg.tone || !actx) return
  stopBreathTone()
  if (!noiseBuf) buildNoise()
  const t = actx.currentTime
  const dur = Math.max(0.3, durMs / 1000)
  const jit = (n) => n * (0.92 + Math.random() * 0.16)

  // --- airy raspy noise whoosh ---
  const src = actx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const hp = actx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 160
  const bp = actx.createBiquadFilter()
  bp.type = 'bandpass'
  const gN = actx.createGain()
  if (dir === 'in') {
    bp.Q.value = 1.15
    bp.frequency.setValueAtTime(jit(540), t)
    bp.frequency.linearRampToValueAtTime(jit(1000), t + dur)
    gN.gain.setValueAtTime(0.0001, t)
    gN.gain.linearRampToValueAtTime(0.12, t + dur * 0.7)
    gN.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  } else {
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(jit(3100), t)
    bp.frequency.linearRampToValueAtTime(jit(1700), t + dur)
    gN.gain.setValueAtTime(0.0001, t)
    gN.gain.linearRampToValueAtTime(0.13, t + dur * 0.14)
    gN.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  }
  src.connect(hp)
  hp.connect(bp)
  bp.connect(gN)
  gN.connect(actx.destination)
  src.start(t)
  src.stop(t + dur + 0.06)

  // --- warm synth bass ---
  const o1 = actx.createOscillator()
  const o2 = actx.createOscillator()
  const lp = actx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 700
  lp.Q.value = 0.7
  const gB = actx.createGain()
  const f1 = dir === 'in' ? 108 : 152
  const f2 = dir === 'in' ? 152 : 100
  o1.type = 'triangle'
  o2.type = 'triangle'
  o2.detune.value = 9
  o1.frequency.setValueAtTime(f1, t)
  o1.frequency.exponentialRampToValueAtTime(f2, t + dur)
  o2.frequency.setValueAtTime(f1, t)
  o2.frequency.exponentialRampToValueAtTime(f2, t + dur)
  gB.gain.setValueAtTime(0.0001, t)
  if (dir === 'in') gB.gain.linearRampToValueAtTime(0.05, t + dur * 0.7)
  else gB.gain.linearRampToValueAtTime(0.05, t + dur * 0.14)
  gB.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o1.connect(lp)
  o2.connect(lp)
  lp.connect(gB)
  gB.connect(actx.destination)
  o1.start(t)
  o2.start(t)
  o1.stop(t + dur + 0.06)
  o2.stop(t + dur + 0.06)

  activeNodes = [src, o1, o2]
  activeGains = [gN, gB]
}

export function stopBreathTone() {
  if (!activeNodes.length || !actx) return
  const t = actx.currentTime
  activeGains.forEach((g) => {
    try {
      g.gain.cancelScheduledValues(t)
      g.gain.setTargetAtTime(0, t, 0.05)
    } catch {
      /* node already finished */
    }
  })
  activeNodes.forEach((n) => {
    try {
      n.stop(t + 0.2)
    } catch {
      /* already stopped */
    }
  })
  activeNodes = []
  activeGains = []
}
