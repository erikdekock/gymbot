// Haptics. Feature-detected and gated on the live `cfg.vibrate` toggle.
// navigator.vibrate is a silent no-op on iOS Safari — that's expected.

import { cfg } from './config.js'

export function buzz(pattern) {
  if (cfg.vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* ignore */
    }
  }
}
