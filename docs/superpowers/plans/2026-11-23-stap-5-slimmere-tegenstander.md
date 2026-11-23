# Stap 5: Slimmere tegenstander en niveaus (implementatieplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een veel sterkere engine (positietabellen, zetordening, quiescence, iteratieve verdieping met tijdslimiet, transpositietabel, killer- en history-zetten) met vijf niveaus. Niveau 1 is afgestemd op een beginner van ongeveer 700 Elo.

**Architecture:** De zoekfunctie van stap 4 blijft bestaan als `search-v1.js`, zodat de nieuwe engine er wedstrijden tegen kan spelen. De nieuwe `search.js` (v2) zoekt met iteratieve verdieping binnen een tijdslimiet. Daarnaast heeft hij een functie die elke zet in de wortel exact scoort; de lage niveaus kiezen daaruit met ruis. `levels.js` vertaalt een niveau naar zoekinstellingen. De worker krijgt een niveau in plaats van een diepte.

**Tech Stack:** JavaScript (ES-modules), Web Worker, `node --test`; de regels uit `src/chess/`.

**Spec:** `docs/superpowers/specs/2026-11-23-schaak-app-design.md`

## Global Constraints

- Geen afhankelijkheden, geen bestaande schaakbibliotheek of -tabellen van anderen; alle tekst in de app is Nederlands.
- Stap 5 volgens de spec: "positietabellen, zetordening, quiescence en iteratieve verdieping met een tijdslimiet, plus de niveaus", en uit de keuzes van de bouwer: "een transpositietabel (Zobrist-hashing) en killer- en history-zetten".
- Niveaus: ongeveer vijf. "Niveau 1 is op die sterkte [iets boven de 700] afgestemd: het maakt bewust geregeld fouten en laat soms stukken hangen, zodat de gebruiker kan winnen maar er wel moeite voor moet doen. Niveau 2 ligt net boven de gebruiker [...]. De hogere niveaus lopen op tot de volle sterkte van de engine."
- Controle: "De nieuwe versie van de engine speelt een reeks partijen tegen de vorige versie en moet duidelijk winnen. Daarnaast moet hij tactische testposities oplossen."
- Anti-doelen: het scherm bevriest niet (worker, tijdslimiet), en de computer doet nooit een illegale zet.
- Niveaukeuze in de app komt in stap 6. In deze stap speelt de app op niveau 1.

## Review Focus

1. **Een zoekopdracht die door de tijdslimiet wordt afgebroken**, moet de stelling precies zo achterlaten als ervoor, en toch een legale zet teruggeven (die van de laatste volledige diepte). → test in Task 2.
2. **Mat-scores in de transpositietabel**: een mat die via de tabel binnenkomt, moet de juiste afstand houden. Anders kiest de engine een langzamere mat of loopt hij in een rondje. → test in Task 2 (mat in 2 met tabel, en een gewonnen eindspel dat in een redelijk aantal zetten mat wordt).
3. **Schaak aan de rand van de zoekboom**: een mat in 1 van de tegenstander na de eigen zet wordt gezien, ook op lage diepte (schaakverlenging). → test in Task 2 (matdreiging achter de onderste rij).
4. **Niveau 1 is te winnen maar niet dom**: het mag stukken laten hangen, maar slaat wel een hangende dame en zet mat in 1 als dat kan. → tests in Task 3.
5. **Denktijd per niveau op een telefoon**: niveau 5 mag niet langer denken dan zijn limiet plus een kleine marge. Een telefoon is 3 tot 5 keer trager, maar de tijdslimiet geldt in echte tijd. → test in Task 2 (de tijdslimiet wordt gehaald) en meting in Task 4.

---

### Task 1: Positietabellen

**Files:**
- Modify: `src/engine/evaluate.js`
- Rename: `src/engine/search.js` → `src/engine/search-v1.js`, `tests/engine/search.test.js` → `tests/engine/search-v1.test.js`
- Create: `src/engine/common.js`
- Test: `tests/engine/evaluate.test.js`

