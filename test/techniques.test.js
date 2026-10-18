import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, UNITS, countSolutions, generatePuzzle } from '../js/sudoku.js';
import { Grid, TECHNIQUES, TECHNIQUE, applyStep, explainMove, nextStep, stepDone } from '../js/techniques.js';
import { LEVELS, generateLevel, solveLogically } from '../js/difficulty.js';

const isValid = (board) => UNITS.every((u) => new Set(u.map((i) => board[i])).size === 9);

test('generatePuzzle returns a uniquely solvable puzzle consistent with its solution', () => {
  const { puzzle, solution } = generatePuzzle(30);
  assert.ok(isValid(solution));
  assert.equal(countSolutions(puzzle), 1);
  for (let i = 0; i < SIZE; i++) if (puzzle[i]) assert.equal(puzzle[i], solution[i]);
});

test('every step of every technique agrees with the solution', () => {
  const fired = new Set();
  for (let k = 0; k < 60; k++) {
    const { puzzle, solution } = generatePuzzle(22 + (k % 6));
    const g = Grid.fromPuzzle(puzzle);
    for (let step = nextStep(g); step; step = nextStep(g)) {
      for (const t of TECHNIQUES) {
        for (const s of t.find(g)) {
          fired.add(t.id);
          for (const [i, d] of s.placements) assert.equal(solution[i], d, `${t.id}: ${s.text}`);
          for (const [i, d] of s.eliminations) assert.notEqual(solution[i], d, `${t.id}: ${s.text}`);
          assert.ok(s.placements.length + s.eliminations.length > 0, `${t.id} made no progress`);
        }
      }
      applyStep(g, step);
    }
  }
  assert.deepEqual([...TECHNIQUES.map((t) => t.id)].filter((id) => !fired.has(id)), []);
});

test('generated levels have the right tier, given count and a unique solution', () => {
  for (const [name, { tier, clues }] of Object.entries(LEVELS)) {
    const { puzzle, solution } = generateLevel(name);
    const n = puzzle.filter(Boolean).length;
    assert.ok(n >= clues[0] && n <= clues[1], `${name}: ${n} givens`);
    const result = solveLogically(puzzle);
    assert.equal(result.tier, tier, name);
    assert.deepEqual([...result.board], solution);
    assert.equal(countSolutions(puzzle), 1);
  }
});

test('explainMove recognises a user move and stepDone tracks completion', () => {
  const { puzzle } = generateLevel('easy');
  const g = Grid.fromPuzzle(puzzle);
  const step = nextStep(g);
  const [[cell, digit]] = step.placements;
  const explained = explainMove(g, { type: 'place', cell, digit });
  assert.equal(TECHNIQUE[explained.technique].tier, 1);
  assert.equal(stepDone(g, step), false);
  g.place(cell, digit);
  assert.equal(stepDone(g, step), true);
});

test('contradiction is reported when a cell runs out of candidates', () => {
  const { puzzle } = generateLevel('easy');
  const g = Grid.fromPuzzle(puzzle);
  const i = puzzle.indexOf(0);
  g.cand[i] = 0;
  assert.match(g.contradiction().text, /no candidates left/);
});
