// App entry. Wires the setup screen and session engine, restores saved
// settings, and handles the optional sky photo fallback. The service worker is
// registered automatically by vite-plugin-pwa (injectRegister: 'auto').

import './styles/fonts.css'
import './styles/app.css'
import { loadConfig } from './config.js'
import { initSetup } from './setup.js'
import { initSession, startSession, backToSetup } from './session.js'

// If the optional photo can't load (absent/offline/blocked), drop it so the
// built-in CSS sky shows through.
const skyPhoto = document.querySelector('.sky-photo')
if (skyPhoto) {
  const drop = () => skyPhoto.remove()
  skyPhoto.addEventListener('error', drop)
  if (skyPhoto.complete && skyPhoto.naturalWidth === 0) drop()
}

loadConfig()
initSetup()
initSession()

document.getElementById('startBtn').addEventListener('click', startSession)
document.getElementById('againBtn').addEventListener('click', backToSetup)
