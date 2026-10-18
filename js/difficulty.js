// Difficulty the way puzzle books grade it: solve with human techniques, easiest first, and
// grade the puzzle by the hardest technique it needs (see js/techniques.js for the tiers).

import { SIZE, generateSolution, countSolutions, shuffle } from './sudoku.js';
import { Grid, TECHNIQUE, applyStep, nextStep } from './techniques.js';

// Given-digit ranges follow typical newspaper and puzzle-book puzzles at each level.
export const LEVELS = {
  easy: { tier: 1, clues: [34, 38] },
  medium: { tier: 2, clues: [28, 31] },
  hard: { tier: 3, clues: [24, 27] },
  expert: { tier: 4, clues: [22, 26] },
};

// Solve with the techniques, easiest first. tier is the hardest tier used, or 5 if the
// techniques can't finish the puzzle.
export function solveLogically(puzzle) {
  const grid = Grid.fromPuzzle(puzzle);
  const steps = [];
  let tier = 1;
  while (!grid.isSolved()) {
    const step = nextStep(grid);
    if (!step) return { tier: 5, steps, board: grid.board };
    tier = Math.max(tier, TECHNIQUE[step.technique].tier);
    steps.push(step);
    applyStep(grid, step);
  }
  return { tier, steps, board: grid.board };
}

export function gradePuzzle(puzzle) {
  return solveLogically(puzzle).tier;
}

// A puzzle with a unique solution, a given count in the level's range and exactly the
// level's tier. Retries with new grids until one fits.
export function generateLevel(name) {
  const { tier, clues } = LEVELS[name];
  for (;;) {
    const solution = generateSolution();
    const puzzle = solution.slice();
    const target = clues[0] + Math.floor(Math.random() * (clues[1] - clues[0] + 1));
    let filled = SIZE;
    for (const i of shuffle([...Array(SIZE).keys()])) {
      if (filled <= target) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle) === 1) filled--;
      else puzzle[i] = keep;
    }
    if (filled <= clues[1] && gradePuzzle(puzzle) === tier) return { puzzle, solution };
  }
}
