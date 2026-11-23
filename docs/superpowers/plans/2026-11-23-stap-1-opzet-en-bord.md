# Stap 1: Opzet en schaakbord (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Op de laptop opent `http://localhost:8080` een schaakbord met alle stukken in de beginstelling, en het bord past op een telefoonscherm.

**Architecture:** Een statische webapp in gewoon JavaScript met ES-modules, zonder build-stap en zonder afhankelijkheden in de app. Een klein Node-script dient de bestanden lokaal. De weergave leest een FEN-string en tekent 64 velden in de DOM. Pure functies (FEN parsen, volgorde van velden, kleur van een veld) worden getest met `node --test`.

**Tech Stack:** HTML, CSS, JavaScript (ES-modules), Node 26 (alleen voor de dev-server en de tests), en de stukkenset cburnett (SVG, GPLv2+).

**Spec:** `docs/superpowers/specs/2026-11-23-schaak-app-design.md`

## Global Constraints

- Geen afhankelijkheden in de app zelf. `package.json` heeft geen `dependencies` en geen `devDependencies`.
- Geen Laravel of PHP.
- Alle tekst in de app is Nederlands; `<html lang="nl">`.
- Alle paden naar bestanden in de app zijn **relatief** (geen leidende `/`), zodat de app later ook vanaf een submap kan draaien, bijvoorbeeld op GitHub Pages.
- Velden moeten groot genoeg zijn voor een duim en het bord moet passen op een Android-scherm in staande stand (360 px breed) zonder horizontaal scrollen.
- Testen draaien met `npm test` (= `node --test`); testbestanden heten `tests/*.test.js`.

## Review Focus

1. **Smal telefoonscherm (360×640) en liggend scherm:** het bord past volledig, is vierkant en er is geen horizontale scrollbalk. → handmatige controle in Taak 3, stap 7.
2. **Bord gedraaid voor zwart:** de velden staan in de juiste volgorde (h1 linksboven, a8 rechtsonder). → test `squareOrder('black')` in Taak 3.
3. **De app draait vanaf een submap:** de stukken laden ook als de app niet in de hoofdmap staat. → test dat `pieceImage()` een relatief pad geeft, in Taak 3.
4. **Windows-paden in de dev-server:** een verzoek als `/..%5Cpackage.json` mag nooit een bestand buiten de projectmap geven. → test in Taak 1.
5. **Ongeldige FEN:** een kapotte FEN geeft een duidelijke foutmelding in plaats van een half bord. → tests in Taak 2.

---

### Task 1: Projectopzet en lokale dev-server

**Files:**
- Create: `package.json`
- Create: `scripts/serve.mjs`
- Create: `index.html` (tijdelijke inhoud, Taak 3 vult hem aan)
- Create: `.gitignore` (`node_modules/`)
- Test: `tests/serve.test.js`

**Interfaces:**
- Produces: `createDevServer(rootDir: string): http.Server` in `scripts/serve.mjs`. Hij luistert nog niet; de aanroeper doet `listen`. Als het script direct wordt gestart (`npm start`), luistert het op `127.0.0.1` en op poort `process.env.PORT ?? 8080`, en meldt het in de console `Schaak-app draait op http://localhost:8080`.
- Produces: `npm start` en `npm test`.

- [ ] **Stap 1: Zet git en `package.json` klaar**

`git init`. Maak `package.json` met `"name": "schaak-app"`, `"private": true`, `"type": "module"` en de scripts `"start": "node scripts/serve.mjs"` en `"test": "node --test"`. Maak `.gitignore` met `node_modules/`. Maak `index.html` met `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Schaak</title></head><body></body></html>`.

- [ ] **Stap 2: Schrijf de falende test `tests/serve.test.js`**

De test start `createDevServer(<projectmap>)` op poort `0` en doet de verzoeken met `fetch`. Na afloop sluit hij de server.
- `GET /` → status `200`, `content-type` begint met `text/html`, de body bevat `<html lang="nl">`.
- `GET /scripts/serve.mjs` → status `200`, `content-type` begint met `text/javascript`.
- `GET /bestaat-niet.txt` → status `404`.
- `GET /..%2Fpackage.json` en `GET /..%5Cpackage.json` → status `403` of `404`, nooit `200`.

- [ ] **Stap 3: Draai de test en zie hem falen**

Run: `npm test`
Expected: FAIL, want `scripts/serve.mjs` bestaat nog niet.

- [ ] **Stap 4: Bouw `createDevServer(rootDir)` in `scripts/serve.mjs`**

