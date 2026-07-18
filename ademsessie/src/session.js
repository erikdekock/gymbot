// Breathing session engine: Breaths → Retention → Recovery → Let go → loop →
// Done. Mirrors the video's flow, timings and cues 1:1. The breath cycle has
// four phases (grow / top pause / shrink / bottom pause). Retention is either a
// fixed hold or 'feel' (count up, soft gong each minute, advance on double-tap).
// Double-tap on the breathing area advances Breaths→Retention and
// Retention→Recovery early. Holds the screen awake for the whole session.

import { cfg, tempoTotal, phases, retentionSeconds, fmt } from './config.js'
import { unlockAudio, ping, breathTone, stopBreathTone } from './audio.js'
import { buzz } from './haptics.js'
import { requestWakeLock, releaseWakeLock } from './wakelock.js'

const $ = (id) => document.getElementById(id)

let stage, aura, readout, instruction, helper, roundLabel
let timers = []
let phase = 'setup'
let round = 1

const clearTimers = () => {
  timers.forEach((t) => {
    clearTimeout(t)
    clearInterval(t)
  })
  timers = []
}

// ---- screens ----
function show(id) {
  clearTimers()
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'))
  $(id).classList.add('active')
}

// ---- stage helpers ----
// mode: 'inhale' (grow to full), 'hold' (settle at hold scale), or null (small).
function setStage(mode, ms) {
  stage.style.transitionDuration = ms + 'ms'
  aura.style.transitionDuration = ms + 'ms'
  stage.classList.remove('inhale', 'hold')
  if (mode === 'inhale') stage.classList.add('inhale')
  else if (mode === 'hold') stage.classList.add('hold')
}

// ---- phases ----
function startBreaths() {
  phase = 'breaths'
  helper.textContent = 'Dubbeltik voor de retentie'
  ping(1.5, 0.06)
  buzz(18)
  const T = tempoTotal[cfg.tempo]
  const grow = T * phases.grow
  const top = T * phases.top
  const shrink = T * phases.shrink
  const bottom = T * phases.bottom
  // Exhale sound is shorter than the visual shrink and scales gently with tempo.
  const exhaleMs = Math.min(600, Math.max(300, 450 * (T / 3500)))
  let n = 1
  setStage(null, 600) // settle small before the first grow
  const cycle = () => {
    readout.textContent = n
    instruction.textContent = 'Adem in'
    setStage('inhale', grow)
    breathTone('in', grow)
    buzz(16)
    timers.push(
      setTimeout(() => {
        // top pause (orb stays full)
        timers.push(
          setTimeout(() => {
            instruction.textContent = 'Adem uit'
            setStage(null, shrink)
            breathTone('out', exhaleMs)
            buzz(10)
            timers.push(
              setTimeout(() => {
                // bottom pause (orb stays small)
                timers.push(
                  setTimeout(() => {
                    if (n >= cfg.breaths) {
                      toRetention()
                      return
                    }
                    n++
                    cycle()
                  }, bottom)
                )
              }, shrink)
            )
          }, top)
        )
      }, grow)
    )
  }
  cycle()
}

function toRetention() {
  clearTimers()
  stopBreathTone()
  phase = 'retention'
  setStage('hold', 1200)
  ping(3.0, 0.07)
  buzz([22, 40, 22])
  instruction.textContent = 'Laat los en houd vast'
  if (cfg.retention === 'feel') {
    // Hold on feel: count up, soft gong each full minute, advance on double-tap.
    helper.textContent = 'Dubbeltik voor de herstelademhaling'
    let s = 0
    readout.textContent = fmt(0)
    timers.push(
      setInterval(() => {
        s++
        readout.textContent = fmt(s)
        if (s > 0 && s % 60 === 0) {
          ping(2.1, 0.05)
          buzz(14)
        }
      }, 1000)
    )
  } else {
    // Fixed hold: count down, auto-advance at zero, double-tap to go early.
    helper.textContent = 'Dubbeltik om eerder door te gaan'
    let s = retentionSeconds()
    readout.textContent = fmt(s)
    timers.push(
      setInterval(() => {
        s--
        if (s <= 0) {
          readout.textContent = fmt(0)
          toRecovery()
          return
        }
        readout.textContent = fmt(s)
      }, 1000)
    )
  }
}

function toRecovery() {
  clearTimers()
  phase = 'recovery'
  setStage('hold', 1200)
  buzz(20) // no ping here — matches the video
  instruction.textContent = 'Adem diep in en houd vast'
  helper.textContent = ''
  let s = cfg.recovery
  readout.textContent = fmt(s)
  timers.push(
    setTimeout(() => {
      // first tick after a beat (deep breath in)
      timers.push(
        setInterval(() => {
          s--
          if (s <= 0) {
            readout.textContent = fmt(0)
            toLetGo()
            return
          }
          readout.textContent = fmt(s)
        }, 1000)
      )
    }, 1200)
  )
}

function toLetGo() {
  clearTimers()
  phase = 'letgo'
  readout.textContent = fmt(0)
  helper.textContent = ''
  let c = 3
  instruction.textContent = 'Laat los (' + c + ')'
  buzz(12)
  timers.push(
    setInterval(() => {
      c--
      if (c <= 0) {
        clearTimers()
        endRound()
        return
      }
      instruction.textContent = 'Laat los (' + c + ')'
    }, 1000)
  )
}

function endRound() {
  clearTimers()
  if (round < cfg.rounds) {
    round++
    roundLabel.textContent = 'Ronde ' + round + ' / ' + cfg.rounds
    startBreaths()
  } else {
    complete()
  }
}

function complete() {
  clearTimers()
  stopBreathTone()
  releaseWakeLock()
  show('end')
  // Completion cue. Deliberately after show() (which clears timers) so it rings.
  ping(2.5, 0.06)
  buzz(40)
}

function onDoubleTap() {
  if (phase === 'breaths') {
    toRetention()
  } else if (phase === 'retention') {
    toRecovery()
  }
}

// End the session early (Stop button) and return to setup.
export function stopSession() {
  clearTimers()
  stopBreathTone()
  releaseWakeLock()
  show('setup')
}

export function startSession() {
  unlockAudio()
  requestWakeLock()
  round = 1
  roundLabel.textContent = 'Ronde 1 / ' + cfg.rounds
  show('session')
  startBreaths() // straight in — no 3-2-1, matches the video
}

export function backToSetup() {
  show('setup')
}

// Wire the session DOM (called once on load).
export function initSession() {
  stage = $('stage')
  aura = document.querySelector('.aura')
  readout = $('readout')
  instruction = $('instruction')
  helper = $('helper')
  roundLabel = $('roundLabel')

  $('stopBtn').addEventListener('click', (e) => {
    e.stopPropagation()
    stopSession()
  })

  // double-tap on the breathing area advances the phase
  let lastTap = 0
  $('tapArea').addEventListener('click', () => {
    const now = Date.now()
    if (now - lastTap < 320) {
      lastTap = 0
      onDoubleTap()
    } else {
      lastTap = now
    }
  })
}