**Interfaces:**
- Produces:
  - `src/engine/common.js`: `MATE = 100000`, `isDraw(pos)` en `shuffle(list, random)`, verhuisd uit de search van stap 4. Eén reparatie uit de review van stap 4: de 50-zettenregel telt alleen als het geen mat is (`gameStatus` zet mat ook voorop). Is `halfmoveClock >= 100`, dan is het remise behalve als de speler aan zet schaak staat en geen legale zetten heeft.
  - `src/engine/search-v1.js`: de zoekfunctie van stap 4. Ongewijzigd, behalve dat hij `evaluateMaterial` gebruikt en `MATE`, `isDraw` en `shuffle` uit `common.js` haalt. Zijn tests blijven ongewijzigd slagen.
  - `src/engine/evaluate.js`:
    - `PIECE_VALUES` (ongewijzigd)
    - `evaluateMaterial(pos)` (de oude `evaluate`)
    - `evaluate(pos)`: materiaal plus positietabellen, vanuit de speler aan zet

**De tabellen** (eigen formules; `f` = lijn 0–7, `r` = rij 0–7 gezien vanaf de eigen kant, dus voor zwart gespiegeld; `cd = max(|f − 3,5|, |r − 3,5|) − 0,5`, de afstand tot het centrum, 0–3):

| stuk | middenspel (mg) | eindspel (eg) |
|---|---|---|
| pion | `[0, 0, 5, 10, 20, 35, 60, 0][r]`, plus 10 voor lijn d/e op rij 3–4 | `[0, 0, 10, 20, 35, 60, 100, 0][r]` |
| paard | `(2 − cd) × 12` | gelijk aan mg |
| loper | `(2 − cd) × 6` | gelijk aan mg |
| toren | 20 op rij 6 (de 7e rij), anders 0; plus 5 op lijn d/e | 20 op rij 6, anders 0 |
| dame | `(2 − cd) × 4` | gelijk aan mg |
| koning | rij 0: 20 op lijn a, b, c, g, h, anders 0; rij > 0: `−20 × r` | `(2 − cd) × 15` |

- Fase: paard en loper tellen 1, toren 2, dame 4, met een maximum van 24.
- `evaluate = materiaal + (mg × fase + eg × (24 − fase)) / 24`, afgerond naar een geheel getal.

- [ ] **Stap 1: Schrijf de falende tests in `tests/engine/evaluate.test.js`**

Hulpfunctie in de test: `mirrorFen(fen)` keert de rijen om, wisselt hoofdletters en kleine letters, en wisselt de speler aan zet. Rokade en en passant worden `-`.
- `evaluateMaterial` geeft de waarden van de tests van stap 4 (die tests verhuizen naar `evaluateMaterial`).
- In `tests/engine/search-v1.test.js` komt er één test bij: mat op halve zet 100: `'6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80'`, diepte 3 → `'a1a8'` met `score === MATE − 1` (nu speelt v1 hier een andere zet met score 0).
- `evaluate(beginstelling) === 0`.
- Symmetrie: voor de vijf `PERFT_FENS` (zonder rokade/ep): `evaluate(fromFen(fen)) === evaluate(fromFen(mirrorFen(fen)))`.
- Paard op e4 is beter dan paard op a1: `'4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'` > `'4k3/8/8/8/8/8/8/N3K3 w - - 0 1'`.
- Pion op de 6e rij is beter dan op de 2e: `'4k3/8/P7/8/8/8/8/4K3 w - - 0 1'` > `'4k3/8/8/8/8/8/P7/4K3 w - - 0 1'`.
- Koning in het eindspel: in het centrum beter dan in de hoek: `'7k/8/8/8/3K4/8/8/8 w - - 0 1'` > `'7k/8/8/8/8/8/8/K7 w - - 0 1'`.
- Koning in het middenspel (alle stukken nog op het bord): gerokeerd is beter dan naar voren gelopen: `'rnbqkbnr/pppppppp/8/8/4P3/4BN2/PPPP1PPP/RNBQ1RK1 w kq - 0 1'` (koning g1) > `'rnbqkbnr/pppppppp/8/8/4P3/4BN2/PPPPKPPP/RNBQ3R w kq - 0 1'` (koning e2).

