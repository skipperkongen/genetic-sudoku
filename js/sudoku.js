// Sudoku board utilities: units, random solution generation, puzzle generation.
// Boards are flat arrays of 81 numbers, row-major, 0 = empty.

export const SIZE = 81;

// The 27 units (9 rows, 9 columns, 9 boxes), each a list of 9 cell indices.
export const UNITS = (() => {
  const units = [];
  for (let r = 0; r < 9; r++) units.push([...Array(9)].map((_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push([...Array(9)].map((_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    units.push([...Array(9)].map((_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  return units;
})();

// For each cell, the indices of the cells it shares a unit with.
export const PEERS = (() => {
  const peers = [...Array(SIZE)].map(() => new Set());
  for (const unit of UNITS) {
    for (const i of unit) for (const j of unit) if (i !== j) peers[i].add(j);
  }
  return peers.map((s) => [...s]);
})();

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function candidates(board, i) {
  let used = 0;
  for (const p of PEERS[i]) used |= 1 << board[p];
  const out = [];
  for (let d = 1; d <= 9; d++) if (!(used & (1 << d))) out.push(d);
  return out;
}

// Backtracking search. Calls onSolution for each solution found; stops when it returns true.
function search(board, randomize, onSolution) {
  let best = -1;
  let bestCands = null;
  for (let i = 0; i < SIZE; i++) {
    if (board[i] !== 0) continue;
    const cands = candidates(board, i);
    if (cands.length === 0) return false;
    if (bestCands === null || cands.length < bestCands.length) {
      best = i;
      bestCands = cands;
      if (cands.length === 1) break;
    }
  }
  if (best === -1) return onSolution(board);
  if (randomize) shuffle(bestCands);
  for (const d of bestCands) {
    board[best] = d;
    if (search(board, randomize, onSolution)) return true;
  }
  board[best] = 0;
  return false;
}

export function generateSolution() {
  const board = new Array(SIZE).fill(0);
  let solution = null;
  search(board, true, (b) => {
    solution = b.slice();
    return true;
  });
  return solution;
}

export function countSolutions(board, limit = 2) {
  let count = 0;
  search(board.slice(), false, () => ++count >= limit);
  return count;
}

// Random puzzle with a unique solution and `givens` filled cells (or slightly more,
// if no further cell can be removed without losing uniqueness).
export function generatePuzzle(givens = 36) {
  const solution = generateSolution();
  const puzzle = solution.slice();
  let filled = SIZE;
  for (const i of shuffle([...Array(SIZE).keys()])) {
    if (filled <= givens) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle) === 1) filled--;
    else puzzle[i] = keep;
  }
  return { puzzle, solution };
}
