#!/usr/bin/env node
// build.mjs — combineert src/ + assets/ tot één zelfstandig, OFFLINE dist/de-reis.html.
// Alle assets worden als base64 data-URI ge-inlined. Geen externe deps, geen netwerk.
// Herhaalbaar en idempotent: dezelfde input -> dezelfde output.
//
//   node build.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, 'assets');
const SRC = path.join(HERE, 'src');
const DIST = path.join(HERE, 'dist');
const OUT = path.join(DIST, 'de-reis.html');

// Mime exact reproduceren uit magic bytes (de stadsfoto's hebben .png-keys maar zijn JPEG).
function mimeOf(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  throw new Error('Onbekend beeldformaat (geen JPEG/PNG): ' + buf.slice(0, 4).toString('hex'));
}

function dataURI(relFile) {
  const buf = fs.readFileSync(path.join(ASSETS, relFile));
  return `data:${mimeOf(buf)};base64,${buf.toString('base64')}`;
}

const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));

// Reconstrueer de 5 blobs in EXACT dezelfde vorm als het origineel:
//   IMAGES        : { "key.png": dataURI }
//   ARTHUR_FRAMES : [ dataURI ]
//   HOUSES        : [ {w,h,d:dataURI} ]
//   STREET        : { key: {w,h,d:dataURI} }
//   OBSTI         : { key: {w,h,d:dataURI} }
const IMAGES = {};
for (const [key, file] of Object.entries(manifest.IMAGES)) IMAGES[key] = dataURI(file);

const ARTHUR_FRAMES = manifest.ARTHUR_FRAMES.map(dataURI);

// ERIK_FRAMES: additieve nieuwe global (4-frame walk-cycle), gevoed door manifest.erik.json.
// Bestaande blobs blijven hierdoor byte-identiek.
const erikManifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.erik.json'), 'utf8'));
const ERIK_FRAMES = erikManifest.erik_frames.map(dataURI);

// CAT_FRAMES + DOG_FRAMES: additieve globals (animatie-frames), gevoed door manifest.obstacles.json.
// Bestaande blobs (OBSTI etc.) blijven ongewijzigd.
const obstManifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'obstacles', 'manifest.obstacles.json'), 'utf8'));
const CAT_FRAMES = obstManifest.cat_frames.map(dataURI);
const DOG_FRAMES = obstManifest.dog_frames.map(dataURI);

const HOUSES = manifest.HOUSES.map((o) => ({ w: o.w, h: o.h, d: dataURI(o.file) }));

const STREET = {};
for (const [key, o] of Object.entries(manifest.STREET)) STREET[key] = { w: o.w, h: o.h, d: dataURI(o.file) };

const OBSTI = {};
for (const [key, o] of Object.entries(manifest.OBSTI)) OBSTI[key] = { w: o.w, h: o.h, d: dataURI(o.file) };

// CARDS: additieve nieuwe global (27 stadskaarten), gevoed door assets/cards/manifest.cards.json.
// Dit zijn ECHTE jpeg-bestanden met jpeg-mime (niet de .png-key-met-jpeg-quirk van IMAGES).
const cardsManifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'cards', 'manifest.cards.json'), 'utf8'));
const CARDS = cardsManifest.cards.map((c) => {
  const buf = fs.readFileSync(path.join(ASSETS, c.file));
  const mime = c.mime || mimeOf(buf); // echte mime uit het manifest (image/jpeg)
  return { city: c.city, theme: c.theme, src: `data:${mime};base64,${buf.toString('base64')}` };
});

const assetsScript =
  '<script>\n' +
  '/* === ge-inlinede assets — gegenereerd door build.mjs uit assets/manifest.json. Niet handmatig bewerken. === */\n' +
  `const IMAGES=${JSON.stringify(IMAGES)};\n` +
  `const ARTHUR_FRAMES=${JSON.stringify(ARTHUR_FRAMES)};\n` +
  `const ERIK_FRAMES=${JSON.stringify(ERIK_FRAMES)};\n` +
  `const CAT_FRAMES=${JSON.stringify(CAT_FRAMES)};\n` +
  `const DOG_FRAMES=${JSON.stringify(DOG_FRAMES)};\n` +
  `const HOUSES=${JSON.stringify(HOUSES)};\n` +
  `const STREET=${JSON.stringify(STREET)};\n` +
  `const OBSTI=${JSON.stringify(OBSTI)};\n` +
  `const CARDS=${JSON.stringify(CARDS)};\n` +
  '</script>';

const gameJs = fs.readFileSync(path.join(SRC, 'game.js'), 'utf8');
const gameScript = '<script>\n' + gameJs.replace(/\n$/, '') + '\n</script>';

const index = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const MARKER = /^.*BUILD:INJECT.*$/m;
if (!MARKER.test(index)) throw new Error('BUILD:INJECT-marker niet gevonden in src/index.html');

const html = index.replace(MARKER, assetsScript + '\n' + gameScript);

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, html);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('Gebouwd:', path.relative(process.cwd(), OUT));
console.log('  assets ge-inlined:',
  Object.keys(IMAGES).length, 'cities,',
  ARTHUR_FRAMES.length, 'arthur,',
  ERIK_FRAMES.length, 'erik,',
  CAT_FRAMES.length, 'cat,',
  DOG_FRAMES.length, 'dog,',
  HOUSES.length, 'houses,',
  Object.keys(STREET).length, 'street,',
  Object.keys(OBSTI).length, 'obstacles,',
  CARDS.length, 'cards');
console.log('  outputgrootte:', kb(Buffer.byteLength(html)));
