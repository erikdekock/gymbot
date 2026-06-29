# ARCHITECTUUR — De Reis (Arthur), v10

Reactie-runner in één `<canvas>`: kat **Arthur** rent in perspectief door een
Amsterdamse grachtenstraat, ontwijkt obstakels en onthult aan het eind via drie
stadskaarten de geheime reisbestemming (Marseille / Palermo / Bilbao).

Dit document beschrijft het **origineel** (`reference/de-reis-game1-v10.html`) en hoe
de bronvorm bewaard moet blijven. Regelnummers verwijzen naar het originele bestand.

> **Harde randvoorwaarde:** de build blijft één **volledig zelfstandig, offline**
> HTML-bestand. Geen externe scripts/CDN, geen netwerk (`fetch`/XHR), geen
> `localStorage`/`sessionStorage`. Vanilla JS + `<canvas>`, geen framework. Alle
> in-game tekst is bewust **Nederlands**.

---

## 1. Bestandsindeling van het origineel

| Regels | Inhoud |
|---|---|
| 1–57 | `<head>` (CSS) + `<body>` markup: `.wrap`, `<canvas#game>`, en drie overlays `#finalChoice` / `#reveal` / `#gameOver` |
| 58 | `<script>` |
| **59–63** | **De 5 data-blobs** (elk één gigantische regel base64) |
| 64–313 | Alle game-logica |
| 314 | `</script></body></html>` |

De decompositie haalt regels 59–63 eruit (→ `assets/` + `manifest.json`), zet de markup in
`src/index.html` en de logica in `src/game.js`. `build.mjs` voegt het weer samen.

---

## 2. De geïnjecteerde data-blobs (vorm MOET exact behouden blijven)

De logica leest deze vijf globale constanten. De vormen verschillen per blob — de build
reconstrueert ze één-op-één uit `assets/manifest.json`.

| Const | Vorm | Aantal | Inhoud |
|---|---|---|---|
| `IMAGES` | `{ "Key.png": "data:…" }` (object, key→data-URI) | 18 | stadsfoto's `Marseille_1..6`, `Palermo_1..6`, `Bilbao_1..6` |
| `ARTHUR_FRAMES` | `[ "data:…" ]` (array van data-URI-strings) | 4 | loop-frames van Arthur |
| `HOUSES` | `[ {w,h,d} ]` (array van objecten) | 5 | gevels; `d` = data-URI |
| `STREET` | `{ key: {w,h,d} }` (object van objecten) | 8 | `road, gate, tree, bike, bench, car, bollard, lamp` |
| `OBSTI` | `{ key: {w,h,d} }` (object van objecten) | 3 | `cat_ok, cat_hiss, dog` |

> ⚠️ **Belangrijke valstrik:** de keys in `IMAGES` eindigen op `.png`, maar de bytes zijn
> **JPEG** (`data:image/jpeg`). De `.png`-naam wordt als key in `CITYDATA` gebruikt, dus de
> key moet letterlijk blijven, terwijl de mime `image/jpeg` is. `build.mjs` leidt de mime af
> uit de **magic bytes** van het bestand (FFD8=JPEG, 8950=PNG), niet uit de extensie, zodat
> dit exact terugkomt. Op schijf staan deze als `assets/cities/*.jpg` (echte extensie);
> `manifest.json` bewaart de koppeling naar de originele `.png`-key.

Reconstructie-garantie: base64 is deterministisch, dus decode→encode levert byte-identieke
data-URI's. Geverifieerd met een deep-equal van alle vijf blobs (origineel vs. gebouwd).

---

## 3. Projectie-wiskunde

Eén centraal vluchtpunt op de horizon; alles wordt vanuit wereld-coördinaten
`(x, y, z)` naar het scherm geprojecteerd.

```js
const W=600, H=800, HORIZON=300, F=190, CAMH=4.2, XW=3.2, ROAD=2.6, ZMIN=0.8;  // regel 66

function P(x, y, z){ const zz=Math.max(ZMIN,z), sc=F/zz; return [300 + x*sc, HORIZON + (CAMH-y)*sc]; }
function groundY(d){ return HORIZON + CAMH*F/Math.max(ZMIN,d); }
```

