# Stap 2: Spelregels (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een eigen, snelle schaakregel-module die voor elke stelling alle legale zetten geeft (ook rokeren, en passant en promotie), zetten kan doen en terugdraaien, en herkent wanneer de partij voorbij is (mat, pat, 50-zettenregel, drievoudige herhaling, onvoldoende materiaal). Bewezen correct met perft.

**Architecture:** Een 0x88-bord (`Int8Array(128)`) met stukken als kleine getallen en zetten als één integer, zodat de engine later snel kan zoeken zonder per zet objecten aan te maken. Zetten worden "pseudo-legaal" gegenereerd. Een zet is legaal als na `makeMove` de eigen koning niet aangevallen wordt. Een Zobrist-hash (twee 32-bits helften) wordt bij elke zet bijgewerkt. Die hash dient nu voor herhaling en in stap 5 voor de transpositietabel. De UI raakt deze stap niet. `boardFromPosition` levert hetzelfde formaat als `boardFromFen` uit stap 1, zodat stap 3 kan aansluiten.

**Tech Stack:** JavaScript ES-modules (draaien in de browser én in Node), `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-schaak-app-design.md`

## Global Constraints

- Geen afhankelijkheden; geen Node-specifieke API's in `src/` (de code moet straks in de browser en in een Web Worker draaien).
- Alle regels kloppen: rokeren, en passant, promotie (naar dame, toren, loper of paard), schaak, mat, pat, 50-zettenregel, drievoudige herhaling, onvoldoende materiaal.
- Remise door herhaling en de 50-zettenregel gaan **automatisch** (geen claim): `halfmoveClock >= 100` is remise; dezelfde stelling voor de 3e keer is remise.
- Mat gaat vóór de 50-zettenregel: is de zet die de klok op 100 brengt mat, dan is het mat.
- Foutmeldingen in het Nederlands; een ongeldige FEN geeft een `Error` waarvan het bericht begint met `'Ongeldige FEN'` (zoals in stap 1).
- Snelheid telt: geen objecten per zet in de zetgenerator (zetten zijn getallen), bord als typed array.

## Review Focus

1. **De hash raakt uit de pas na een zeldzame zet** (rokade, en passant, promotie met slag), waardoor herhaling verkeerd wordt herkend. → test in Task 3: een vaste reeks van 300 zetten vanuit Kiwipete, na elke zet `hash === computeHash(pos)`, en daarna alles terugdraaien tot exact de begin-FEN.
2. **Dezelfde stukken, maar andere rokaderechten of een andere speler aan zet** mogen niet als herhaling tellen. → test in Task 4.
3. **Mat op de zet die de 50-zettengrens haalt** is mat, geen remise. → test in Task 4.
4. **Rommel als zet-invoer** (`''`, `'zz'`, `'e2e9'`, `'e2e4x'`) geeft `null` en geen crash. → test in Task 4.
5. **Een FEN met een en-passantveld waar niemand kan slaan** moet dezelfde hash hebben als dezelfde FEN met `-`, anders mist de herhalingscontrole een herhaling. → test in Task 1.

---

### Task 1: Bord, stukken en stelling (FEN in en uit)

**Files:**
- Create: `src/chess/constants.js`
- Create: `src/chess/zobrist.js`
- Create: `src/chess/position.js`
- Test: `tests/chess/position.test.js`

**Interfaces:**
- Consumes: `boardFromFen(fen)` en `START_FEN` uit `src/fen.js` (stap 1). `fromFen` gebruikt `boardFromFen` voor het stellingdeel, zodat dat parsen niet dubbel bestaat.
- Produces in `src/chess/constants.js`:
  - `WHITE = 0`, `BLACK = 8`; `EMPTY = 0`, `PAWN = 1`, `KNIGHT = 2`, `BISHOP = 3`, `ROOK = 4`, `QUEEN = 5`, `KING = 6`. Een stuk is `kleur | type` (bijv. zwarte dame = `13`).
  - `pieceColor(p) = p & 8`, `pieceType(p) = p & 7`.
  - `squareFromName(name: string): number`: 0x88-index (`rij * 16 + lijn`, a1 = 0, h1 = 7, e4 = 52, a8 = 112, h8 = 119); `squareName(sq: number): string`.
  - `pieceFromLetter(letter: string): number`, `letterFromPiece(piece: number): string` (FEN-letters).
  - `CASTLE_WK = 1`, `CASTLE_WQ = 2`, `CASTLE_BK = 4`, `CASTLE_BQ = 8`.
  - Zetten: `FLAG_CAPTURE = 1`, `FLAG_DOUBLE_PUSH = 2`, `FLAG_EN_PASSANT = 4`, `FLAG_CASTLE = 8`; `encodeMove(from, to, flags = 0, promotion = 0): number` = `from | to << 7 | promotion << 14 | flags << 17`; `moveFrom(m)`, `moveTo(m)`, `movePromotion(m)` (stuktype zonder kleur, 0 = geen), `moveFlags(m)`.
