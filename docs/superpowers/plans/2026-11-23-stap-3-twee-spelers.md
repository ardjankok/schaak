# Stap 3: Speelbaar met twee spelers (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twee mensen kunnen op één telefoon tegen elkaar schaken: zetten doen door te tikken, de mogelijke zetten lichten op, promotie via een keuzemenu, en een melding bij schaak, mat, pat en remise.

**Architecture:** Een `Game`-klasse (`src/game.js`) houdt de partij bij en vertaalt tikken naar acties. Hij is puur en zonder DOM, zodat alle spellogica in Node getest kan worden. `board-view.js` krijgt een pure functie `squareClasses` die per veld bepaalt welke markering het krijgt; `renderBoard` gebruikt die. `main.js` koppelt klikken, het promotiemenu (`<dialog>`) en de statusregel aan `Game`, en tekent na elke actie opnieuw.

**Tech Stack:** HTML, CSS, JavaScript (ES-modules), `node --test`; de regels uit `src/chess/` (stap 2).

**Spec:** `docs/superpowers/specs/2026-11-23-schaak-app-design.md`

## Global Constraints

- Alle tekst in de app is Nederlands.
- Bediening: tik op een stuk, dan op het doelveld. Mogelijke zetten, de laatste zet en een koning die schaak staat worden gemarkeerd. Promotie via een keuzemenu.
- Remise door herhaling en de 50-zettenregel gaan automatisch (`gameStatus` uit stap 2).
- Wit staat onderaan (twee spelers op één telefoon; kleur kiezen komt in stap 6).
- Geen afhankelijkheden; relatieve paden; het bord past op 360 px breed zonder horizontaal scrollen.
- Velden groot genoeg voor een duim. Liggend op een telefoon mag het bord niet onnodig klein worden door de titel of de statusregel.

## Review Focus

1. **Tikken terwijl het promotiemenu open staat, of na het einde van de partij**, mag geen zet doen. → tests in Task 1.
2. **Het promotiemenu sluiten zonder keuze** (tik naast het menu, Esc, terugknop van Android) mag de partij niet vastzetten: daarna kun je gewoon verder. → test `cancelPromotion` in Task 1, en handmatig in Task 3.
3. **Een stuk dat gepend is** (geen legale zetten) kun je selecteren, maar er licht niets op en tikken ergens anders heft de selectie op. → test in Task 1.
4. **Een lange melding** ("Remise: 50 zetten zonder slag of pionzet") past op 360 px zonder het bord te verschuiven. → handmatig in Task 3.
5. **Liggend op een telefoon (640×360)** past alles, en het bord is groter dan in stap 1 (meer dan 288 px). → handmatig in Task 3.

---

### Task 1: Spellogica (`Game`)

**Files:**
- Create: `src/game.js`
- Modify: `src/chess/notation.js` (`moveToUci` met een niet-getal geeft `null`; uitgesteld reviewpunt uit stap 2)
- Test: `tests/game.test.js`
- Test: `tests/chess/notation.test.js` (één test erbij)

**Interfaces:**
- Consumes: `START_FEN` (`src/fen.js`); `fromFen`, `makeMove`, `boardFromPosition` (`src/chess/position.js`); `generateLegalMoves`, `isInCheck` (`src/chess/movegen.js`); `gameStatus` (`src/chess/status.js`); `moveFromUci`, `moveToUci` (`src/chess/notation.js`); `squareName`, `moveFrom`, `moveTo`, `movePromotion`, `WHITE` (`src/chess/constants.js`).
- Produces in `src/game.js`:
  - `class Game`:
    - `constructor(fen = START_FEN)` en `reset(fen = START_FEN): void`
    - getters: `turn: 'white' | 'black'`, `selected: string | null`, `lastMove: { from: string, to: string } | null`, `pendingPromotion: { from: string, to: string } | null`, `status: { result, winner }` (zoals `gameStatus`), `checkSquare: string | null` (veld van de koning die aan zet is en schaak staat), `isOver: boolean` (`status.result !== 'ongoing'`)
    - `pieces(): Record<string, string>`
    - `targets(): string[]`: de doelvelden van het geselecteerde stuk, uniek en gesorteerd (bij promotie komt het doelveld dus één keer voor); `[]` zonder selectie.
    - `tap(square: string): 'selected' | 'deselected' | 'moved' | 'promotion' | 'ignored'`
    - `choosePromotion(letter: 'q' | 'r' | 'b' | 'n'): boolean`
    - `cancelPromotion(): void`
    - `statusText(): string` = `describeStatus(this.status, this.turn, this.checkSquare !== null)`
  - `describeStatus(status, turn: 'white' | 'black', inCheck: boolean): string`, met precies deze teksten:
    - lopend: `'Wit is aan zet'` / `'Zwart is aan zet'`; bij schaak `'Schaak! Wit is aan zet'` / `'Schaak! Zwart is aan zet'`
    - `checkmate`: `'Schaakmat! Wit wint'` / `'Schaakmat! Zwart wint'`
    - `stalemate`: `'Pat: remise'`
    - `draw-fifty`: `'Remise: 50 zetten zonder slag of pionzet'`
    - `draw-repetition`: `'Remise: drie keer dezelfde stelling'`
    - `draw-material`: `'Remise: te weinig materiaal om mat te zetten'`