- [ ] **Stap 2: Draai de tests en zie ze falen** — Run: `npm test`. Expected: FAIL (`evaluateMaterial` en `common.js` bestaan nog niet).
- [ ] **Stap 3: Verhuis en bouw** (`git mv` voor de hernoemingen, zodat de geschiedenis blijft).
- [ ] **Stap 4: Draai de tests en zie ze slagen** — Run: `npm test`. Expected: PASS.
- [ ] **Stap 5: Commit** — `git commit -m "Positietabellen; engine v1 bewaard als search-v1"`

---

### Task 2: Zoeken v2

**Files:**
- Create: `src/engine/search.js` (nieuw)
- Test: `tests/engine/search.test.js` (nieuw)

**Interfaces:**
- Consumes: `evaluate` (Task 1); `MATE`, `isDraw`, `shuffle` (`common.js`); `generateMoves`, `isInCheck` (`src/chess/movegen.js`); `makeMove`, `unmakeMove` (`src/chess/position.js`); `PIECE_VALUES`.
- Produces in `src/engine/search.js`:
  - `search(pos, { maxDepth = 64, timeMs = Infinity, random = Math.random, now = () => performance.now() }): { move: number | null, score: number, depth: number, nodes: number }`.
    - Iteratieve verdieping. Diepte 1 wordt altijd afgemaakt; daarna stopt het zoeken zodra `timeMs` voorbij is.
    - Het antwoord komt van de laatste volledig afgemaakte diepte.
    - `depth` is die diepte.
  - `scoreMoves(pos, depth: number, { quiescence = true } = {}): Array<{ move: number, score: number }>`. Elke legale zet krijgt een exacte score: zoeken op `depth − 1` met een vol venster, plus quiescence. Met `quiescence: false` is diepte 0 gewoon `evaluate`. Dan ziet de zoekfunctie een terugslag na de horizon niet: dat is de "slordige" blik van de lage niveaus.
  - `MATE` wordt opnieuw geëxporteerd vanuit `common.js`.

**Het algoritme** (de tests leggen het niet helemaal vast):
- Negamax met alfa-bèta (fail-hard). Zetten zijn pseudo-legaal uit `generateMoves`; na `makeMove` valt een zet af als de eigen koning schaak staat (zoals `perft`). Geen legale zetten: schaak → `-(MATE − ply)`, anders `0`.
- **Schaakverlenging:** staat de speler aan zet schaak, dan wordt `depth` met 1 verhoogd. `ply` heeft een maximum van 64: daar geeft de zoekfunctie `evaluate` terug.
- **Quiescence** op diepte ≤ 0 (niet schaak):
  - Begin met stand pat = `evaluate`. Is dat ≥ beta, dan is het resultaat beta.
  - Daarna alleen slagzetten en promoties, geordend met MVV-LVA.
  - Staat de speler in de quiescence schaak, dan geen stand pat: alle zetten tellen, en mat wordt herkend.
- **Remise:** op `ply > 0` geeft `isDraw(pos)` 0, zoals in v1.
- **Transpositietabel:**
  - `2^18` plaatsen in getypte arrays (sleutel lo/hi, zet, score, diepte, vlag exact/onder/boven), per `search`-aanroep nieuw.
  - Index: `hashLo & (size − 1)`. Een nieuwe meting vervangt altijd de oude.
  - Mat-scores worden opgeslagen als afstand vanaf de knoop (`score ± ply`) en bij het lezen teruggerekend.
  - In de wortel wordt geen afkapping uit de tabel gebruikt, alleen de zet.
- **Zetordening:**
  1. de tabelzet
  2. slagzetten (MVV-LVA: `waarde slachtoffer × 10 − waarde aanvaller / 100`) en promotie tot dame
  3. twee killer-zetten per `ply`
  4. history-score (`depth²` opgeteld bij een afkapping door een stille zet)
