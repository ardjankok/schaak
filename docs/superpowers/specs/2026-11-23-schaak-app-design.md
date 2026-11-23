# Schaak-app (offline PWA voor Android): ontwerp

Datum: 2026-11-23

## Waarom

De gebruiker wil een app die als pictogram op de eigen Android-telefoon
staat en **volledig op de telefoon draait**: de laptop mag uit, er is geen
server, en het moet **gratis** zijn. Uit een lijst met ideeën is de
schaak-app gekozen, omdat de gebruiker **iets uitdagends** wil. De
computertegenstander moet **zelf gebouwd** worden (dus geen Stockfish), en
het werk gaat **stap voor stap**: één stap af en getest, dan pas de volgende.

## Doelen

- Op de Android-telefoon schaken tegen een zelfgebouwde computertegenstander,
  zonder internet.
- Alle officiële schaakregels kloppen: rokeren, en passant, promotie, schaak,
  mat, pat, 50-zettenregel, drievoudige herhaling en onvoldoende materiaal.
- Installeerbaar als PWA: een pictogram op het beginscherm en geen
  browserbalk (`display: standalone`).
- Meerdere niveaus, zodat een beginner kan winnen en een goede speler
  uitgedaagd wordt.

## Niet-doelen

- Online tegen anderen spelen, accounts of een server.
- Publicatie in de Play Store.
- Stockfish, chess.js of een andere bestaande schaakbibliotheek.
- Schaakklok of tijdcontrole, openingsboek, analyse, PGN importeren of
  exporteren (eventueel later).
- Aparte aandacht voor de iPhone. Het zal er waarschijnlijk werken, maar we
  testen het daar niet.

## Anti-doelen (dan is het mislukt, ook als het technisch werkt)

- Het kost geld (hosting, diensten, licenties).
- Het werkt niet zonder internet of alleen als de laptop aan staat.
- Het scherm bevriest terwijl de computer nadenkt.
- De computer doet een illegale zet, of de app mist een regel.
- De app is op een telefoon lastig te bedienen (te kleine velden, per
  ongeluk zetten doen).

## Beperkingen

- Doelplatform: Chrome op Android.
- De projectmap `c:\laravel_projecten\app` is leeg. Er is **geen Laravel of
  PHP nodig**, omdat er geen server is.
- Beschikbaar op de laptop: Node 26, npm 11 en git.
- Hosting moet gratis zijn en HTTPS bieden.

## Aanpakken

| | Aanpak | Wat het oplevert / kost |
|---|---|---|
| **A, gekozen** | Alles zelf in gewoon JavaScript: eigen spelregels, eigen zetgenerator en eigen engine, verpakt als PWA | Het meest uitdagend en geen afhankelijkheden. Een engine heeft toch een eigen, snelle zetgenerator nodig. Wel meer werk aan de regels. |
| B | chess.js voor de regels, plus een eigen engine | De regels zijn sneller klaar, maar chess.js is te traag om diep te zoeken, dus de tegenstander wordt zwakker. Ook minder uitdagend. |
| C | Stockfish (WebAssembly) | Het sterkst en het minste werk, maar **afgewezen**: de gebruiker wil een eigen tegenstander. |
| – | Native Android-app (Kotlin of Capacitor) | Onnodig: een PWA is gratis, simpeler en voldoet aan alle doelen. |

**Gekozen: A.** De gebruiker liet de technische keuzes aan mij over en
besliste zelf alleen: Android, een eigen tegenstander en stap voor stap
werken.

## Keuzes van de bouwer (de gebruiker kan ze corrigeren)

- **Techniek:** HTML, CSS en JavaScript (ES-modules), zonder framework en
  zonder afhankelijkheden in de app zelf.
- **Engine:** minimax met alfa-bètasnoeiing. Later komen daar zetordening,
  quiescence search, iteratieve verdieping met een tijdslimiet en
  positietabellen bij. De engine draait in een **Web Worker**, zodat het
  scherm nooit bevriest.
- **Correctheid:** de zetgenerator wordt getest met **perft** (bekende
  aantallen posities vanuit standaardstellingen, zoals de beginstelling en
  "Kiwipete") via `node --test`.
- **Bediening:** tik op een stuk en tik daarna op het doelveld. Mogelijke
  zetten, de laatste zet en een koning die schaak staat worden gemarkeerd.
  Bij promotie verschijnt een keuzemenu. Slepen is optioneel, voor later.
