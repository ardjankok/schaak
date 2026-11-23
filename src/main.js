// Koppelt de pagina aan de partij: tikken, het promotiemenu, de statusregel,
// en de computer die in een Web Worker nadenkt.
import { START_FEN } from './fen.js';
import { Game } from './game.js';
import { renderBoard, pieceImage } from './board-view.js';

/** Hoeveel halve zetten de computer vooruit rekent. */
const ENGINE_DEPTH = 3;
/** Minimale denktijd, zodat je eerst je eigen zet ziet staan. */
const MIN_THINK_MS = 400;

const game = new Game(START_FEN, { computerColor: 'black' });
const worker = new Worker(new URL('./engine/worker.js', import.meta.url), { type: 'module' });
let requestId = 0; // alleen het antwoord op het laatste verzoek telt
let requestStart = 0;
let engineFailed = false;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const newGameButton = document.getElementById('new-game');
const promotionDialog = document.getElementById('promotion');

function render() {
  renderBoard(boardEl, game.pieces(), {
    selected: game.selected,
    targets: game.targets(),
    lastMove: game.lastMove,
    check: game.checkSquare,
  });
  statusEl.textContent = engineFailed ? 'De computer kon geen zet bedenken' : game.statusText();
  newGameButton.hidden = !(game.isOver || engineFailed);
}

/** Vraagt de computer om een zet, als hij aan zet is. */
function askComputer() {
  if (!game.isComputerTurn) return;
  requestId += 1;
  requestStart = performance.now();
  worker.postMessage({ id: requestId, startFen: game.startFen, moves: game.moves(), depth: ENGINE_DEPTH });
}

/** Het scherm blijft nooit hangen op "De computer denkt na…". */
function computerFailed(reason) {
  console.error('De computer kon geen zet bedenken:', reason);
  engineFailed = true;
  requestId += 1; // een later antwoord telt niet meer
  render();
}

worker.addEventListener('message', ({ data }) => {
  if (data.id !== requestId) return; // oud antwoord, bijvoorbeeld van voor "Nieuwe partij"
  if (data.error) {
    computerFailed(data.error);
    return;
  }
  const delay = Math.max(0, MIN_THINK_MS - (performance.now() - requestStart));
  setTimeout(() => {
    if (data.id !== requestId) return;
    if (!game.playUci(data.move)) {
      computerFailed(`ongeldige zet ${data.move}`);
      return;
    }
    render();
  }, delay);
});

worker.addEventListener('error', (event) => computerFailed(event.message || 'de worker liep vast'));

/** Toont de vier stukken in de kleur van de speler die promoveert. */
function openPromotion() {
  const white = game.turn === 'white';
  for (const button of promotionDialog.querySelectorAll('[data-piece]')) {
    const letter = button.dataset.piece;
    button.querySelector('img').src = pieceImage(white ? letter.toUpperCase() : letter);
  }
  promotionDialog.showModal();
}

boardEl.addEventListener('click', (event) => {
  const squareEl = event.target.closest('[data-square]');
  if (!squareEl) return;
  // Het menu is al dicht (Esc of terugknop), maar Chrome levert 'close' pas bij het
  // volgende frame af: dan vervalt de promotie hier, zodat de tik gewoon telt.
  if (game.pendingPromotion && !promotionDialog.open) game.cancelPromotion();
  const result = game.tap(squareEl.dataset.square);
  if (result === 'promotion') openPromotion();
  render();
  if (result === 'moved') askComputer();
});

/** Sluit het promotiemenu. Een promotie die dan nog wacht, gaat niet door. */
function closePromotion() {
  if (game.pendingPromotion) game.cancelPromotion();
  if (promotionDialog.open) promotionDialog.close();
  render();
}

promotionDialog.addEventListener('click', (event) => {
  const button = event.target.closest('[data-piece]');
  if (!button && event.target !== promotionDialog) return; // tik tussen de knoppen
  // Een keuze, of een tik naast het menu (de dialog zelf is alleen de achtergrond).
  const chosen = button ? game.choosePromotion(button.dataset.piece) : false;
  closePromotion();
  if (chosen) askComputer();
});

// Esc en de terugknop van Android sluiten het menu zelf; dan gaat de partij gewoon verder.
// 'cancel' komt meteen; 'close' is het vangnet als de browser 'cancel' overslaat.
// Een laat 'close' van een eerder menu mag een opnieuw geopend menu niet sluiten.
promotionDialog.addEventListener('cancel', closePromotion);
promotionDialog.addEventListener('close', () => {
  if (!promotionDialog.open) closePromotion();
});

newGameButton.addEventListener('click', () => {
  requestId += 1; // een antwoord voor de vorige partij telt niet meer
  engineFailed = false;
  game.reset();
  render();
  askComputer();
});

render();
askComputer();