**Regels voor `tap(square)`**, in deze volgorde:
1. Partij voorbij of een promotie wacht op een keuze → `'ignored'`, er verandert niets.
2. Er is een selectie en `square` zit in `targets()` → is het een promotie, dan wordt `pendingPromotion` gezet en geeft `tap` `'promotion'` terug (er wordt nog niets gezet); anders wordt de zet gedaan, `selected` wordt `null`, `lastMove` wordt gezet en `tap` geeft `'moved'`.
3. `square` is hetzelfde als `selected` → selectie eraf, `'deselected'`.
4. Op `square` staat een stuk van de speler aan zet → dat wordt `selected`, `'selected'` (ook als het geen legale zetten heeft).
5. Anders: was er een selectie, dan gaat die eraf en geeft `tap` `'deselected'`; zonder selectie `'ignored'`.

- [ ] **Stap 1: Schrijf de falende tests in `tests/game.test.js`**

- Nieuw spel: `turn === 'white'`, `selected === null`, `lastMove === null`, `status` deep-equal `{ result: 'ongoing', winner: null }`, `checkSquare === null`, `statusText() === 'Wit is aan zet'`.
- `tap('e2')` → `'selected'`, `selected === 'e2'`, `targets()` deep-equal `['e3', 'e4']`.
- Zonder selectie `tap('e7')` (stuk van zwart) en `tap('e4')` (leeg) → `'ignored'`.
- `tap('e2')`, `tap('e4')` → `'moved'`; daarna `turn === 'black'`, `lastMove` deep-equal `{ from: 'e2', to: 'e4' }`, `pieces().e4 === 'P'`, `'e2' in pieces() === false`, `selected === null`.
- `tap('e2')`, `tap('e5')` → `'deselected'` en er is niets gezet (`pieces().e2 === 'P'`, `turn === 'white'`).
- `tap('e2')`, `tap('d2')` → `'selected'`, `selected === 'd2'`.
- `tap('e2')`, `tap('e2')` → `'deselected'`.
- Gepend stuk (Review Focus 3): `new Game('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1')`: `tap('e2')` → `'selected'`, `targets()` deep-equal `[]`; `tap('a1')` → `'deselected'`.
- Promotie: `new Game('k7/4P3/8/8/8/8/8/K7 w - - 0 1')`: `tap('e7')`, `tap('e8')` → `'promotion'`, `pendingPromotion` deep-equal `{ from: 'e7', to: 'e8' }`, `pieces().e7 === 'P'`; `tap('a1')` → `'ignored'` (Review Focus 1); `choosePromotion('x') === false` en nog steeds pending; `choosePromotion('n') === true`, `pieces().e8 === 'N'`, `turn === 'black'`, `pendingPromotion === null`, `lastMove` deep-equal `{ from: 'e7', to: 'e8' }`.
- Promotie annuleren (Review Focus 2): zelfde stelling, `tap('e7')`, `tap('e8')`, `cancelPromotion()` → `pendingPromotion === null`, `selected === null`, `turn === 'white'`; daarna `tap('a1')` → `'selected'`.
- Gekkenmat met tikken: `f2→f3`, `e7→e5`, `g2→g4`, `d8→h4` → `status` deep-equal `{ result: 'checkmate', winner: 'black' }`, `isOver === true`, `checkSquare === 'e1'`, `statusText() === 'Schaakmat! Zwart wint'`, en `tap('e1')` → `'ignored'` (Review Focus 1).
- Schaak: `new Game('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')`, zet `a1→a8` → `checkSquare === 'e8'`, `statusText() === 'Schaak! Zwart is aan zet'`.
- `reset()` na een paar zetten → weer de beginstelling (`pieces()` heeft 32 stukken, `turn === 'white'`, `lastMove === null`).
- `describeStatus` geeft voor elke combinatie hierboven exact de genoemde tekst (één test met een tabel van alle 10 gevallen: lopend en schaak voor wit en zwart, mat voor wit en zwart, pat, en de drie soorten remise).

