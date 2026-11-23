import { START_FEN, boardFromFen } from './fen.js';
import { renderBoard } from './board-view.js';

renderBoard(document.getElementById('board'), boardFromFen(START_FEN));
