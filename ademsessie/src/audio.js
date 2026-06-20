// Web Audio engine. Reproduces the prototype's tuned node graph + envelopes
// exactly: an airy noise whoosh layered with a warm detuned-triangle bass that
// both follow the breath direction, plus soft sine pings for phase markers and
// get-ready ticks. The AudioContext is created/resumed on the first user
// gesture (the "Begin" tap). All audio respects the live `cfg.tone` flag.

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

// Soft sine ping — phase-transition markers, completion, get-ready ticks.
export function tone(freq, dur = 0.2, vol = 0.05) {
  if (!cfg.tone || !actx) return
  const o = actx.createOscillator()
  const g = actx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  o.connect(g)
  g.connect(actx.destination)
  const t = actx.currentTime
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.start(t)
  o.stop(t + dur + 0.03)
}

function buildNoise() {
  const len = Math.floor(actx.sampleRate * 2)
  noiseBuf = actx.createBuffer(1, len, actx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
}

function env(g, dir, t, dur, peak) {
  g.gain.setValueAtTime(0.0001, t)
  if (dir === 'in') g.gain.linearRampToValueAtTime(peak, t + dur * 0.8)
  else g.gain.linearRampToValueAtTime(peak, t + dur * 0.16)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
}

// Airy breath whoosh + warm synth-bass layer underneath; both follow the breath.
export function breathTone(dir, durMs) {
  if (!cfg.tone || !actx) return
  stopBreathTone()
  if (!noiseBuf) buildNoise()
  const t = actx.currentTime
  const dur = Math.max(0.5, durMs / 1000)
  const jit = (n) => n * (0.9 + Math.random() * 0.2)

  // --- airy raspy noise whoosh ---
  const src = actx.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const hp = actx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 140
  const bp = actx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  const gN = actx.createGain()
  if (dir === 'in') {
    bp.frequency.setValueAtTime(jit(600), t)
    bp.frequency.linearRampToValueAtTime(jit(1500), t + dur)
  } else {
    bp.frequency.setValueAtTime(jit(1400), t)
    bp.frequency.linearRampToValueAtTime(jit(420), t + dur)
  }
  env(gN, dir, t, dur, 0.13)
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
  lp.frequency.value = 850
  lp.Q.value = 0.7
  const gB = actx.createGain()
  const f1 = dir === 'in' ? 110 : 165
  const f2 = dir === 'in' ? 165 : 98
  o1.type = 'triangle'
  o2.type = 'triangle'
  o2.detune.value = 9
  o1.frequency.setValueAtTime(f1, t)
  o1.frequency.exponentialRampToValueAtTime(f2, t + dur)
  o2.frequency.setValueAtTime(f1, t)
  o2.frequency.exponentialRampToValueAtTime(f2, t + dur)
  env(gB, dir, t, dur, 0.06)
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
