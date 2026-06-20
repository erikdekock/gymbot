# Ademsessie

A minimalist, Dutch-language, Wim Hof–style **breathing PWA**. Single purpose:
the breathing exercise (power breaths → retention → recovery, repeated over
rounds). No account, no login, no tracking, no stats. Installable to the home
screen and **fully functional offline** after first load.

Built from `ademhaling-prototype.html` (the source of truth for look, flow,
interaction logic and audio), restructured into a maintainable, installable
offline PWA.

## Stack

- **Vite** (vanilla JS) + **`vite-plugin-pwa`** (Workbox) for the manifest +
  service worker. 100% client-side, no backend.
- Fonts (**Fraunces** italic, **IBM Plex Sans**) are **self-hosted** woff2 in
  `src/assets/fonts` — nothing depends on the Google Fonts CDN, so it works
  offline.
- The sky is a **built-in CSS sky** (gradient + drifting cloud layers). See
  "Optional sky photo" below.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # serve the production build
npm run icons    # regenerate PWA icons from scripts/icon.js (uses sharp)
```

## Project layout

```
index.html              app shell (setup / session / end screens)
src/main.js             entry — wires setup + session, sky-photo fallback
src/config.js           live settings, localStorage persistence, helpers
src/setup.js            setup screen bindings + restore-from-storage
src/session.js          phase engine (get-ready → breaths → retention →
                        recovery → loop → done), double-tap, wake lock
src/audio.js            Web Audio engine (breath whoosh + synth bass + pings)
src/haptics.js          navigator.vibrate, gated on the Trilling toggle
src/wakelock.js         Screen Wake Lock (acquire/release + re-acquire on show)
src/styles/             app.css (verbatim from the prototype) + fonts.css
public/icons/           PWA icons (192, 512, maskable 512) — generated
scripts/                icon generator
```

## Settings persistence

Last-used settings are saved to `localStorage` and restored on next launch
(values are validated against their allowed ranges). Private-mode / disabled
storage is handled gracefully.

## Optional sky photo

The app ships with the **CSS sky** only, which always renders. To layer an
optional photo over it:

1. Drop an optimized, **locally bundled** image at `public/sky.jpg`
   (do **not** hotlink an external image — it must work offline).
2. Uncomment the `<img class="sky-photo">` line in `index.html`.

`main.js` removes the photo automatically if it ever fails to load, so the CSS
sky always remains as the base.

## Deploy

Static site over HTTPS (required for service worker + installability). On
Vercel, set the **root directory** to `ademsessie` and use the default Vite
build (`npm run build`, output `dist`). Any static host works.
