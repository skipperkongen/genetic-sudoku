import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, UNITS, countSolutions, generatePuzzle } from '../js/sudoku.js';
import { GeneticSolver } from '../js/ga.js';

const isValid = (board) => UNITS.every((u) => new Set(u.map((i) => board[i])).size === 9);
const digitCounts = (arr) => [...Array(10).keys()].map((d) => arr.filter((x) => x === d).length);

test('generatePuzzle returns a uniquely solvable puzzle consistent with its solution', () => {
  const { puzzle, solution } = generatePuzzle(36);
  assert.ok(isValid(solution));
  assert.equal(countSolutions(puzzle), 1);
  for (let i = 0; i < SIZE; i++) if (puzzle[i]) assert.equal(puzzle[i], solution[i]);
});

test('chromosomes keep the givens and nine of every digit, and fitness is 0 for the solution', () => {
  const { puzzle, solution } = generatePuzzle(40);
  const ga = new GeneticSolver(puzzle, { populationSize: 50, crossoverRate: 0.5 });
  for (let g = 0; g < 20; g++) ga.step();
  for (const ind of ga.population) {
    assert.deepEqual(digitCounts([...ind]).slice(1), Array(9).fill(9));
    for (let i = 0; i < SIZE; i++) if (puzzle[i]) assert.equal(ind[i], puzzle[i]);
  }
  assert.equal(ga.score(Uint8Array.from(solution)), 0);
  assert.ok(ga.score(ga.population[0]) >= 0);
});

test('solves an easy puzzle', () => {
  const { puzzle } = generatePuzzle(40);
  const ga = new GeneticSolver(puzzle);
  while (!ga.step() && ga.generation < 20000);
  assert.equal(ga.bestFitness, 0);
  assert.ok(isValid([...ga.best]));
});