- `x` = zijwaarts (wereld-eenheden, 0 = midden weg), `y` = hoogte, `z` = diepte vóór de camera.
- `sc = F/z` is de perspectief-schaal: schermbreedte = `wereld * sc`.
- `300` = halve canvasbreedte (W/2) = horizontaal vluchtpunt.
- `HORIZON` = y-lijn van de horizon; `CAMH` = camerahoogte; `F` = brandpuntsafstand.
- `XW` = halve straatbreedte (gevels staan op `x = ±XW`). `ZMIN` voorkomt deling door ~0.
- De camera "rijdt" vooruit via `S.travel`; objecten op `z` verschijnen op diepte `d = z − S.travel`.

Het canvas wordt **gesupersampled** met `SS=1.7` (regel 67): de backing-store is `W*SS × H*SS`
en de basistransform is `setTransform(SS,0,0,SS,0,0)`. Alle teken-coördinaten zijn in
logische W×H-ruimte.

---

## 4. State & game-loop

`fresh()` (regel 104–107) maakt de complete state `S`: `phase, travel, spd, air, vy, duck,
slapT, stun, shake, flash, lives(3), score, buildings[], props[], obs[], birds[], fx[],
orbs[], nbz[], npz, noz, …`. Fases: `start → run → bloom → (overlays)` en `over`.

```
loop(now)                                   // requestAnimationFrame, regel 156
  dt = min(0.05, (now-last)/1000)           // dt-gebaseerd, geclampt
  ph = travel/LEN ; nf = sm(0.45,1.0,ph)    // dag→nacht-factor
  dusk = sin(ph·π)·0.62·(1−nf·0.55)         // schemering-piek halverwege
  phase==='run'   → update(dt)
  phase==='bloom' → spawn orbs, na 4.2s → showFinalChoice()
  render()
  requestAnimationFrame(loop)
```

`update(dt)` (regel 166): versnelt naar `SPEED`, verplaatst `travel`, roept `gen()`,
integreert sprong (`vy`/`air` met `GRAV`), telt timers af, doet **botsing-/scoredetectie**
(zie §6), spawnt vogels nabij het einde, en zet `phase='bloom'` bij `travel ≥ LEN−2.2`.

---

## 5. Wereldgeneratie — `gen()` (regel 133–153)

Vult `FAR=52` eenheden vooruit en recyclet alles achter de camera. Drie onafhankelijke
"cursors" zorgen dat content maar één keer gespawnd wordt:

- **Gebouwen** — per zijde `nbz[si]`: breedte `w = 1.85 + rand·0.7`, hoogte uit
  `houseAR`, willekeurige gevel-index `0..HOUSE_N(10)`, twee raamlichten `lit`.
- **Props** — cursor `npz`, stap **1.6**: altijd twee `bollard`s; daarna één random prop:
  `car` (<0.22), `bike` (<0.40), `tree` (<0.50), `bench` (<0.56), anders niets; lantaarn
  (`lamp`) elke 6 eenheden.
- **Obstakels** — cursor `noz`, stap **2.9 + rand·1.5**, alleen tot `LEN−3.5`:
  type `cat` (<0.4), `dog` (<0.7), anders `erik` (persoon, met willekeurig label uit `PEOPLE`).

Opruimen: gebouwen `z > travel−2.6`, props `z > travel−1.6`, obstakels `z−travel > 0.5`.

---

## 6. Obstakel-systeem & levens

Drie obstakels, elk met een eigen actie; mis = leven kwijt (`loseLife`, regel 131 — `stun`,
`shake`, rood `flash`, bij 0 levens → `showGameOver`). Detectie in `update` (regel 170–173):

| Obstakel | Sprite(s) | Juiste actie | Toets | Score | Geslaagd-venster | Mis bij |
|---|---|---|---|---|---|---|
| **kat** | `cat_ok` / `cat_hiss` (sissend < 3.0) | **sla** | spatie | +10 | `slap()`: `1.9 < d < 3.7` | `d < 1.95` |
| **hond** | `dog` | **spring** | ↑ | +12 | `d < 2.6` én `air > 22` | `d < 1.95` |
| **erik** (persoon) | vector-tekening | **duik** achter auto | ↓ | +15 | `d < 2.6` én `S.duck` | `d < 1.95` |

`slap()` (regel 129) zoekt de dichtstbijzijnde kat in venster en zet `state='done'` met een
wegvlieg-animatie (`fdir`, `ft`). Drie levens = drie pootjes in de HUD. Invoer: toetsen
(regel 112–119) **en** pointer-zones op het canvas (regel 120–123: boven=spring, onder=duik,
midden=sla).

---

## 7. Render-pijplijn — `render()` (regel 268–283)

