# Stap 4: Tegenstander, versie 1 (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Je speelt met wit tegen de computer. De computer zoekt een zet met minimax en alfa-bèta, beoordeelt stellingen op materiaal, en denkt na in een Web Worker, zodat het scherm nooit bevriest.

**Architecture:** De engine (`src/engine/`) is puur en zonder DOM. `evaluate.js` telt materiaal, `search.js` doet negamax met alfa-bèta op vaste diepte, en `engine.js` vertaalt een verzoek (beginstelling plus gespeelde zetten) naar een antwoord. `worker.js` is alleen de lijm tussen `postMessage` en `engine.js`. `Game` krijgt een computerkleur: tikken telt niet als de computer aan zet is, en `playUci` speelt de zet van de computer. `main.js` stuurt na elke zet van de speler een verzoek naar de worker.

**Tech Stack:** JavaScript (ES-modules), een module-Web Worker, `node --test`; de regels uit `src/chess/` (stap 2).

**Spec:** `docs/superpowers/specs/2026-11-23-schaak-app-design.md`

## Global Constraints

- Geen afhankelijkheden, geen bestaande schaakbibliotheek; alle tekst in de app is Nederlands.
- Engine: minimax met alfa-bètasnoeiing en een evaluatie op basis van materiaal, in een **Web Worker** ("Het scherm bevriest terwijl de computer nadenkt" is een anti-doel).
- "De computer doet een illegale zet" is een anti-doel: elke zet van de engine komt uit `generateLegalMoves`, en `Game` speelt alleen legale zetten.
- Controle: de nieuwe engine speelt een reeks partijen tegen de vorige versie en moet duidelijk winnen, en lost tactische testposities op (mat-in-2, een stuk winnen). Er is nog geen vorige engine, dus versie 1 speelt tegen een speler die willekeurige legale zetten doet.
- Wit staat onderaan; jij speelt wit, de computer zwart. Kleur en niveau kiezen, en de speelstand voor twee spelers, komen in stap 6. Zetordening, quiescence, iteratieve verdieping en positietabellen komen in stap 5.

## Review Focus

1. **De computer promoveert** (een UCI-zet met een stukletter, zoals `a2a1q`): het bord toont het nieuwe stuk, er verschijnt geen promotiemenu. → test in Task 1 (de engine kiest `a2a1q`) en Task 3 (`playUci` met promotie).
2. **De partij eindigt door een zet van de computer** (mat, pat, automatische remise): de juiste melding, de knop "Nieuwe partij", en geen nieuw verzoek aan de computer. → test in Task 3.
3. **Tikken terwijl de computer aan zet is**, ook op de eigen stukken van de computer, doet niets. → test in Task 3.
4. **Een antwoord van de engine dat niet bij de stelling past** (een oud antwoord na "Nieuwe partij", of een ongeldige zet) wordt nooit gespeeld. → `playUci` geeft `false` (test in Task 3), en `main.js` negeert antwoorden met een oud volgnummer (Task 4).
5. **Denktijd op een telefoon**: zonder zetordening kan diepte 3 in drukke stellingen veel langer duren dan in de beginstelling. → het wedstrijdscript meet de langste zet (Task 2), met een grens.

---

### Task 1: Evaluatie en zoeken

**Files:**
- Create: `src/engine/evaluate.js`, `src/engine/search.js`, `src/engine/random.js`
- Modify: `src/chess/status.js` (herhaling tellen als losse functie)
- Test: `tests/engine/evaluate.test.js`, `tests/engine/search.test.js`, `tests/chess/status.test.js` (één test erbij)

**Interfaces:**
- Consumes: `fromFen`, `makeMove`, `unmakeMove`, `toFen` (`src/chess/position.js`); `generateLegalMoves`, `isInCheck` (`src/chess/movegen.js`); `isInsufficientMaterial` (`src/chess/status.js`); `moveToUci`, `moveFromUci` (`src/chess/notation.js`); `pieceType`, `pieceColor`, `WHITE` (`src/chess/constants.js`).
- Produces:
  - `src/chess/status.js`: `countRepetitions(pos): number`. Hoe vaak de huidige stelling is voorgekomen, inclusief nu. `isThreefoldRepetition(pos)` wordt `countRepetitions(pos) >= 3`.
  - `src/engine/random.js`: `createRandom(seed: number): () => number`, mulberry32, getallen in `[0, 1)`.
  - `src/engine/evaluate.js`: `PIECE_VALUES` (index stuktype: `[0, 100, 320, 330, 500, 900, 0]`); `evaluate(pos): number` = materiaal van de speler aan zet min dat van de tegenstander.
  - `src/engine/search.js`: `MATE = 100000`; `isDraw(pos): boolean`; `search(pos, { depth: number, random?: () => number }): { move: number | null, score: number, nodes: number }`.