- **Wortel:** de zetten worden eerst geschud met `random`, zodat gelijke zetten willekeurig vallen. Daarna komen de beste zet van de vorige diepte en de tabelzet vooraan.
- **Tijd:**
  - Om de 1024 knopen wordt `now()` gecontroleerd. Is de tijd op, dan zet de zoekfunctie een stopvlag. Elke knoop draait zijn zetten nog terug en geeft 0.
  - Een diepte met de stopvlag telt niet.
  - Vanaf diepte 2 stopt hij ook vóór een nieuwe diepte als de helft van de tijd al op is.
- `scoreMoves` gebruikt dezelfde knoopfunctie, met een eigen tabel en zonder tijdslimiet.

- [ ] **Stap 1: Schrijf de falende tests in `tests/engine/search.test.js`**

(`random: createRandom(1)` waar nodig.)
- **Mat in 1**: `'6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'`, `maxDepth: 2` → `'a1a8'`, `score === MATE − 1`.
- **Mat in 2**, ook via de tabel: `'r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 0 1'`, `maxDepth: 5` → `'d5d8'` en `score === MATE − 3` (Review Focus 2).
- **Matdreiging achter de onderste rij** (Review Focus 3): `'4r1k1/5ppp/8/8/8/R7/5PPP/6K1 w - - 0 1'`, `maxDepth: 2`. Na de gekozen zet heeft zwart geen mat in 1. Dat geldt voor 10 seeds; 12 van de 22 zetten zijn hier fout. De engine van stap 4 op diepte 2 ziet dit niet.
- **Quiescence**: `'4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1'`, `maxDepth: 1` → niet `'d1d5'` (v1 slaat hier op diepte 1 wel), en de score ligt binnen 100 van `+700` (dame tegen twee pionnen).
- **Paardvork**: `'q3k3/8/8/1N6/8/8/7P/4K3 w - - 0 1'` (met een witte pion op h2, zodat het een echte materiaalwinst is en geen remise door te weinig materiaal), `maxDepth: 4` → `'b5c7'` en `score > 300`.
- **Promotie**: `'4k3/8/8/8/8/8/p7/4K3 b - - 0 1'`, `maxDepth: 3` → `'a2a1q'`.
- **Pat vermijden** en **herhaling ontwijken**: dezelfde stellingen en controles als bij v1, met `maxDepth: 3`.
- **Gewonnen eindspel wordt mat** (Review Focus 2): `'8/8/8/4k3/8/8/8/3QK3 w - - 0 1'` (dame tegen koning). Speel de engine (`timeMs: 100`) tegen zwart, waarbij zwart de zet kiest uit `search` met `maxDepth: 2`. Na hooguit 60 halve zetten is het mat.
- **Tijdslimiet** (Review Focus 1 en 5): Kiwipete met `timeMs: 200`.
  - Het zoeken duurt minder dan 200 + 100 ms (gemeten met `performance.now()`).
  - `depth ≥ 2`, en `move` zit in `generateLegalMoves`.
  - Daarna zijn `toFen`, de hash en `history.length` gelijk aan ervoor.
- **Nep-klok**: met `now` dat bij elke aanroep 1000 ms vooruitgaat en `timeMs: 1`: het resultaat heeft `depth === 1`, een legale zet, en de stelling is onveranderd.
- **`scoreMoves`**: in de mat-in-1-stelling op diepte 2 heeft `'a1a8'` score `MATE − 1`, en evenveel items als er legale zetten zijn. In de stelling met de gedekte pion op diepte 1 is de score van `'d1d5'` lager dan die van de beste andere zet. Met `quiescence: false` is `'d1d5'` daar juist de hoogste.
- **Altijd legaal**: 30 zetten zelf spelen vanuit de beginstelling (`timeMs: 30`, seed 7). Elke zet zit in `generateLegalMoves`.

- [ ] **Stap 2: Draai de tests en zie ze falen** — Run: `npm test`. Expected: FAIL (`src/engine/search.js` bestaat niet).
- [ ] **Stap 3: Bouw `src/engine/search.js`**
- [ ] **Stap 4: Draai de tests en zie ze slagen** — Run: `npm test`. Expected: PASS. Draai ook `npm run perft` (Expected: alle OK; de regels zijn niet veranderd).
- [ ] **Stap 5: Commit** — `git commit -m "Engine v2: iteratieve verdieping, quiescence, tabel en zetordening"`

