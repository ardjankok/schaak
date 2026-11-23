// Tekent het schaakbord in de pagina.

const FILES = 'abcdefgh';

const NAMES = {
  k: { name: 'koning', article: 'de' },
  q: { name: 'dame', article: 'de' },
  r: { name: 'toren', article: 'de' },
  b: { name: 'loper', article: 'de' },
  n: { name: 'paard', article: 'het' },
  p: { name: 'pion', article: 'de' },
};

const isWhitePiece = (piece) => piece === piece.toUpperCase();

/** Veldnamen in tekenvolgorde: van linksboven naar rechtsonder. */
export function squareOrder(orientation = 'white') {
  const ranks = orientation === 'black' ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = orientation === 'black' ? [...FILES].reverse() : [...FILES];
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

/** a1 is donker, h1 is licht. */
export function isLightSquare(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return (fileIndex + rank) % 2 === 0;
}

/** Relatief pad naar het plaatje van een stuk, bijvoorbeeld 'K' -> 'assets/pieces/wK.svg'. */
export function pieceImage(piece) {
  const color = isWhitePiece(piece) ? 'w' : 'b';
  return `assets/pieces/${color}${piece.toUpperCase()}.svg`;
}

/** Nederlandse naam van een stuk, bijvoorbeeld 'n' -> 'zwart paard'. */
export function pieceName(piece) {
  const { name, article } = NAMES[piece.toLowerCase()];
  const white = isWhitePiece(piece);
  const adjective = article === 'het' ? (white ? 'wit' : 'zwart') : (white ? 'witte' : 'zwarte');
  return `${adjective} ${name}`;
}

/**
 * De CSS-klassen van een veld: kleur, en de markeringen die erop vallen.
 * @param {string} square
 * @param {{ pieces: Record<string, string>, selected?: string | null, targets?: string[],
 *   lastMove?: { from: string, to: string } | null, check?: string | null }} view
 */
export function squareClasses(square, { pieces, selected = null, targets = [], lastMove = null, check = null }) {
  const classes = ['square', isLightSquare(square) ? 'light' : 'dark'];
  if (square === selected) classes.push('selected');
  if (targets.includes(square)) {
    classes.push('target');
    if (pieces[square]) classes.push('capture');
  }
  if (lastMove && (square === lastMove.from || square === lastMove.to)) classes.push('last-move');
  if (square === check) classes.push('check');
  return classes;
}

/** Voorleestekst van een veld, bijvoorbeeld 'e2, witte pion' of 'e4'. */
export function squareLabel(square, pieces) {
  const piece = pieces[square];
  return piece ? `${square}, ${pieceName(piece)}` : square;
}

/**
 * Vervangt de inhoud van `container` door 64 velden met de stukken erop.
 * @param {HTMLElement} container
 * @param {Record<string, string>} pieces veldnaam -> FEN-letter
 * @param {{ orientation?: 'white' | 'black', selected?: string | null, targets?: string[],
 *   lastMove?: { from: string, to: string } | null, check?: string | null }} [options]
 */
export function renderBoard(container, pieces, { orientation = 'white', ...marks } = {}) {
  container.setAttribute('role', 'group');
  const squares = squareOrder(orientation).map((square, index) => {
    const el = document.createElement('div');
    el.className = squareClasses(square, { pieces, ...marks }).join(' ');
    el.dataset.square = square;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', squareLabel(square, pieces));

    const piece = pieces[square];
    if (piece) {
      const img = document.createElement('img');
      img.className = 'piece';
      img.src = pieceImage(piece);
      img.alt = ''; // de naam staat al in de voorleestekst van het veld
      img.draggable = false;
      el.append(img);
    }

    if (index >= 56) el.append(coordinate('file', square[0]));
    if (index % 8 === 0) el.append(coordinate('rank', square[1]));
    return el;
  });

  container.replaceChildren(...squares);
}

function coordinate(kind, text) {
  const span = document.createElement('span');
  span.className = `coord ${kind}`;
  span.textContent = text;
  span.setAttribute('aria-hidden', 'true');
  return span;
}
