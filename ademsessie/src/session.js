// Breathing session engine: Get-ready → Breaths → Retention → Recovery → loop
// → Done. Mirrors the prototype's flow, timings and cues 1:1. Auto-advance per
// phase; double-tap on the breathing area advances Breaths→Retention and
// Retention→Recovery early. Holds the screen awake for the whole session.

import { cfg, tempoMap, retentionSeconds, fmt } from './config.js'
import { unlockAudio, tone, breathTone, stopBreathTone } from './audio.js'
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
function setStage(mode, ms) {
  stage.style.transitionDuration = (ms || 2200) + 'ms'
  aura.style.transitionDuration = (ms || 2200) + 'ms'
  stage.classList.remove('inhale', 'hold')
  if (mode === 'hold') stage.classList.add('hold')
}

// ---- phases ----
function getReady() {
  phase = 'getready'
  setStage('hold', 500)
  instruction.textContent = 'Maak je klaar'
  helper.textContent = ''
  let c = 3
  readout.textContent = c
  tone(396, 0.12, 0.045)
  buzz(12)
  timers.push(
    setInterval(() => {
      c--
      if (c <= 0) {
        clearTimers()
        startBreaths()
        return
      }
      readout.textContent = c
      tone(396, 0.12, 0.045)
      buzz(12)
    }, 1000)
  )
}

function startBreaths() {
  phase = 'breaths'
  const dur = tempoMap[cfg.tempo]
  setStage('breaths', dur)
  helper.textContent = 'Dubbeltik voor de retentie'
  let n = 1
  const cycle = () => {
    readout.textContent = n
    instruction.textContent = 'Adem in'
    stage.classList.add('inhale')
    breathTone('in', dur)
    buzz(16)
    timers.push(
      setTimeout(() => {
        instruction.textContent = 'Adem uit'
        stage.classList.remove('inhale')
        breathTone('out', dur)
        buzz(12)
        timers.push(
          setTimeout(() => {
            if (n >= cfg.breaths) {
              toRetention()
              return
            }
            n++
            cycle()
          }, dur)
        )
      }, dur)
    )
  }
  cycle()
}

function toRetention() {
  clearTimers()
  stopBreathTone()
  phase = 'retention'
  setStage('hold', 1200)
  tone(528, 0.4, 0.05)
  buzz([22, 40, 22])
  instruction.textContent = 'Laat los en houd vast'
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

function toRecovery() {
  clearTimers()
  phase = 'recovery'
  setStage('hold', 1200)
  tone(528, 0.35, 0.05)
  buzz(20)
  instruction.textContent = 'Adem diep in en houd vast'
  helper.textContent = ''
  let s = cfg.recovery
  readout.textContent = fmt(s)
  timers.push(
    setInterval(() => {
      s--
      if (s <= 0) {
        readout.textContent = fmt(0)
        endRound()
        return
      }
      readout.textContent = fmt(s)
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
  // Completion cue. Deliberately not tracked in `timers` so the screen switch's
  // clearTimers() doesn't cancel the second note of the chord.
  tone(528, 0.5, 0.05)
  setTimeout(() => tone(660, 0.5, 0.04), 150)
  buzz(40)
}

function onDoubleTap() {
  if (phase === 'breaths') {
    clearTimers()
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
  getReady()
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