---

### Task 3: Niveaus

**Files:**
- Create: `src/engine/levels.js`
- Modify: `src/engine/engine.js`, `tests/engine/engine.test.js`
- Test: `tests/engine/levels.test.js`

**Interfaces:**
- Consumes: `search`, `scoreMoves` (Task 2); `createRandom`.
- Produces:
  - `src/engine/levels.js`:
    - `LEVELS`: een array van vijf `{ level, name, depth?, noise?, careless?, timeMs? }`:
      1. `{ level: 1, name: 'Beginner', depth: 1, noise: 150, careless: 0.25 }`
      2. `{ level: 2, name: 'Leerling', depth: 2, noise: 60, careless: 0.08 }`
      3. `{ level: 3, name: 'Clubspeler', depth: 3, noise: 20 }`
      4. `{ level: 4, name: 'Sterk', timeMs: 700 }`
      5. `{ level: 5, name: 'Maximaal', timeMs: 2000 }`
    - `chooseMove(pos, level: number, { random = Math.random, timeScale = 1 } = {}): { move: number | null, score: number }`.
      - Met `noise`: bij kans `careless` (getrokken met `random`) een slordige zet, anders een gewone. Gewoon: `scoreMoves(pos, depth)`. Slordig: `scoreMoves(pos, 1, { quiescence: false })`; dan ziet het niveau alleen de stelling direct na zijn eigen zet, slaat het gretig gedekte stukken, en zet het stukken neer waar ze geslagen kunnen worden. Bij elke score komt `noise × N(0, 1)` (Box-Muller met `random`), en de hoogste wint. Zo maakt niveau 1 "bewust geregeld fouten en laat soms stukken hangen", maar slaat het wel een hangende dame en zet het mat in 1.
      - Zonder `noise`: `search(pos, { timeMs: timeMs × timeScale, random })`.
      - Een onbekend niveau → `Error('Onbekend niveau: <n>')`.
  - `src/engine/engine.js`:
    - `handleRequest({ id, startFen, moves, level, seed?, timeScale? })` gebruikt `chooseMove`. Uit de review van stap 4: het uitpakken van het verzoek gebeurt binnen de `try`, zodat `handleRequest(undefined)` een `{ id: undefined, error }` geeft en niet gooit
    - het antwoord: `{ id, move, score }`, of `{ id, error }`
    - `positionFromMoves` blijft ongewijzigd

- [ ] **Stap 1: Schrijf de falende tests**

`tests/engine/levels.test.js`:
- `LEVELS.length === 5`, met niveaus 1–5 op volgorde, en elk niveau heeft een `name`.
- Niveau 1 slaat een hangende dame (Review Focus 4): `'4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1'`. Over 20 seeds kiest niveau 1 minstens 18 keer `'d2d5'`.
- Niveau 1 zet mat in 1: de mat-in-1-stelling, 20 seeds → altijd `'a1a8'`.
- Niveau 1 maakt fouten (Review Focus 4): in de beginstelling, over 50 seeds, kiest niveau 1 minstens 8 verschillende zetten. In `'4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1'` slaat niveau 1 over 100 seeds minstens 3 keer de gedekte pion (`'d1d5'`), en niveau 3 nooit.
- Niveau 4 met `timeScale: 0.1` geeft een legale zet. Niveau 6 en niveau 0 geven de fout `'Onbekend niveau: 6'` en `'Onbekend niveau: 0'`.

`tests/engine/engine.test.js`: de verzoeken gebruiken `level` in plaats van `depth`. Mat in 1 via een verzoek op niveau 5 met `timeScale: 0.05`. Een onbekend niveau geeft `{ id, error: 'Onbekend niveau: 9' }`. Een verzoek zonder `level` geeft een fout, en `handleRequest(undefined)` gooit niet maar geeft een `error`.