Reset transform naar `SS`, `clearRect`, dan (behalve in `start`, dat `startScreen()` tekent):

1. **`drawSky()`** (182) — verticale gradiënt dag→nacht (`nf`) met schemer-tint (`dusk`),
   zon die zakt, maan + 70 sterren bij nacht, drijvende wolken overdag.
2. **`drawGround()`** (187) — klinkervloer als geprojecteerde steen-quads (zie §8).
3. **Diepte-gesorteerde laag** — `buildings`, `props`, het **hek** (`drawGate`, op `d=LEN−travel`)
   en `obs` gaan in één lijst, gesorteerd op `d` (ver→dichtbij), dan getekend (`d > 0.5`).
   - Gevels via **`texStrip()`** (zie §8); props via `drawProp` (sprite of vector-fallback);
     obstakels via `drawCat`/`drawDog`/`drawErik`.
4. **`drawBirds()`, `drawFx()`** (zwevende `+punten`), **`drawArthur()`** (sprite-cyclus,
   schaduw, duik-pose met auto-overlay, sla-boog).
5. Rode **`flash`** bij treffer; **`bloom()`** in de bloom-fase; **`drawHUD()`** altijd bovenop;
   de "Op weg naar de speeltuin…"-caption (`S.cap`).

`'s nachts (`nf>0`) krijgt vrijwel elke laag een donkerblauwe multiply-overlay; lantaarns en
ramen krijgen radiale gloed.

---

## 8. Twee kern-renderroutines

### `texStrip(img, side, zN, w, h, strips)` — gevels (regel 82)
Tekent een gevel-textuur op het verticale vlak `x = side·XW` tussen diepte `zN` en `zN+w`,
opgedeeld in `strips` verticale stroken. Per strook wordt een **affiene transform**
(`setTransform`) opgezet die de textuur-strook **midden-verankerd** (op `h*0.5`) naar het
geprojecteerde trapezium mapt — zo ontstaat correct perspectief zonder echte 3D.
Strook-aantal: `strips = clamp(round(schermbreedte / 6), 2, 34)` (regel 203). Buiten beeld /
ontbrekende textuur → effen-gekleurde fallback-quad. Gevel-indices 5–9 zijn horizontaal
gespiegelde varianten van 0–4 (`FLIP`, regel 9–13).

### `drawGround()` — klinkervloer (regel 187)
Onder de horizon een gradiënt, daaroverheen een raster van steen-quads:
- `lenX=0.6` (steenbreedte), `depthZ=0.3` (steendiepte), `mInX=0.05`, `mInZ=0.05` (voegen),
  `DCAP=9.0` (max. teken-diepte), kolommen `c=−7..7`.
- Rijen "scrollen" met `S.travel`; oneven rijen krijgen een halve offset (`off`) →
  metselverband. Per steen een hash-gebaseerde kleurvariatie (`hsh`), met dag/nacht-meng en
  fade vlak vóór `DCAP`.

---

## 9. Eindscherm

De `bloom`-fase (loop, regel 159) → na 4.2s **`showFinalChoice()`** (301): drie `.fccard`-overlays in
willekeurige volgorde, hero-foto per stad uit `IMAGES`. **`pickCity(i)`** (303) → **`showReveal(city)`**
(304): hero + naam + zin + strip van vijf foto's. Bron: `CITYDATA` (regel 296–299):

```js
{ key, name, line, hero:'X_2.png', imgs:['X_1.png', …] }   // Marseille / Palermo / Bilbao
```

Toetsen `1/2/3` kiezen ook een stad (regel 307). `showGameOver()` (306) toont de score.

---

## 10. Tunables (snel finetunen)

| Tunable | Regel | Waarde | Effect |
|---|---|---|---|
| `SPEED` | 68 | `3.5` | loopsnelheid (eenheden/s, `spd` versnelt ernaartoe) |
| `LEN` | 68 | `56` | baanlengte; bepaalt ook dag→nacht (`ph=travel/LEN`) |
| `JUMPV` / `GRAV` | 68 | `375` / `1200` | spronghoogte / zwaartekracht |
| `FPS` | 69 | `10` | sprite-framerate Arthur |
| `ARTHUR_W` | 69 | `112` | Arthur breedte (px) |
| `SS` | 67 | `1.7` | supersampling-factor (scherpte vs. performance) |
| `F`, `CAMH`, `XW`, `HORIZON` | 66 | `190/4.2/3.2/300` | brandpunt / camerahoogte / straatbreedte / horizon |
| `ZMIN` | 66 | `0.8` | min. diepte (anti deel-door-nul) |
| gevel-stroken | 203 | `clamp(round(sw/6),2,34)` | detail/perf van geveltextuur |
| klinker | 190 | `lenX0.6, depthZ0.3, mIn0.05, DCAP9.0` | steengrootte, voeg, teken-diepte |
| gebouw-breedte | 135 | `1.85 + rand·0.7` | gevelbreedte-spreiding |
| prop-spawn | 138–146 | stap `1.6`; car`.22`/bike`.40`/tree`.50`/bench`.56`; lamp elke 6 | dichtheid props |
| obstakel-spawn | 147–149 | stap `2.9 + rand·1.5`; cat`.4`/dog`.7`/erik | dichtheid & mix obstakels |
| nacht-curve | 157 | `sm(0.45,1.0,ph)` | wanneer/hoe snel het nacht wordt |
| levens | 104 | `3` | aantal levens |
| score | 129/171/172 | `+10/+12/+15` | punten per kat/hond/erik |

---

## 11. Projectstructuur

```
de-reis/
  reference/de-reis-game1-v10.html   origineel, intact (referentie)
  assets/                            losse beelden + manifest.json
    cities/  arthur/  houses/  street/  obstacles/  manifest.json
  src/index.html                     markup + CSS + <!-- BUILD:INJECT -->
  src/game.js                        game-logica (blobs verwijderd; verder verbatim)
  build.mjs                          assets+src → dist/de-reis.html (offline, idempotent)
  dist/de-reis.html                  het speelbare, zelfstandige eindbestand
  docs/screenshots/                  verificatie-screenshots