- Produces in `src/chess/zobrist.js`: `computeHash(pos: Position): [lo: number, hi: number]`, die de hash volledig opnieuw uitrekent, plus de sleuteltabellen die Task 2 voor het bijwerken gebruikt. De sleutels komen uit een vaste-seed PRNG (bijv. xorshift32), zodat ze bij elke start gelijk zijn. In de hash zitten: elk stuk per veld, de speler aan zet, de rokaderechten (4 bits), en het en-passantveld **alleen als een pion van de speler aan zet ernaast staat** (dus slaan pseudo-mogelijk is).
- Produces in `src/chess/position.js`:
  - `class Position` met de velden `board: Int8Array(128)`, `turn: WHITE|BLACK`, `castling: number`, `epSquare: number` (`-1` = geen), `halfmoveClock: number`, `fullmoveNumber: number`, `kings: Int16Array(2)` (index `kleur >> 3`), `hashLo: number`, `hashHi: number` en `history: Array` (voor `unmakeMove` en herhaling; de vorm is aan de bouwer).
  - `fromFen(fen: string): Position`; het vijfde en zesde veld zijn optioneel (standaard `0` en `1`).
  - `toFen(pos: Position): string`; het en-passantveld wordt altijd geschreven na een dubbele pionzet (standaard-FEN), ook als niemand kan slaan.
  - `boardFromPosition(pos: Position): Record<string, string>`: zelfde vorm als `boardFromFen`.

- [ ] **Stap 1: Schrijf de falende tests in `tests/chess/position.test.js`**

- `squareFromName('a1') === 0`, `('h1') === 7`, `('e4') === 52`, `('a8') === 112`, `('h8') === 119`; voor alle 64 velden geldt `squareName(squareFromName(n)) === n`.
- `encodeMove` → `moveFrom`, `moveTo`, `moveFlags` en `movePromotion` geven de ingevoerde waarden terug (bijv. `encodeMove(100, 116, FLAG_CAPTURE, QUEEN)`).
- `toFen(fromFen(f)) === f` voor deze zes FEN's (de vaste perft-stellingen, die ook in Task 3 gebruikt worden):
  - `START_FEN`
  - Kiwipete: `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1`
  - Pos3: `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1`
  - Pos4: `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1`
  - Pos5: `rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8`
  - Pos6: `r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P3/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10`
- `toFen(fromFen('8/8/8/8/4K3/8/8/k7 w - -')) === '8/8/8/8/4K3/8/8/k7 w - - 0 1'`.
- `boardFromPosition(fromFen(START_FEN))` is deep-equal aan `boardFromFen(START_FEN)`.
- `fromFen(START_FEN).kings` geeft `[squareFromName('e1'), squareFromName('e8')]`.
- Deze geven elk een fout met `/^Ongeldige FEN/`: geen witte koning (`'8/8/8/8/8/8/8/k7 w - - 0 1'`), twee witte koningen (`'K7/8/8/8/8/8/8/k6K w - - 0 1'`), onbekende speler (`'k7/8/8/8/8/8/8/K7 x - - 0 1'`), onbekende rokade (`'k7/8/8/8/8/8/8/K7 w X - 0 1'`), een ep-veld op een verkeerde rij (`'k7/8/8/8/8/8/8/K7 w - e4 0 1'`), een negatieve klok (`'k7/8/8/8/8/8/8/K7 w - - -1 1'`).
- Hash: twee keer `fromFen` van dezelfde FEN geeft dezelfde `hashLo`/`hashHi`; `START_FEN` met `w` en met `b` geven verschillende hashes; de START_FEN zonder rokaderechten (`- -`) geeft een andere hash dan met `KQkq`.
- Hash met ep (Review Focus 5): `'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'` heeft **dezelfde** hash als dezelfde FEN met `-`; en `'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'` (zwarte pion op d4 kan slaan) heeft een **andere** hash dan met `-`.
- Voor elke FEN hierboven geldt `[pos.hashLo, pos.hashHi]` deep-equal aan `computeHash(pos)`.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/chess/position.js` bestaat nog niet.

- [ ] **Stap 3: Bouw `constants.js`, `zobrist.js` en `position.js`**

`fromFen` controleert: precies één koning per kleur, `w`/`b`, rokade `-` of een combinatie van `KQkq`, ep `-` of een veld op rij 3 (als zwart aan zet is) of rij 6 (als wit aan zet is), klokken als gehele getallen ≥ 0 (zet-nummer ≥ 1).

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/chess/constants.js src/chess/zobrist.js src/chess/position.js tests/chess/position.test.js
git commit -m "Schaakstelling: bord, FEN en hash"
```