**Het zoekalgoritme** (de tests leggen niet alles vast):
- Negamax met alfa-bèta, vaste diepte. `nodes` telt elke bezochte stelling.
- In een knoop op `ply > 0`: `isDraw(pos)` → `0`. Op diepte 0: `evaluate(pos)`, zonder te kijken of er nog zetten zijn. Geen legale zetten: schaak → `-(MATE - ply)`, anders `0` (pat). Een mat na `n` halve zetten wordt dus pas gezien vanaf diepte `n + 1`: mat in 1 vanaf diepte 2, mat in 2 vanaf diepte 4.
- `isDraw(pos)`: `halfmoveClock >= 100`, `isInsufficientMaterial(pos)`, of `countRepetitions(pos) >= 2`. In de zoekboom telt een herhaling al als remise; anders loopt een engine die voor staat in een herhaling.
- In de wortel worden de legale zetten eerst geschud met `random` (Fisher-Yates, standaard `Math.random`). Een zet wordt alleen de beste als hij **strikt** beter is. Bij gelijke scores kiest de engine dus willekeurig, en met een vaste seed altijd hetzelfde.
- Geen legale zetten in de wortel → `{ move: null, score: <mat of pat>, nodes }`.
- `pos` is na `search` precies zoals ervoor (alle `makeMove`s worden teruggedraaid).

- [ ] **Stap 1: Schrijf de falende tests**

`tests/engine/evaluate.test.js`:
- Beginstelling → `0`.
- `'4k3/8/8/8/8/8/8/3QK3 w - - 0 1'` → `900`; dezelfde stelling met zwart aan zet (`b`) → `-900`.
- `'4k3/pppp4/8/8/8/8/8/R2NK3 w - - 0 1'` → `500 + 320 - 4 * 100 = 420`.

`tests/chess/status.test.js`: na `g1f3 g8f6 f3g1 f6g8` vanuit de beginstelling → `countRepetitions === 2`; in de beginstelling zelf `1`.

