import { SIZE, UNITS, generatePuzzle } from './sudoku.js';
import { DEFAULTS, GeneticSolver } from './ga.js';

const FRAME_BUDGET_MS = 14; // time spent stepping the GA per animation frame

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const solveBtn = $('solve');
const newBtn = $('new');
const difficultyEl = $('difficulty');

const cells = [...Array(SIZE)].map(() => {
  const el = document.createElement('div');
  el.className = 'cell';
  boardEl.appendChild(el);
  return el;
});

let puzzle = null;
let solver = null;
let running = false;

function conflicts(board) {
  const bad = new Uint8Array(SIZE);
  for (const unit of UNITS) {
    const where = new Map();
    for (const i of unit) {
      if (!board[i]) continue;
      if (!where.has(board[i])) where.set(board[i], []);
      where.get(board[i]).push(i);
    }
    for (const idx of where.values()) if (idx.length > 1) for (const i of idx) bad[i] = 1;
  }
  return bad;
}

function renderBoard(board, showConflicts) {
  const bad = showConflicts ? conflicts(board) : null;
  for (let i = 0; i < SIZE; i++) {
    cells[i].textContent = board[i] || '';
    cells[i].classList.toggle('given', puzzle[i] !== 0);
    cells[i].classList.toggle('conflict', !!bad?.[i] && puzzle[i] === 0);
  }
}

// Show the 81-digit chromosome grouped by board row; fixed digits are dimmed.
function renderChromosome(ind) {
  const el = $('chromosome');
  el.replaceChildren();
  if (!ind) return;
  for (let r = 0; r < 9; r++) {
    const row = document.createElement('span');
    row.className = 'row';
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c;
      const digit = document.createElement('span');
      digit.textContent = ind[i];
      if (puzzle[i]) digit.className = 'fixed';
      row.appendChild(digit);
    }
    el.appendChild(row);
  }
}

function renderStats() {
  $('generation').textContent = solver ? solver.generation.toLocaleString() : '0';
  $('fitness').textContent = solver ? solver.bestFitness : '–';
  $('best').textContent = solver ? solver.bestEverFitness : '–';
  $('restarts').textContent = solver ? solver.restarts : '0';
}

function setStatus(text) {
  $('status').textContent = text;
}

function newBoard() {
  stop();
  ({ puzzle } = generatePuzzle(Number(difficultyEl.value)));
  solver = null;
  boardEl.classList.remove('solved');
  renderBoard(puzzle, false);
  renderChromosome(null);
  renderStats();
  const empty = puzzle.filter((d) => d === 0).length;
  setStatus(`${SIZE - empty} givens, ${empty} cells to fill.`);
  solveBtn.textContent = 'Solve';
  solveBtn.disabled = false;
}

function frame() {
  if (!running) return;
  const t0 = performance.now();
  let solved = false;
  do solved = solver.step();
  while (!solved && performance.now() - t0 < FRAME_BUDGET_MS);

  renderBoard(solver.best, true);
  renderChromosome(solver.best);
  renderStats();

  if (solved) {
    running = false;
    boardEl.classList.add('solved');
    solveBtn.textContent = 'Solve';
    solveBtn.disabled = true;
    setStatus(`Solved in ${solver.generation.toLocaleString()} generations.`);
    return;
  }
  requestAnimationFrame(frame);
}

function start() {
  if (!solver) solver = new GeneticSolver(puzzle);
  running = true;
  solveBtn.textContent = 'Stop';
  const { populationSize, stagnationLimit } = solver.options;
  setStatus(`Population ${populationSize}, reseeding after ${stagnationLimit} generations without improvement.`);
  requestAnimationFrame(frame);
}

function stop() {
  if (!running) return;
  running = false;
  solveBtn.textContent = 'Resume';
  setStatus('Paused.');
}

solveBtn.addEventListener('click', () => (running ? stop() : start()));
newBtn.addEventListener('click', newBoard);
difficultyEl.addEventListener('change', newBoard);

// Fill the explainer's parameter values from the solver defaults so the text stays in sync.
for (const el of document.querySelectorAll('[data-option]')) {
  const value = DEFAULTS[el.dataset.option];
  el.textContent = el.dataset.option === 'eliteFraction' ? `${Math.round(value * 100)}%` : value.toLocaleString();
}

newBoard();