---

### Task 2: Zetten doen en terugdraaien

**Files:**
- Modify: `src/chess/position.js`
- Test: `tests/chess/make-move.test.js`

**Interfaces:**
- Consumes: alles uit Task 1.
- Produces in `src/chess/position.js`:
  - `makeMove(pos: Position, move: number): void`: voert de zet uit zonder legaliteitscontrole. Werkt bij: bord, koningsvelden, beurt, rokaderechten (kwijt als koning of toren van het beginveld gaat, **of als er op een torenbeginveld geslagen wordt**), ep-veld (alleen na een dubbele pionzet), `halfmoveClock` (0 na een pionzet of slag, anders +1), `fullmoveNumber` (+1 na een zet van zwart), en `hashLo`/`hashHi` **stapsgewijs** (niet opnieuw uitrekenen). Bij rokade verplaatst hij ook de toren; bij en passant verdwijnt de geslagen pion; bij promotie komt het gekozen stuk op het doelveld.
  - `unmakeMove(pos: Position): void`: draait de laatste `makeMove` exact terug, inclusief de hash.

- [ ] **Stap 1: Schrijf de falende tests in `tests/chess/make-move.test.js`**

Elke test: `fromFen(voor)`, `makeMove` met een zet uit `encodeMove`, en daarna `toFen` vergelijken met de verwachte FEN, `[hashLo, hashHi]` deep-equal aan `computeHash(pos)`, en na `unmakeMove` geeft `toFen` weer `voor` en is de hash gelijk aan die van het begin.
- Dubbele pionzet e2e4 vanuit `START_FEN` → `'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'`.
- Paardzet g1f3 vanuit `START_FEN` → `'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1'`.
- Korte rokade e1g1 (`FLAG_CASTLE`) vanuit `'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'` → `'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1'`.
- Lange rokade e8c8 (`FLAG_CASTLE`) vanuit `'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'` → `'2kr3r/8/8/8/8/8/8/R3K2R w KQ - 1 2'`.
- En passant e5d6 (`FLAG_EN_PASSANT | FLAG_CAPTURE`) vanuit `'k7/8/8/3pP3/8/8/8/K7 w - d6 0 1'` → `'k7/8/3P4/8/8/8/8/K7 b - - 0 1'` (de witte pion staat op d6, de zwarte pion op d5 is weg).
- Promotie met slag b7a8=paard (`FLAG_CAPTURE`, promotie `KNIGHT`) vanuit `'r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1'` → `'N3k3/8/8/8/8/8/8/4K3 b - - 0 1'` (zwart verliest ook het recht op de lange rokade, want de toren op a8 is geslagen).
- Toren h1 slaat toren h8 (`FLAG_CAPTURE`) vanuit `'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'` → `'r3k2R/8/8/8/8/8/8/R3K3 b Qq - 0 1'`.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `makeMove` bestaat nog niet.

- [ ] **Stap 3: Bouw `makeMove` en `unmakeMove`**