`tests/engine/search.test.js` (alle zoekopdrachten met `random: createRandom(1)`):
- `createRandom(42)` geeft twee keer dezelfde reeks, en elk getal ligt in `[0, 1)`.
- **Mat in 1**: `'6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'`, diepte 3 → `moveToUci(move) === 'a1a8'` en `score === MATE - 1`.
- **Mat in 2**: `'r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 0 1'`, diepte 4 → `'d5d8'` en `score === MATE - 3`. Dit is de enige oplossing: Dd8+ Lxd8 (gedwongen), Te8#.
- **Paardvork wint de dame**: `'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1'`, diepte 3 → `'b5c7'`.
- **Geen gedekte pion slaan met de dame**: `'4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1'`, diepte 2 → niet `'d1d5'`.
- **Pat vermijden als je wint**: `'7k/5Q2/8/8/8/8/8/K7 w - - 0 1'`, diepte 3 → na de gekozen zet is `gameStatus(pos).result !== 'stalemate'` (4 van de 26 zetten geven pat).
- **Promotie**: `'4k3/8/8/8/8/8/p7/4K3 b - - 0 1'`, diepte 2 → `'a2a1q'`.
- **Enige zet, verloren stelling**: `'8/8/8/8/8/5k2/8/r6K w - - 0 1'`, diepte 3 → `'h1h2'` en `score < 0`.
- **Geen zetten**: `'k7/8/1Q6/8/8/8/8/K7 b - - 0 1'` (pat) → `move === null`, `score === 0`.
- **Herhaling**: `isDraw` is `false` in de beginstelling, en `true` na `g1f3 g8f6 f3g1 f6g8`.
- **Herhaling ontwijken als je voor staat**: `'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1'` (wit zonder dame) na `g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1`: zwart zoekt op diepte 2, voor 10 verschillende seeds → nooit `'f6g8'`. Die zet zou de stelling voor de derde keer laten voorkomen.
- **Stelling blijft gelijk**: na `search` op Kiwipete (`PERFT_FENS` uit `tests/chess/fixtures.js`) op diepte 3 zijn `toFen`, `hashLo`/`hashHi` en `history.length` gelijk aan ervoor, en `nodes > 0`.
- **Altijd legaal**: vanuit de beginstelling 20 zetten na elkaar door de engine zelf laten spelen (diepte 2, seed 7): elke zet zit in `generateLegalMoves` van dat moment.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/engine/*` bestaat nog niet en `countRepetitions` ook niet.

- [ ] **Stap 3: Bouw `random.js`, `evaluate.js`, `search.js` en `countRepetitions`**

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/engine tests/engine src/chess/status.js tests/chess/status.test.js
git commit -m "Engine v1: materiaal en alfa-bèta"
```

---

### Task 2: Worker en wedstrijd tegen toeval

**Files:**
- Create: `src/engine/engine.js`, `src/engine/worker.js`, `scripts/match.mjs`
- Modify: `package.json` (script `"match": "node scripts/match.mjs"`)
- Test: `tests/engine/engine.test.js`

**Interfaces:**
- Consumes: `search`, `createRandom` (Task 1); `fromFen`, `makeMove` (`src/chess/position.js`); `moveFromUci`, `moveToUci` (`src/chess/notation.js`); `gameStatus` (`src/chess/status.js`).
- Produces in `src/engine/engine.js`:
  - `positionFromMoves(startFen: string, moves: string[]): Position`. Gooit `Error('Ongeldige zet: <uci>')` bij een zet die niet legaal is.
  - `handleRequest(request: { id, startFen, moves, depth, seed? }): { id, move: string | null, score: number, nodes: number } | { id, error: string }`. Gooit nooit: een fout wordt `{ id, error }`. Zonder `seed` gebruikt de engine `Math.random`.
- Produces in `src/engine/worker.js`: `self.onmessage = (event) => self.postMessage(handleRequest(event.data))`. Verder niets.
- Produces: `npm run match`.

- [ ] **Stap 1: Schrijf de falende tests in `tests/engine/engine.test.js`**

- `positionFromMoves(START_FEN, ['e2e4', 'e7e5'])` → `toFen` is `'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'` en `history.length === 2`.
- `positionFromMoves(START_FEN, ['e2e5'])` gooit een fout met `'Ongeldige zet: e2e5'`.
- `handleRequest({ id: 7, startFen: START_FEN, moves: ['e2e4'], depth: 2, seed: 3 })` → `id === 7`, `move` is een legale zet voor zwart in die stelling, `nodes > 0`; met dezelfde seed twee keer hetzelfde antwoord.
- `handleRequest({ id: 8, startFen: START_FEN, moves: ['e2e5'], depth: 2 })` → `{ id: 8, error: 'Ongeldige zet: e2e5' }`.
- `handleRequest({ id: 9, startFen: 'nonsens', moves: [], depth: 2 })` → heeft `error` (de FEN-fout van stap 2), en gooit niet.
- Mat in 1 via een verzoek: `{ startFen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', moves: [], depth: 3 }` → `move === 'a1a8'`.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/engine/engine.js` bestaat nog niet.

- [ ] **Stap 3: Bouw `engine.js` en `worker.js`**

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Bouw `scripts/match.mjs`**

- 20 partijen: engine (diepte 3) tegen een speler die een willekeurige legale zet kiest. Om en om met wit en zwart. Partij `i` gebruikt `createRandom(1000 + i)` voor beide spelers, zodat elke run hetzelfde uitvalt.
- Een partij eindigt bij `gameStatus` ≠ `'ongoing'`, of na 400 halve zetten (dan telt hij als remise).
- Het script print per partij de uitslag en de reden, daarna winst/remise/verlies, de score (winst 1, remise ½), en de gemiddelde en langste denktijd van de engine per zet in ms.
- Het script eindigt met exitcode 1 als de score onder 18 uit 20 ligt, de engine een partij verliest, of de langste zet boven 2000 ms komt. Een telefoon is grofweg 3 tot 5 keer trager dan de laptop.

- [ ] **Stap 6: Draai de wedstrijd**

Run: `npm run match`
Expected: score ≥ 18/20, 0 verloren, langste zet < 2000 ms, exitcode 0. Noteer de gemeten tijden in de ledger. Taak 4 gebruikt ze om de diepte te kiezen.

- [ ] **Stap 7: Commit**

```bash
git add src/engine/engine.js src/engine/worker.js scripts/match.mjs package.json tests/engine/engine.test.js
git commit -m "Engine in een worker, en een wedstrijd tegen toeval"
```

---

### Task 3: `Game` tegen de computer

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: niets nieuws.
- Produces in `src/game.js`:
  - `new Game(fen = START_FEN, { computerColor = null } = {})`. `computerColor` is `'white'`, `'black'` of `null` (twee spelers). `reset(fen = START_FEN)` houdt de computerkleur.
  - getters `startFen: string`, `computerColor`, `isComputerTurn: boolean` (`computerColor !== null && !isOver && turn === computerColor`).
  - `moves(): string[]`: de gespeelde zetten in UCI sinds `startFen`, als kopie.
  - `playUci(uci: string): boolean`. Een legale zet wordt gespeeld zoals een zet door tikken: `lastMove` gezet, selectie en wachtende promotie eraf. Een ongeldige zet, of een zet als de partij voorbij is, geeft `false` en verandert niets.
  - `tap`: nieuwe eerste regel: `isComputerTurn` → `'ignored'`.
  - `status` en `lastMove` geven bevroren objecten (uitgesteld reviewpunt uit stap 3).
  - `describeStatus(status, turn, inCheck, computerColor = null)`. Met `null` zijn de teksten van stap 3 ongewijzigd. Met een computerkleur gelden precies deze teksten:
    - speler aan zet: `'Jij bent aan zet'` / bij schaak `'Schaak! Jij bent aan zet'`
    - computer aan zet: `'De computer denkt na…'` / bij schaak `'Schaak! De computer denkt na…'`
    - `checkmate`: `'Schaakmat! Jij wint'` of `'Schaakmat! De computer wint'`
    - pat en remise: dezelfde teksten als in stap 3.

- [ ] **Stap 1: Schrijf de falende tests**

Met `const game = new Game(START_FEN, { computerColor: 'black' })`:
- Begin: `isComputerTurn === false`, `statusText() === 'Jij bent aan zet'`, `moves()` deep-equal `[]`, `startFen === START_FEN`.
- `tap('e2')`, `tap('e4')` → `isComputerTurn === true`, `statusText() === 'De computer denkt na…'`, `moves()` deep-equal `['e2e4']`. Daarna `tap('e7')` → `'ignored'` (Review Focus 3) en `selected === null`.
- `playUci('e7e5') === true` → `turn === 'white'`, `lastMove` deep-equal `{ from: 'e7', to: 'e5' }`, `moves()` deep-equal `['e2e4', 'e7e5']`.
- `playUci('e2e5') === false` en `playUci('zzz') === false`: er verandert niets (`moves()` gelijk, `turn` gelijk). Dit is Review Focus 4.
- `moves()` is een kopie: `game.moves().push('x')` verandert `game.moves()` niet.
- Promotie door de computer (Review Focus 1): `new Game('4k3/8/8/8/8/8/p7/4K3 w - - 0 1', { computerColor: 'black' })`, speler `e1d1` via tikken, dan `playUci('a2a1q') === true` → `pieces().a1 === 'q'`, `pendingPromotion === null`.
- Mat door de computer (Review Focus 2): vanuit de beginstelling met tikken `f2f3`, computer `playUci('e7e5')`, tikken `g2g4`, computer `playUci('d8h4')` → `isOver === true`, `isComputerTurn === false`, `statusText() === 'Schaakmat! De computer wint'`, `playUci('a7a6') === false`.
- `reset()` → `computerColor === 'black'`, `moves()` deep-equal `[]`, `statusText() === 'Jij bent aan zet'`.
- Bevroren: `assert.throws(() => { game.lastMove.from = 'a1'; }, TypeError)` (na een zet), en hetzelfde voor `game.status.result`.
- `describeStatus` in een tabel met precies de teksten hierboven:
  - computer zwart, wit aan zet, wel en niet schaak
  - computer zwart, zwart aan zet, wel en niet schaak
  - mat met winnaar wit en met winnaar zwart
  - pat
  - en zonder computerkleur nog steeds `'Wit is aan zet'`

De bestaande tests van stap 3 blijven ongewijzigd slagen.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `playUci`, `moves`, `isComputerTurn` en de nieuwe teksten bestaan nog niet.

- [ ] **Stap 3: Bouw het in `src/game.js`**

`Game` houdt de lijst UCI-zetten bij in `_play` en leegt die bij `reset`. Bij `playUci` maakt het niet uit welke speler aan zet is: de controle of de computer aan zet is, gebeurt in `main.js`.

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/game.js tests/game.test.js
git commit -m "Game: tegen de computer spelen"
```

---

### Task 4: Koppelen in de pagina

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `Game` met `computerColor`, `isComputerTurn`, `startFen`, `moves()` en `playUci` (Task 3); het berichtformaat van `handleRequest` (Task 2).

- [ ] **Stap 1: Koppelen in `src/main.js`**

- `const game = new Game(START_FEN, { computerColor: 'black' })`.
- Eén worker voor de hele sessie: `new Worker(new URL('./engine/worker.js', import.meta.url), { type: 'module' })`.
- Constanten bovenin: `ENGINE_DEPTH = 3` (of lager als de gemeten langste zet in Task 2 boven 1000 ms lag; leg die keuze vast in de ledger) en `MIN_THINK_MS = 400`. Zonder minimale denktijd verschijnt de zet van de computer tegelijk met die van jou, en zie je niet wat er gebeurde.
- `askComputer()`: alleen als `game.isComputerTurn`. Verhoogt een volgnummer `requestId` en onthoudt de starttijd. Stuurt dan `{ id: requestId, startFen: game.startFen, moves: game.moves(), depth: ENGINE_DEPTH }`.
- Antwoord van de worker:
  - Is `id !== requestId`, dan wordt het genegeerd (Review Focus 4).
  - Anders wacht `main.js` tot `MIN_THINK_MS` voorbij is sinds de start, controleert het volgnummer nog een keer, en doet `game.playUci(move)` plus `render()`.
- Een antwoord met `error`, een `playUci` die `false` geeft, of een `error`-event van de worker:
  - `console.error`
  - de statusregel wordt `'De computer kon geen zet bedenken'`
  - de knop "Nieuwe partij" wordt zichtbaar

  Zo blijft het scherm nooit hangen op "De computer denkt na…".
- `askComputer()` na elke actie die een zet van de speler afrondt: `tap` geeft `'moved'`, of een promotiekeuze is gemaakt. Ook na "Nieuwe partij", met `requestId` eerst verhoogd zodat een oud antwoord niet meer telt.

- [ ] **Stap 2: Controleer het in de browser**

Run: `npm test` (Expected: PASS) en `npm start`, en open daarna `http://localhost:8080`.
Expected (headless Chrome, met de testpagina uit stap 3; de app staat bovenaan de pagina, niet in een iframe):
- Tik e2, e4: de status wordt "De computer denkt na…". Na minstens 400 ms staat er een zwarte zet op het bord, met de markering van de laatste zet, en de status is "Jij bent aan zet".
- Tikken terwijl de computer nadenkt doet niets.
- Tien zetten achter elkaar spelen (steeds een willekeurige legale zet voor wit, door te tikken): elke keer antwoordt de computer met een legale zet, en er zijn geen fouten in de console.
- Mat door de computer: speel `f2f3` als wit. Heeft zwart daarna e5 of e6 gespeeld, speel dan `g2g4`. Diepte 3 ziet mat in 1, dus de computer moet `d8h4` spelen. Dan staat er "Schaakmat! De computer wint" en is "Nieuwe partij" zichtbaar. Speelde zwart iets anders, begin dan opnieuw (de engine kiest bij gelijke stand willekeurig).
- "Nieuwe partij" zet het bord terug en de status op "Jij bent aan zet".
- Mat geven aan de computer is met de hand lastig te testen. Dat dekken de `Game`-tests (de tekst "Schaakmat! Jij wint" in de tabel).

- [ ] **Stap 3: Commit**

```bash
git add src/main.js
git commit -m "Tegen de computer spelen in de pagina"
```

---

## Voor later

- Stap 7 (service worker) moet ook `src/engine/*.js` in de cache zetten, anders werkt de tegenstander offline niet.
- Stap 5 vergelijkt de nieuwe engine met deze versie 1. Het wedstrijdscript krijgt dan een tweede engine als tegenstander, in plaats van de willekeurige speler.
