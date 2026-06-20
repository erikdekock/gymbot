// Setup screen: binds the controls to the live config, reflects restored
// settings into the UI on load, and persists changes to localStorage.

import { cfg, saveConfig, fmt } from './config.js'

const $ = (id) => document.getElementById(id)

function setSegPressed(segId, val) {
  const el = $(segId)
  ;[...el.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === String(val))))
}

function bindStepper(stepId, valId, key, min, max, step) {
  const el = $(stepId)
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    const d = b.dataset.act === '+' ? step : -step
    cfg[key] = Math.min(max, Math.max(min, cfg[key] + d))
    $(valId).textContent = cfg[key]
    saveConfig()
  })
}

function bindSeg(segId, onPick) {
  const el = $(segId)
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    ;[...el.children].forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    onPick(b.dataset.val)
    saveConfig()
  })
}

function bindToggle(id, key) {
  const el = $(id)
  el.addEventListener('click', () => {
    const on = el.getAttribute('aria-pressed') !== 'true'
    el.setAttribute('aria-pressed', String(on))
    cfg[key] = on
    saveConfig()
  })
}

// Reflect the (possibly restored) config into every control.
function render() {
  $('roundsVal').textContent = cfg.rounds
  $('breathsVal').textContent = cfg.breaths
  setSegPressed('tempoSeg', cfg.tempo)
  setSegPressed('recSeg', cfg.recovery)
  $('retCustomVal').textContent = fmt(cfg.customRetention)

  if (cfg.retention === 'custom') {
    setSegPressed('retSeg', 'custom')
    $('customRet').hidden = false
  } else {
    setSegPressed('retSeg', cfg.retention)
    $('customRet').hidden = true
  }

  $('toneTgl').setAttribute('aria-pressed', String(cfg.tone))
  $('vibTgl').setAttribute('aria-pressed', String(cfg.vibrate))
}

export function initSetup() {
  render()

  bindStepper('roundsStep', 'roundsVal', 'rounds', 1, 5, 1)
  bindStepper('breathsStep', 'breathsVal', 'breaths', 20, 40, 5)
  bindSeg('tempoSeg', (v) => (cfg.tempo = v))

  bindSeg('retSeg', (v) => {
    if (v === 'custom') {
      $('customRet').hidden = false
      cfg.retention = 'custom'
    } else {
      $('customRet').hidden = true
      cfg.retention = Number(v)
    }
  })

  $('retStep').addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    cfg.customRetention = Math.min(300, Math.max(30, cfg.customRetention + (b.dataset.act === '+' ? 15 : -15)))
    $('retCustomVal').textContent = fmt(cfg.customRetention)
    cfg.retention = 'custom'
    saveConfig()
  })

  bindSeg('recSeg', (v) => (cfg.recovery = Number(v)))
  bindToggle('toneTgl', 'tone')
  bindToggle('vibTgl', 'vibrate')

  $('moreBtn').addEventListener('click', () => {
    const box = $('moreBox')
    const btn = $('moreBtn')
    const open = !box.classList.contains('open')
    box.classList.toggle('open', open)
    btn.setAttribute('aria-expanded', String(open))
    btn.textContent = open ? 'Minder instellingen ▴' : 'Meer instellingen ▾'
  })
}