Rokaderechten bijwerken kan met een tabel per veld (een masker dat rechten wegneemt als `from` of `to` dat veld is: e1, a1, h1, e8, a8, h8).

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/chess/position.js tests/chess/make-move.test.js
git commit -m "Zetten doen en terugdraaien"
```

---

### Task 3: Alle legale zetten (zetgenerator) en perft

**Files:**
- Create: `src/chess/movegen.js`
- Create: `src/chess/perft.js`
- Create: `scripts/perft.mjs`
- Modify: `package.json` (script `"perft": "node scripts/perft.mjs"`, en `"test"` wordt `node --test "tests/**/*.test.js"`, zodat een hulpbestand met "test" in de naam nooit per ongeluk als test draait)
- Test: `tests/chess/movegen.test.js`

**Interfaces:**
- Consumes: Task 1 en 2.
- Produces in `src/chess/movegen.js`:
  - `isSquareAttacked(pos: Position, sq: number, byColor: number): boolean`
  - `isInCheck(pos: Position, color = pos.turn): boolean`
  - `generateMoves(pos: Position): number[]`: pseudo-legaal, met de juiste flags. Een promotie geeft vier zetten (dame, toren, loper, paard). Rokade alleen als het recht er is, de velden ertussen leeg zijn, de koning niet schaak staat en niet over of op een aangevallen veld komt.
  - `generateLegalMoves(pos: Position): number[]`: `generateMoves` gefilterd met make, controle van de eigen koning, en unmake.
- Produces in `src/chess/perft.js`: `perft(pos: Position, depth: number): number`.
- Produces: `npm run perft`, die de diepe perft-tabel draait en per stelling het aantal, de tijd en het aantal knopen per seconde toont.

- [ ] **Stap 1: Schrijf de falende tests in `tests/chess/movegen.test.js`**

- `generateLegalMoves(fromFen(START_FEN)).length === 20`.
- Perft (snelle dieptes, in `npm test`):
  - start: d1 = 20, d2 = 400, d3 = 8902, d4 = 197281
  - Kiwipete: d1 = 48, d2 = 2039, d3 = 97862
  - Pos3: d1 = 14, d2 = 191, d3 = 2812, d4 = 43238
  - Pos4: d1 = 6, d2 = 264, d3 = 9467
  - Pos5: d1 = 44, d2 = 1486, d3 = 62379
  - Pos6: d1 = 46, d2 = 2079, d3 = 89890
- `isInCheck` is `true` voor `'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'` en `false` voor `START_FEN`.
- Rokeren door schaak kan niet: in `'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'` met een zwarte loper op b4 (`'r3k2r/8/8/8/1b6/8/8/R3K2R w KQkq - 0 1'`) zit `e1g1` niet in de legale zetten (de koning staat schaak).
- Rokeren over een aangevallen veld kan niet: `'r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1'` → er is geen `e1g1` (f1 wordt aangevallen), maar `e1c1` wel.
- Lange afspeelreeks (Review Focus 1): vanuit Kiwipete 300 keer de zet `legal[(i * 7 + 3) % legal.length]` doen (stop eerder als er geen legale zetten zijn). Na elke zet geldt `[hashLo, hashHi]` deep-equal aan `computeHash(pos)`. Daarna alles terugdraaien met `unmakeMove`, waarna `toFen` weer de Kiwipete-FEN is.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/chess/movegen.js` bestaat nog niet.

- [ ] **Stap 3: Bouw `movegen.js` en `perft.js`**

Gebruik richtingstabellen voor 0x88 (paard: ±14, ±18, ±31, ±33; loper: ±15, ±17; toren: ±1, ±16; koning: alle acht). `sq & 0x88` betekent buiten het bord. `isSquareAttacked` kijkt vanuit het veld naar buiten (pionnen, paarden, glijdende stukken, koning), zodat er geen zetlijsten nodig zijn.

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS, en `npm test` duurt in totaal minder dan ongeveer 15 seconden.

- [ ] **Stap 5: Diepe perft en snelheid**

`scripts/perft.mjs` draait: start d5 = 4865609, Kiwipete d4 = 4085603, Pos3 d5 = 674624, Pos4 d4 = 422333, Pos5 d4 = 2103487, Pos6 d4 = 3894594. Het toont per regel `OK`/`FOUT`, het aantal, de tijd en de knopen per seconde, en stopt met exit-code 1 bij een fout.
Run: `npm run perft`
Expected: alle regels `OK`. Noteer de knopen per seconde in het ledger (dat is de nulmeting voor de engine).

- [ ] **Stap 6: Commit**

```bash
git add src/chess/movegen.js src/chess/perft.js scripts/perft.mjs package.json tests/chess/movegen.test.js
git commit -m "Zetgenerator met perft-tests"
```

---

### Task 4: Einde van de partij en zet-notatie

**Files:**
- Create: `src/chess/status.js`
- Create: `src/chess/notation.js`
- Test: `tests/chess/status.test.js`
- Test: `tests/chess/notation.test.js`