- **Bord:** je eigen kleur staat altijd onderaan, dus het bord draait als je
  met zwart speelt.
- **Twee spelers op één telefoon:** komt gratis mee in stap 3 en blijft
  beschikbaar als speelstand.
- **Niveaus:** ongeveer vijf. De gebruiker heeft zelf een Elo-rating van
  iets boven de 700 (beginner). **Niveau 1 is op die sterkte afgestemd**:
  het maakt bewust geregeld fouten en laat soms stukken hangen, zodat de
  gebruiker kan winnen maar er wel moeite voor moet doen. Niveau 2 ligt net
  boven de gebruiker, zodat er ruimte is om te groeien. De hogere niveaus
  lopen op tot de volle sterkte van de engine.
- **Partij onthouden:** de lopende partij wordt opgeslagen in `localStorage`,
  zodat je verder kunt na het sluiten van de app.
- **Remise door herhaling of de 50-zettenregel:** de partij eindigt
  **automatisch** bij drievoudige herhaling en na 50 zetten zonder slag of
  pionzet, zoals in de meeste schaak-apps. Volgens de FIDE-regels moet je
  zo'n remise eigenlijk claimen, maar een claimknop maakt de app voor deze
  gebruiker alleen ingewikkelder. Dit is later makkelijk aan te passen.
- **Sterkte van de tegenstander:** zo sterk als redelijk haalbaar in
  JavaScript op een telefoon. Naast de punten hierboven komen er in stap 5
  ook een transpositietabel (Zobrist-hashing) en killer- en history-zetten
  bij. Snelheid weegt daarom mee bij de keuze voor de bordrepresentatie in
  stap 2.
- **Controle van stap 4 en 5:** niet alleen op gevoel, want met een rating
  rond de 700 kan de gebruiker de hogere niveaus niet zelf beoordelen. De
  nieuwe versie van de engine speelt een reeks partijen tegen de vorige
  versie en moet duidelijk winnen. Daarnaast moet hij tactische testposities
  oplossen, zoals mat-in-2 en het winnen van een stuk. De gebruiker test
  vooral of niveau 1 te winnen is en of de hogere niveaus duidelijk lastiger
  aanvoelen.
- **Taal van de app:** Nederlands.
- **Testen op de telefoon tijdens het bouwen:** via een USB-kabel en
  `chrome://inspect` met port forwarding, zodat `localhost` op de telefoon
  werkt, inclusief installeren als app. Aan het eind komt de app op gratis
  hosting met HTTPS.

## Stappenplan

Na elke stap test de gebruiker het resultaat, en pas na akkoord begint de
volgende stap.

1. **Opzet en bord:** de projectstructuur, een lokale server, en een
   schaakbord met stukken in de beginstelling op het scherm.
2. **Spelregels:** de zetgenerator met alle speciale zetten, getest met
   perft. Niet zichtbaar, wel bewezen correct.
3. **Speelbaar met twee spelers:** zetten doen door te tikken, markeringen,
   promotiekeuze, en meldingen bij schaak, mat, pat en remise.
4. **Tegenstander, versie 1:** minimax met alfa-bèta en een evaluatie op
   basis van materiaal, in een Web Worker.
5. **Slimmere tegenstander:** positietabellen, zetordening, quiescence en
   iteratieve verdieping met een tijdslimiet, plus de niveaus.
6. **Spelopties:** kleur kiezen, niveau kiezen, een zet terugnemen, een
   nieuw spel beginnen en de partij onthouden.
7. **PWA:** manifest, pictogram en service worker, zodat de app offline werkt
   en te installeren is. Testen op de Android-telefoon via USB.
8. **Online zetten:** gratis hosting met HTTPS, en de app installeren op de
   telefoon.

## Aan de bouwer overgelaten

De bordrepresentatie (0x88, 10×12 of bitboards), de bestandsstructuur, de
lokale ontwikkelserver, de exacte evaluatiewaarden en tabellen, de precieze
instellingen per niveau, de set stukken (een vrije open-source set met
naamsvermelding, of zelfgetekende SVG's), de kleuren en vormgeving (rustig,
met velden die groot genoeg zijn voor een duim), en de keuze van de gratis
host (bijvoorbeeld GitHub Pages, Netlify of Cloudflare Pages).
