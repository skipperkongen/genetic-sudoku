// Genetic algorithm for Sudoku.
//
// Chromosome: a full 81-cell board (row-major) that always contains exactly nine of each
// digit 1-9. The givens sit in their fixed cells; the remaining digits are shuffled over
// the free cells. Operators only ever move digits between free cells, so the digit counts
// and the givens are preserved and only the placement is being optimized.
//
// Fitness: for each of the 27 units (rows, columns, boxes), the number of digits missing
// from it, i.e. one per rule violation (a repeated digit). 0 means solved; lower is better.

import { SIZE, UNITS, shuffle } from './sudoku.js';

const UNIT_ARRAYS = UNITS.map((u) => Int32Array.from(u));

const POPCOUNT = new Uint8Array(1 << 10);
for (let m = 1; m < POPCOUNT.length; m++) POPCOUNT[m] = (m & 1) + POPCOUNT[m >> 1];

const randInt = (n) => Math.floor(Math.random() * n);

export const DEFAULTS = {
  populationSize: 200,
  eliteFraction: 0.05,
  tournamentSize: 3,
  crossoverRate: 0, // order crossover over the free cells; disrupts more than it helps here
  mutationRate: 0.5, // chance per child of a swap; repeated, so several swaps can happen
  guidedMutation: true, // one of the two swapped cells is always a conflicting one
  stagnationLimit: 500, // generations without improvement before the population is reseeded
};

export class GeneticSolver {
  constructor(puzzle, options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.puzzle = Uint8Array.from(puzzle);
    this.freeCells = Int32Array.from([...this.puzzle.keys()].filter((i) => this.puzzle[i] === 0));

    const counts = new Array(10).fill(9);
    for (const d of this.puzzle) if (d) counts[d]--;
    this.pool = [];
    for (let d = 1; d <= 9; d++) for (let k = 0; k < counts[d]; k++) this.pool.push(d);

    const { populationSize } = this.options;
    this.population = [...Array(populationSize)].map(() => Uint8Array.from(this.puzzle));
    this.next = [...Array(populationSize)].map(() => Uint8Array.from(this.puzzle));
    this.fitness = new Int32Array(populationSize);
    this.order = new Int32Array(populationSize);
    this.taken = new Int32Array(10);
    this.unitCounts = new Uint8Array(UNITS.length * 10);
    this.conflicting = new Int32Array(this.freeCells.length);

    this.generation = 0;
    this.restarts = 0;
    this.bestEver = null;
    this.bestEverFitness = Infinity;
    this.sinceImprovement = 0;
    this.seed();
  }

  // Give every individual a random arrangement of the missing digits over the free cells.
  seed() {
    for (const ind of this.population) {
      const digits = shuffle(this.pool.slice());
      for (let k = 0; k < this.freeCells.length; k++) ind[this.freeCells[k]] = digits[k];
    }
    this.evaluate();
    this.lastBestFitness = this.bestFitness;
  }

  score(board) {
    let violations = 0;
    for (const unit of UNIT_ARRAYS) {
      let seen = 0;
      for (let k = 0; k < 9; k++) seen |= 1 << board[unit[k]];
      violations += 9 - POPCOUNT[seen >> 1];
    }
    return violations;
  }

  evaluate() {
    const { population, fitness, order } = this;
    for (let i = 0; i < population.length; i++) {
      fitness[i] = this.score(population[i]);
      order[i] = i;
    }
    order.sort((a, b) => fitness[a] - fitness[b]);
    this.best = population[order[0]];
    this.bestFitness = fitness[order[0]];
    if (this.bestFitness < this.bestEverFitness) {
      this.bestEverFitness = this.bestFitness;
      this.bestEver = this.best.slice();
    }
  }

  tournament() {
    let winner = randInt(this.population.length);
    for (let t = 1; t < this.options.tournamentSize; t++) {
      const c = randInt(this.population.length);
      if (this.fitness[c] < this.fitness[winner]) winner = c;
    }
    return this.population[winner];
  }

  // Order crossover (OX) over the free cells, adapted to repeated digits: copy a random
  // stretch of free cells from parent a, then fill the other free cells with b's digits
  // in order, skipping the ones already used. Fixed cells are untouched.
  crossover(a, b, child) {
    const free = this.freeCells;
    const n = free.length;
    let i = randInt(n);
    let j = randInt(n);
    if (i > j) [i, j] = [j, i];
    const taken = this.taken;
    taken.fill(0);
    for (let k = i; k <= j; k++) {
      child[free[k]] = a[free[k]];
      taken[a[free[k]]]++;
    }
    let pos = (j + 1) % n;
    for (let t = 0; t < n; t++) {
      const d = b[free[(j + 1 + t) % n]];
      if (taken[d] > 0) {
        taken[d]--;
        continue;
      }
      child[free[pos]] = d;
      pos = (pos + 1) % n;
    }
  }

  // Free cells whose digit is repeated in one of their units. Returns how many were found.
  findConflicts(board) {
    const counts = this.unitCounts;
    counts.fill(0);
    for (let u = 0; u < UNIT_ARRAYS.length; u++) {
      const unit = UNIT_ARRAYS[u];
      for (let k = 0; k < 9; k++) counts[u * 10 + board[unit[k]]]++;
    }
    let n = 0;
    for (const cell of this.freeCells) {
      const d = board[cell];
      const r = Math.floor(cell / 9);
      const c = cell % 9;
      const b = 18 + Math.floor(r / 3) * 3 + Math.floor(c / 3);
      if (counts[r * 10 + d] > 1 || counts[(9 + c) * 10 + d] > 1 || counts[b * 10 + d] > 1) {
        this.conflicting[n++] = cell;
      }
    }
    return n;
  }

  // Swap the digits of two free cells; repeat while a coin flip says so.
  mutate(board) {
    const free = this.freeCells;
    if (free.length < 2) return;
    do {
      let i;
      if (this.options.guidedMutation) {
        const n = this.findConflicts(board);
        i = n > 0 ? this.conflicting[randInt(n)] : free[randInt(free.length)];
      } else {
        i = free[randInt(free.length)];
      }
      const j = free[randInt(free.length)];
      const tmp = board[i];
      board[i] = board[j];
      board[j] = tmp;
    } while (Math.random() < this.options.mutationRate);
  }

  // Advance one generation. Returns true once a solution has been found.
  step() {
    if (this.bestFitness === 0) return true;
    const { populationSize, eliteFraction, crossoverRate, mutationRate, stagnationLimit } = this.options;
    const eliteCount = Math.max(1, Math.round(populationSize * eliteFraction));

    for (let e = 0; e < eliteCount; e++) this.next[e].set(this.population[this.order[e]]);
    for (let c = eliteCount; c < populationSize; c++) {
      const child = this.next[c];
      const a = this.tournament();
      if (Math.random() < crossoverRate) this.crossover(a, this.tournament(), child);
      else child.set(a);
      if (Math.random() < mutationRate) this.mutate(child);
    }
    [this.population, this.next] = [this.next, this.population];
    this.generation++;
    this.evaluate();

    if (this.bestFitness < this.lastBestFitness) {
      this.lastBestFitness = this.bestFitness;
      this.sinceImprovement = 0;
    } else if (++this.sinceImprovement >= stagnationLimit) {
      this.restarts++;
      this.sinceImprovement = 0;
      this.seed();
    }
    return this.bestFitness === 0;
  }
}