```

---

## 12. Wijzigingen t.o.v. het origineel (changelog)

De secties hierboven beschrijven het origineel (`reference/`). De gebouwde versie wijkt af op:

- **Ticket 1 — Intro.** Een DOM-overlay `#intro` (2 pagina's) in `src/index.html` verschijnt
  bij het laden en roept aan het eind de bestaande `begin()` aan. De oude spatie-startprompt
  in `game.js` is geneutraliseerd (de intro is de enige ingang). Fase-machine/`fresh()` ongewijzigd.
- **Ticket 2 — Erik als sprite.** Nieuwe **additieve** blob `ERIK_FRAMES` (4 data-URI's,
  parallel aan `ARTHUR_FRAMES`), ge-inlined door `build.mjs` uit `assets/manifest.erik.json`.
  `drawErik` tekent nu een 4-frame walk-cycle (sprite) i.p.v. de vector-tekening; wereldhoogte
  `ERIK_H` reproduceert de oude silhouethoogte, cyclus op `ERIK_FPS`. Nacht-tint identiek aan
  cat/dog. De willekeurige `PEOPLE`-namen + naam-label zijn verwijderd (altijd Erik); de
  `omlaag`-actiehint blijft (parallel aan `spatie`/`omhoog`). De vijf originele blobs
  (`IMAGES`, `ARTHUR_FRAMES`, `HOUSES`, `STREET`, `OBSTI`) blijven **byte-identiek**.

  Extra tunables: `ERIK_FPS` (walk-snelheid, ≈8) en `ERIK_H` (wereldhoogte, 1.8).
- **Ticket 3 — Reishub + 3 etappes + tijd-van-de-dag (schil).** DOM-overlay `#hub`
  (level-select, papier-stijl) met 3 tijd-getinte tegels; lineair ontgrendeld, gehaalde
  gemarkeerd. Nieuwe `hub`-fase; flow: intro → `#hub` → etappe → `#hub`. `begin(level)` zet
  `S.level` (1..3). De dag→nacht-curve wordt nu gevoed met een **reis-brede** factor
  `ph = ((S.level-1) + travel/LEN) / 3` i.p.v. `travel/LEN` → etappe 1 ochtend, 2 schemering,
  3 nacht. Voortgang in module-scope (`currentLevel`, `completed[3]`, `REIS` placeholder voor
  ticket 5); **geen storage**, geen reload. Einde van de run (`travel ≥ LEN−2.2`) markeert de
  etappe en keert terug naar `#hub` — de oude `showFinalChoice`/`reveal` is **tijdelijk
  losgekoppeld** (keert terug in ticket 5). Kern-runner/obstakels/projectie/`texStrip`
  ongewijzigd; blobs byte-identiek.