- [ ] **Stap 2: Draai de tests en zie ze falen** — Run: `npm test`. Expected: FAIL.
- [ ] **Stap 3: Bouw `levels.js` en pas `engine.js` aan**
- [ ] **Stap 4: Draai de tests en zie ze slagen** — Run: `npm test`. Expected: PASS.
- [ ] **Stap 5: Commit** — `git commit -m "Vijf niveaus"`

---

### Task 4: Wedstrijden en koppelen

**Files:**
- Modify: `scripts/match.mjs`, `src/main.js`

**Interfaces:**
- Consumes: `chooseMove`, `LEVELS` (Task 3); `search` uit `search-v1.js` (Task 1).

- [ ] **Stap 1: Maak het wedstrijdscript algemeen**

- Aanroep: `npm run match -- <speler A> <speler B> [partijen = 20] [tijdschaal = 1]`. Spelers:
  - `random`
  - `v1` (search-v1, diepte 3)
  - `v2:<ms>` (search v2 met die tijd per zet)
  - `level:<n>` (`chooseMove` met de tijdschaal)
- Openingen: partij `2k` en `2k + 1` beginnen met dezelfde 4 willekeurige halve zetten (seed `500 + k`). Zo krijgt elke opening beide kleuren. De spelers krijgen elk een eigen seed per partij.
- Een partij eindigt bij mat, pat of remise, of na 300 halve zetten (dan telt hij als remise).
- Het script print het volgende:
  - per partij de uitslag
  - totaal winst, remise en verlies, en de score van speler A
  - per speler de gemiddelde en langste denktijd, en voor v2 de gemiddelde bereikte diepte
- Optie `--min <score>`: met exitcode 1 als de score van A daaronder blijft.

- [ ] **Stap 2: Draai de wedstrijden**

| Run | Expected |
|---|---|
| `npm run match -- v2:200 v1 20 1 --min 15` | v2 scoort ≥ 15/20 en verliest hooguit 2 partijen |
| `npm run match -- level:1 random 20 1 --min 15` | niveau 1 wint nog ruim van toeval, 0 verloren |
| `npm run match -- level:2 level:1 20 1 --min 14` | |
| `npm run match -- level:3 level:2 20 1 --min 14` | |
| `npm run match -- level:4 level:3 20 1 --min 13` | |
| `npm run match -- level:5 level:4 20 0.25 --min 10.5` | niet zwakker; met een kwart van de tijd blijft de verhouding gelijk en duurt het korter |

Noteer alle uitslagen en denktijden in de ledger.

Daarnaast een tijdmeting op drukke stellingen (uit de review van stap 4: de wedstrijd tegen toeval meet alleen rustige stellingen): `chooseMove` voor elk niveau op Kiwipete en pos6 (uit `tests/chess/fixtures.js`), 3 seeds. Expected: niveau 4 en 5 blijven onder hun `timeMs` plus 15%, niveau 1–3 onder 500 ms. Gebruik in het script `WHITE` uit `constants.js` in plaats van `0`.

- [ ] **Stap 3: Koppel in `src/main.js`**

`ENGINE_DEPTH` wordt `ENGINE_LEVEL = 1`, en het verzoek stuurt `level` in plaats van `depth`. Verder verandert er niets aan `main.js`.

- [ ] **Stap 4: Controleer het in de browser**

Run: `npm test` (PASS), en de browsercontrole van stap 4 via het DevTools-protocol: zet e2-e4, de computer antwoordt met een legale zet binnen een seconde, en 10 zetten lang geen fouten.

- [ ] **Stap 5: Commit** — `git commit -m "Wedstrijden tussen versies en niveaus; de app speelt op niveau 1"`

---

## Voor later

- Stap 6: niveau kiezen (`LEVELS` levert de namen), kleur kiezen (de computer kan dan ook wit zijn: `askComputer` aan het begin werkt al).
- Stap 7: de service worker moet `src/engine/*.js` in de cache zetten (ook `search-v1.js` hoeft niet, want de app gebruikt die niet).