In `tests/chess/notation.test.js`: `moveToUci(null) === null` en `moveToUci(undefined) === null`.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/game.js` bestaat nog niet en `moveToUci(null)` geeft `'a1a1'`.

- [ ] **Stap 3: Bouw `src/game.js` en pas `moveToUci` aan**

`Game` houdt de lijst legale zetten van de huidige stelling bij en rekent die (en `status`) opnieuw uit na elke zet en na `reset`. Een zet doen gaat via `moveFromUci(pos, from + to + promotie)`.

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/game.js src/chess/notation.js tests/game.test.js tests/chess/notation.test.js
git commit -m "Spellogica: tikken, promotie en meldingen"
```

---

### Task 2: Markeringen op het bord

**Files:**
- Modify: `src/board-view.js`
- Test: `tests/board-view.test.js`

**Interfaces:**
- Consumes: niets nieuws.
- Produces in `src/board-view.js`:
  - `squareClasses(square: string, view: { pieces, selected?, targets?, lastMove?, check? }): string[]`: altijd `'square'` en `'light'` of `'dark'`; plus `'selected'` als `square === view.selected`; `'target'` als `square` in `view.targets` staat, met daarnaast `'capture'` als er een stuk op staat; `'last-move'` als `square` gelijk is aan `view.lastMove.from` of `.to`; `'check'` als `square === view.check`.
  - `renderBoard(container, pieces, options)` krijgt de extra opties `selected`, `targets`, `lastMove` en `check`, en gebruikt `squareClasses` voor de `className`. De container krijgt `role="group"` (uitgesteld reviewpunt uit stap 1). Elk veld krijgt een `aria-label` met de veldnaam en, als er een stuk staat, de naam: `'e2, witte pion'` of `'e4'`.

- [ ] **Stap 1: Schrijf de falende tests**

Met `pieces = { e2: 'P', d7: 'p' }`:
- `squareClasses('a1', { pieces })` deep-equal `['square', 'dark']`.
- `squareClasses('e2', { pieces, selected: 'e2' })` bevat `'selected'`.
- `squareClasses('e4', { pieces, targets: ['e3', 'e4'] })` bevat `'target'` en niet `'capture'`.
- `squareClasses('d7', { pieces, targets: ['d7'] })` bevat `'target'` en `'capture'`.
- `squareClasses('e2', { pieces, lastMove: { from: 'e2', to: 'e4' } })` en `squareClasses('e4', …)` bevatten `'last-move'`; `'e3'` niet.
- `squareClasses('e1', { pieces, check: 'e1' })` bevat `'check'`.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `squareClasses` bestaat nog niet.

