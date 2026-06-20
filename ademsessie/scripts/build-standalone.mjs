// Assemble a single self-contained, offline-capable HTML file from the modular
// sources: inlines app.css, base64-embeds the woff2 fonts, and concatenates the
// ES modules into one classic <script> (imports/exports stripped). Output:
// ademsessie-standalone.html  (double-click to run; no build step, no network).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const r = (p) => readFileSync(resolve(root, p), 'utf8')
const b64 = (p) => readFileSync(resolve(root, p)).toString('base64')

// ---- fonts as data URIs ----
const fontFace = (family, style, weight, file) => `@font-face{
  font-family:'${family}'; font-style:${style}; font-weight:${weight}; font-display:swap;
  src:url(data:font/woff2;base64,${b64('src/assets/fonts/' + file)}) format('woff2');
}`
const fontsCss = [
  fontFace('Fraunces', 'italic', 400, 'fraunces-italic-400.woff2'),
  fontFace('IBM Plex Sans', 'normal', 400, 'ibmplexsans-400.woff2'),
  fontFace('IBM Plex Sans', 'normal', 500, 'ibmplexsans-500.woff2'),
  fontFace('IBM Plex Sans', 'normal', 600, 'ibmplexsans-600.woff2'),
].join('\n')

const appCss = r('src/styles/app.css')

// ---- merge JS modules into one classic script ----
const modules = [
  'src/config.js',
  'src/audio.js',
  'src/haptics.js',
  'src/wakelock.js',
  'src/session.js',
  'src/setup.js',
  'src/main.js',
]
const strip = (src) =>
  src
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l)) // drop import lines
    .filter((l) => !/^\s*import\s*['"]/.test(l)) // drop side-effect css imports
    .map((l) => l.replace(/^\s*export\s+/, '')) // drop export keyword
    .filter((l) => !/const \$ = \(id\) => document\.getElementById\(id\)/.test(l)) // dedupe $
    .join('\n')

const bundle =
  `(function(){\n` +
  `'use strict';\n` +
  `const $ = (id) => document.getElementById(id);\n` +
  modules.map((m) => `// ===== ${m} =====\n` + strip(r(m))).join('\n\n') +
  `\n})();`

// ---- assemble HTML from index.html markup ----
let html = r('index.html')
html = html
  .replace(/\s*<link rel="stylesheet"[^>]*>/g, '') // remove external css links
  .replace(/\s*<script type="module"[^>]*><\/script>/g, '') // remove module entry
  .replace('</head>', `  <style>\n${fontsCss}\n${appCss}\n</style>\n</head>`)
  .replace('</body>', `  <script>\n${bundle}\n</script>\n</body>`)

writeFileSync(resolve(root, 'ademsessie-standalone.html'), html)
console.log('wrote ademsessie-standalone.html')
