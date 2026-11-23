// Koppelt de pagina aan de partij: tikken, het promotiemenu en de statusregel.
import { Game } from './game.js';
import { renderBoard, pieceImage } from './board-view.js';

const game = new Game();
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
  statusEl.textContent = game.statusText();
  newGameButton.hidden = !game.isOver;
}

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
  if (game.tap(squareEl.dataset.square) === 'promotion') openPromotion();
  render();
});

/** Sluit het promotiemenu. Een promotie die dan nog wacht, gaat niet door. */
function closePromotion() {
  if (game.pendingPromotion) game.cancelPromotion();
  if (promotionDialog.open) promotionDialog.close();
  render();
}

promotionDialog.addEventListener('click', (event) => {
  const button = event.target.closest('[data-piece]');
  if (button) {
    game.choosePromotion(button.dataset.piece);
  } else if (event.target !== promotionDialog) {
    return; // tik tussen de knoppen
  }
  // Een keuze, of een tik naast het menu (de dialog zelf is alleen de achtergrond).
  closePromotion();
});

// Esc en de terugknop van Android sluiten het menu zelf; dan gaat de partij gewoon verder.
// 'cancel' komt meteen; 'close' is het vangnet als de browser 'cancel' overslaat.
// Een laat 'close' van een eerder menu mag een opnieuw geopend menu niet sluiten.
promotionDialog.addEventListener('cancel', closePromotion);
promotionDialog.addEventListener('close', () => {
  if (!promotionDialog.open) closePromotion();
});

newGameButton.addEventListener('click', () => {
  game.reset();
  render();
});

render();
