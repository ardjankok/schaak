# De app testen op je Android-telefoon

Zo zet je de app via een USB-kabel op je telefoon, terwijl hij nog op de laptop draait.
Als de app later online staat (stap 8), heb je dit niet meer nodig: dan open je gewoon het webadres.

## 1. Eenmalig: de telefoon klaarmaken

1. Open **Instellingen → Over de telefoon** (soms **Telefooninfo → Software-informatie**).
2. Tik **7 keer** op **Buildnummer**, totdat je de melding krijgt dat je nu ontwikkelaar bent.
3. Ga naar **Instellingen → Systeem → Ontwikkelaarsopties** en zet **USB-foutopsporing** aan.
4. Werk Chrome bij via de Play Store.
5. Gebruik een USB-kabel die ook data doorgeeft (de originele kabel van de telefoon werkt meestal).

## 2. De laptop klaarmaken

1. Open een terminal in de projectmap en start de server: `npm start`.
2. Sluit de telefoon aan. Tik op de telefoon op **Toestaan** bij "USB-foutopsporing toestaan?".
3. Open op de laptop in Chrome: `chrome://inspect/#devices`. Je telefoon staat in de lijst.
4. Klik op **Port forwarding…**, vul in: poort `8080`, adres `localhost:8080`, zet **Enable port forwarding** aan en klik op **Done**.

## 3. De app installeren

1. Open op de telefoon in Chrome: `http://localhost:8080`.
2. Tik op het menu **⋮** rechtsboven en kies **App installeren** (of **Toevoegen aan startscherm** → **Installeren**).
3. Het pictogram (een witte pion op een schaakbord) staat nu op je beginscherm.

## 4. Wat je kunt testen

- [ ] Open de app via het pictogram: er is geen adresbalk van Chrome.
- [ ] Speel een paar zetten: de computer antwoordt.
- [ ] Zet **vliegtuigmodus** aan, sluit de app helemaal (wegvegen bij de recente apps) en open hem weer: hij werkt nog, ook de computer.
- [ ] Draai de telefoon dwars: het bord staat links, de status rechts.

## Als het niet lukt

- **Je telefoon staat niet in `chrome://inspect`:** probeer een andere kabel of USB-poort, en kijk of de melding "USB-foutopsporing toestaan?" op de telefoon is verschenen.
- **`localhost:8080` laadt niet op de telefoon:** kijk of `npm start` nog draait en of port forwarding aan staat (het groene bolletje in `chrome://inspect`).
- **"App installeren" staat niet in het menu:** laad de pagina één keer opnieuw en wacht een paar seconden. Kies anders **Toevoegen aan startscherm**.
- **Je ziet een oude versie na een wijziging:** de app komt uit de cache. Sluit de app en open hem opnieuw (de nieuwe versie wordt op de achtergrond geladen), of laad de pagina twee keer opnieuw.