Gebruik alleen `node:http`, `node:fs/promises` en `node:path`. `/` geeft `index.html`. Decodeer de URL, los hem op tegen `rootDir` met `path.resolve`, en weiger met `403` alles wat daarna niet binnen `rootDir` ligt. Het MIME-type volgt uit de extensie: `.html` → `text/html; charset=utf-8`, `.js`/`.mjs` → `text/javascript; charset=utf-8`, `.css` → `text/css; charset=utf-8`, `.svg` → `image/svg+xml`, `.json` → `application/json`, `.webmanifest` → `application/manifest+json`, `.png` → `image/png`. Elke response krijgt `Cache-Control: no-store`, zodat je tijdens het bouwen nooit een oude versie ziet.

- [ ] **Stap 5: Draai de test en zie hem slagen**

Run: `npm test`
Expected: PASS, met alle tests uit `tests/serve.test.js` geslaagd.

- [ ] **Stap 6: Commit**

```bash
git add package.json .gitignore index.html scripts/serve.mjs tests/serve.test.js docs/
git commit -m "Projectopzet en lokale dev-server"
```

---

### Task 2: FEN lezen

**Files:**
- Create: `src/fen.js`
- Test: `tests/fen.test.js`

**Interfaces:**
- Produces: `START_FEN: string` = `'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'`
- Produces: `boardFromFen(fen: string): Record<string, string>`. Leest alleen het eerste veld (de stelling). De keys zijn veldnamen `'a1'`…`'h8'`, de values zijn FEN-letters (`'K'`, `'Q'`, `'R'`, `'B'`, `'N'`, `'P'` voor wit, kleine letters voor zwart). Lege velden staan er niet in. Bij een ongeldige stelling gooit de functie `Error` met een bericht dat begint met `'Ongeldige FEN'`.

- [ ] **Stap 1: Schrijf de falende tests in `tests/fen.test.js`**

- `boardFromFen(START_FEN)` heeft precies 32 keys.
- `e1` → `'K'`, `d1` → `'Q'`, `e8` → `'k'`, `d8` → `'q'`, `a1` → `'R'`, `h8` → `'r'`, `b1` → `'N'`, `g8` → `'n'`, `c1` → `'B'`, `f8` → `'b'`.
- Alle velden `a2`…`h2` → `'P'` en alle velden `a7`…`h7` → `'p'`.
- `e4` staat er niet in.
- `boardFromFen('8/8/8/8/4K3/8/8/8 w - - 0 1')` geeft precies `{ e4: 'K' }`.
- Elk van deze gooit een fout met `/^Ongeldige FEN/`: `''`, `'8/8/8/8/8/8/8 w - - 0 1'` (7 rijen), `'9/8/8/8/8/8/8/8 w - - 0 1'` (een rij van 9), `'7/8/8/8/8/8/8/8 w - - 0 1'` (een rij van 7), `'8/8/8/8/8/8/8/7X w - - 0 1'` (onbekend teken).

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/fen.js` bestaat nog niet.

- [ ] **Stap 3: Bouw `START_FEN` en `boardFromFen(fen)` in `src/fen.js`**

De FEN begint bij rij 8 (a8) en eindigt bij rij 1 (h1). Cijfers 1–8 betekenen zoveel lege velden.

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/fen.js tests/fen.test.js
git commit -m "FEN lezen"
```

---

### Task 3: Het bord tekenen

**Files:**
- Create: `src/board-view.js`
- Create: `src/main.js`
- Create: `css/style.css`
- Create: `assets/pieces/` met 12 SVG's: `wK wQ wR wB wN wP bK bQ bR bB bN bP` (`.svg`)
- Create: `CREDITS.md`
- Modify: `index.html`
- Test: `tests/board-view.test.js`

**Interfaces:**
- Consumes: `START_FEN` en `boardFromFen(fen)` uit `src/fen.js`.
- Produces in `src/board-view.js`:
  - `squareOrder(orientation: 'white' | 'black'): string[]`: 64 veldnamen in de volgorde waarin ze getekend worden, van linksboven naar rechtsonder.
  - `isLightSquare(square: string): boolean`
  - `pieceImage(piece: string): string`: het relatieve pad naar de SVG, bijvoorbeeld `'K'` → `'assets/pieces/wK.svg'` en `'p'` → `'assets/pieces/bP.svg'`.
  - `pieceName(piece: string): string`: Nederlandse naam voor de `alt`-tekst, bijvoorbeeld `'K'` → `'witte koning'` en `'n'` → `'zwart paard'`.
  - `renderBoard(container: HTMLElement, pieces: Record<string, string>, options?: { orientation?: 'white' | 'black' }): void`: vervangt de inhoud van `container` door 64 elementen `div.square.light` of `div.square.dark`, elk met `data-square="<veld>"`. Een bezet veld krijgt `<img class="piece" src="<pieceImage>" alt="<pieceName>" draggable="false">`. De onderste rij in beeld toont de letter van de lijn in een `span.coord.file` en de linker kolom in beeld toont het rijnummer in een `span.coord.rank`. De standaardrichting is `'white'`.