- [ ] **Stap 3: Bouw `squareClasses` en breid `renderBoard` uit**

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/board-view.js tests/board-view.test.js
git commit -m "Markeringen op het bord"
```

---

### Task 3: Alles aan elkaar: tikken, promotiemenu, statusregel

**Files:**
- Modify: `index.html`, `src/main.js`, `css/style.css`

**Interfaces:**
- Consumes: `Game` (Task 1), `renderBoard` en `pieceImage` (Task 2 en stap 1).

- [ ] **Stap 1: Pagina**

`index.html` krijgt onder het bord in `<main>` een `<section class="panel">` met `<p id="status" role="status" aria-live="polite"></p>` en `<button id="new-game" type="button" hidden>Nieuwe partij</button>`, en een `<dialog id="promotion" aria-label="Kies een stuk voor de promotie">` met vier `<button type="button" data-piece="q|r|b|n">` die elk een `<img>` van het stuk bevatten (de `src` zet `main.js`, in de kleur van de speler die promoveert) en een `aria-label`: `'Promoveer tot dame'`, `'… toren'`, `'… loper'`, `'… paard'`.

- [ ] **Stap 2: Koppelen in `src/main.js`**

- Eén `click`-listener op `#board` (event delegation): `event.target.closest('[data-square]')` → `game.tap(square)`.
- Bij `'promotion'`: de vier plaatjes op de kleur van de speler aan zet zetten en `dialog.showModal()`. Een knop → `game.choosePromotion(letter)` en `dialog.close()`. Het `close`-event van de dialog (dus ook Esc, tik op de achtergrond, en de terugknop van Android) roept `game.cancelPromotion()` aan als er dan nog een promotie wacht. Tik op de achtergrond: een `click` op de dialog zelf (niet op een knop) sluit hem.
- Na elke actie: `render()` tekent het bord met `selected`, `targets()`, `lastMove` en `checkSquare`, zet `#status` op `game.statusText()`, en toont `#new-game` alleen als `game.isOver`.
- `#new-game` → `game.reset()` en `render()`.

- [ ] **Stap 3: Stijl in `css/style.css`**

- Markeringen bovenop de veldkleur, onder het stuk: `.selected` en `.last-move` met een `box-shadow: inset 0 0 0 999px <kleur met transparantie>` (geselecteerd iets sterker dan laatste zet); `.target` met een stip in het midden (`background-image: radial-gradient(...)`, ongeveer 30% van het veld); `.target.capture` met een ring langs de rand in plaats van een stip; `.check` met een rode radiale gloed.
- `.panel`: hoogte `var(--panel-height)` (ongeveer 56 px), tekst gecentreerd, de statusregel mag over twee regels lopen maar duwt het bord niet weg. De bordgrootte wordt `min(100vw - var(--gutter), 100dvh - var(--header-height) - var(--panel-height) - var(--gutter), 640px)`.
- Liggend op een telefoon (`@media (orientation: landscape) and (max-height: 500px)`): de `<header>` verdwijnt, `<main>` wordt een rij (bord links, `.panel` rechts met een breedte van ongeveer 180 px), en de bordgrootte wordt `min(100dvh - var(--gutter), 100vw - 180px - var(--gutter))`.
- De dialog: gecentreerd, vier knoppen naast elkaar van minstens 56×56 px, een donkere `::backdrop`.
- Knoppen (`#new-game`, de promotieknoppen): minstens 44 px hoog, met de kleurvariabelen van de pagina, ook in donkere modus leesbaar.

- [ ] **Stap 4: Controleer het in de browser**

Run: `npm test` (Expected: PASS) en `npm start`, en open daarna `http://localhost:8080`.
Expected (de bouwer controleert dit met headless Chrome: screenshots, en klikken via het DevTools-protocol of `element.click()`):
- Tik e2: e2 is gemarkeerd, op e3 en e4 staat een stip. Tik e4: de pion staat op e4, e2 en e4 hebben de markering voor de laatste zet, en de status is "Zwart is aan zet".
- Gekkenmat (f3, e5, g4, Dh4): de koning op e1 gloeit rood, de status is "Schaakmat! Zwart wint", de knop "Nieuwe partij" is zichtbaar en zet het bord terug.
- Promotie (zet de stelling tijdelijk via de console op `k7/4P3/8/8/8/8/8/K7 w - - 0 1`, of speel ernaartoe): het menu verschijnt met vier witte stukken; paard kiezen zet een paard neer; opnieuw proberen en dan Esc of naast het menu tikken sluit het menu en je kunt weer gewoon zetten.
- Op 360×640 (in een iframe van 360 px, zoals in stap 1): bord en statusregel passen, ook de langste melding, zonder horizontale scrollbalk.
- Op 640×360: geen titel, het bord links (groter dan 288 px), de status rechts.
- Geen fouten in de console.

- [ ] **Stap 5: Commit**

```bash
git add index.html src/main.js css/style.css
git commit -m "Speelbaar met twee spelers: tikken, promotiemenu en statusregel"
```