**Interfaces:**
- Consumes: Task 1 t/m 3.
- Produces in `src/chess/status.js`:
  - `gameStatus(pos: Position): { result: 'ongoing' | 'checkmate' | 'stalemate' | 'draw-fifty' | 'draw-repetition' | 'draw-material', winner: 'white' | 'black' | null }`, gecontroleerd in deze volgorde: mat, pat, onvoldoende materiaal, 50-zettenregel, herhaling. `winner` is alleen gevuld bij mat.
  - `isInsufficientMaterial(pos): boolean`: `true` bij K tegen K, K+L tegen K, K+P(aard) tegen K, en K+lopers tegen K+lopers als **alle** lopers op dezelfde kleur velden staan. Anders `false` (dus ook bij K+P+P tegen K en K+P tegen K+P).
  - `isThreefoldRepetition(pos): boolean`: dezelfde hash voor de 3e keer, alleen gezocht binnen de laatste `halfmoveClock` zetten en alleen in stellingen met dezelfde speler aan zet.
- Produces in `src/chess/notation.js`:
  - `moveToUci(move: number): string`, bijvoorbeeld `'e2e4'` of `'e7e8q'` (promotieletter klein: `q r b n`).
  - `moveFromUci(pos: Position, uci: string): number | null`: de bijbehorende **legale** zet, of `null`.

- [ ] **Stap 1: Schrijf de falende tests**

`tests/chess/status.test.js`:
- Gekkenmat (1.f3 e5 2.g4 Dh4#) `'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'` → `{ result: 'checkmate', winner: 'black' }`.
- Pat `'7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'` → `{ result: 'stalemate', winner: null }`.
- `START_FEN` → `{ result: 'ongoing', winner: null }`.
- 50-zettenregel: `'k7/8/8/8/8/8/8/K6R w - - 100 80'` → `'draw-fifty'`; met klok `99` → `'ongoing'`.
- Mat gaat voor (Review Focus 3): `'k7/1Q6/1K6/8/8/8/8/8 b - - 100 80'` (zwart staat mat, de klok staat op 100) → `{ result: 'checkmate', winner: 'white' }`.
- Onvoldoende materiaal → `'draw-material'`: `'k7/8/8/8/8/8/8/K7 w - - 0 1'`, `'k7/8/8/8/8/8/8/KB6 w - - 0 1'`, `'k7/8/8/8/8/8/8/KN6 w - - 0 1'`, lopers op dezelfde kleur `'k4b2/8/8/8/8/8/8/K1B5 w - - 0 1'` (c1 en f8 zijn beide donker).
- Wel genoeg materiaal → `'ongoing'`: lopers op een andere kleur `'k3b3/8/8/8/8/8/8/K1B5 w - - 0 1'`, twee paarden `'k7/8/8/8/8/8/8/KNN5 w - - 0 1'`, een pion `'k7/8/8/8/8/8/P7/K7 w - - 0 1'`.
- Herhaling: vanuit `START_FEN` de zetten `g1f3 g8f6 f3g1 f6g8` (2e keer de beginstelling) → `'ongoing'`, en daarna nog eens `g1f3 g8f6 f3g1 f6g8` (3e keer) → `'draw-repetition'`.
- Geen herhaling bij andere rokaderechten (Review Focus 2): vanuit `'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'` drie rondes `e1e2 e8e7 e2e1 e7e8`. Na ronde 1 en na ronde 2 → `'ongoing'`; na ronde 3 → `'draw-repetition'`. (Wie de rokaderechten in de hash vergeet, ziet de beginstelling na ronde 2 al voor de 3e keer en faalt op die tweede controle.)

`tests/chess/notation.test.js`:
- `moveToUci(moveFromUci(fromFen(START_FEN), 'e2e4')) === 'e2e4'`.
- `moveFromUci` vindt de rokade `'e1g1'` in `'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'` (met `FLAG_CASTLE`), en de promotie `'b7a8n'` in `'r3k3/1P6/8/8/8/8/8/4K3 w q - 0 1'` (met promotie `KNIGHT`).
- `moveFromUci(fromFen(START_FEN), x)` is `null` voor `'e2e5'` (illegaal), `''`, `'zz'`, `'e2e9'` en `'e2e4x'` (Review Focus 4), en voor `'b7a8'` zonder promotieletter in de promotiestelling.

- [ ] **Stap 2: Draai de tests en zie ze falen**

Run: `npm test`
Expected: FAIL, want `src/chess/status.js` en `src/chess/notation.js` bestaan nog niet.

- [ ] **Stap 3: Bouw `status.js` en `notation.js`**

- [ ] **Stap 4: Draai de tests en zie ze slagen**

Run: `npm test`
Expected: PASS.

- [ ] **Stap 5: Commit**

```bash
git add src/chess/status.js src/chess/notation.js tests/chess/status.test.js tests/chess/notation.test.js
git commit -m "Einde van de partij en zet-notatie"
```