- [ ] **Stap 1: Haal de stukken op en leg de bron vast**

Download de 12 bestanden van `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/<naam>.svg` naar `assets/pieces/`. Controleer dat elk bestand begint met `<svg` of `<?xml`, en dat er geen `<script` of `on…=`-attributen in staan. Maak `CREDITS.md` met: de stukken "cburnett" zijn gemaakt door Colin M.L. Burnett, de licentie is GPLv2+ (https://www.gnu.org/licenses/gpl-2.0.txt), en de bron is lichess-org/lila (`public/piece/cburnett`).

- [ ] **Stap 2: Schrijf de falende tests in `tests/board-view.test.js`**

- `squareOrder('white')` heeft lengte 64; element 0 is `'a8'`, element 7 is `'h8'`, element 56 is `'a1'` en element 63 is `'h1'`.
- `squareOrder('black')`: element 0 is `'h1'`, element 7 is `'a1'`, element 56 is `'h8'` en element 63 is `'a8'`.
- Beide richtingen bevatten elk veld precies één keer (`new Set(...).size === 64`).
- `isLightSquare('a1') === false`, `isLightSquare('h1') === true`, `isLightSquare('a8') === true`, `isLightSquare('e4') === true`, `isLightSquare('d4') === false`.
- `pieceImage('K') === 'assets/pieces/wK.svg'` en `pieceImage('p') === 'assets/pieces/bP.svg'`. Voor alle 12 letters begint het pad niet met `'/'`.
- `pieceName('Q') === 'witte dame'`, `pieceName('n') === 'zwart paard'`, `pieceName('b') === 'zwarte loper'`.

`renderBoard` wordt niet in Node getest, want er is geen DOM. Die controle gebeurt in stap 7.

- [ ] **Stap 3: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/board-view.js` bestaat nog niet.

- [ ] **Stap 4: Bouw de functies in `src/board-view.js`**

De Nederlandse namen zijn koning, dame, toren, loper, paard en pion. Let op de buiging van het lidwoord: "witte/zwarte" bij de-woorden en "wit/zwart" bij het-woorden (het paard). `renderBoard` gebruikt `squareOrder` en `isLightSquare`, en tekent dus niet zelf de volgorde.

- [ ] **Stap 5: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 6: Pagina, stijl en opstartcode**

`index.html` krijgt `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<link rel="stylesheet" href="css/style.css">`, een `<header>` met `<h1>Schaak</h1>`, een `<main>` met `<div id="board" class="board">` en `<script type="module" src="src/main.js">`. `src/main.js` roept `renderBoard(document.getElementById('board'), boardFromFen(START_FEN))` aan.

`css/style.css`:
- kleuren als CSS-variabelen op `:root` (licht veld `#f0d9b5`, donker veld `#b58863`, achtergrond, tekst), met donkere varianten onder `@media (prefers-color-scheme: dark)` voor de achtergrond en de tekst. De bordkleuren blijven gelijk.
- `.board` is een grid van 8×8, `aspect-ratio: 1`, met de breedte `min(100vw - 16px, 100dvh - <hoogte van de header>, 640px)`, gecentreerd.
- `.piece` vult het veld (`width: 100%; height: 100%`), met `user-select: none` en `-webkit-user-drag: none`.
- `.coord` is klein (ongeveer 0,7× de lettergrootte), staat in de hoek van het veld en krijgt de kleur van het tegenovergestelde veld.
- `body` heeft `margin: 0` en een expliciete achtergrondkleur.

- [ ] **Stap 7: Controleer het in de browser**

Run: `npm start`, en open daarna `http://localhost:8080` in Chrome.
Expected:
- Wit staat onderaan en zwart bovenaan. De witte dame staat op d1, een licht veld. De koningen staan op de e-lijn. a1 is donker en h1 is licht.
- De letters a–h staan onderaan en de cijfers 1–8 links.
- In DevTools zijn er geen fouten in de Console en geen `404` in het tabblad Network.
- In DevTools met apparaatweergave op 360×640: het bord is vierkant, valt binnen het scherm en er is geen horizontale scrollbalk. Ook liggend (640×360) past het bord volledig.

- [ ] **Stap 8: Commit**

```bash
git add index.html css/ src/main.js src/board-view.js assets/ CREDITS.md tests/board-view.test.js
git commit -m "Schaakbord met stukken in de beginstelling"
```
