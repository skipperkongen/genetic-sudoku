# genetic-sudoku

A static web demo that solves Sudoku with a genetic algorithm. It's plain HTML, CSS and JavaScript with no build step or dependencies.

## Run

```sh
npm start              # or: python3 -m http.server 8000
open http://localhost:8000
```

You need a local server because the page uses ES modules, which browsers don't load from `file://`. Any static host, such as GitHub Pages, works.

## How it works

- **Board:** a random puzzle with a unique solution is created when the page loads. A random full grid is built by backtracking, then cells are removed while the solution stays unique.
- **Chromosome:** a full 81-cell board that always contains nine of every digit. The givens stay in their fixed cells and the remaining digits are shuffled over the free cells.
- **Fitness:** each row, column and box adds one point for every digit it is missing, which is one point per broken rule. 0 means solved.
- **Mutation:** swaps the digits of two free cells, never the fixed ones. One of the two cells is always a free cell whose digit currently clashes with another cell in its row, column or box. This guided swap is what lets harder puzzles converge.
- **GA:** a population of 200, tournament selection (size 3), 5% elitism, and a restart of the population after 500 generations without improvement. An order crossover over the free cells is implemented but turned off by default (`crossoverRate: 0`), because in benchmarks it slowed convergence.

All three difficulty levels usually solve within a few seconds. Puzzles with fewer than about 30 givens tend to get stuck at fitness 2.

## Files

- `index.html`, `style.css`: the page
- `js/sudoku.js`: units, puzzle generation, uniqueness check
- `js/ga.js`: `GeneticSolver`
- `js/main.js`: UI and animation loop (runs the GA for about 14 ms per frame)
- `test/`: `npm test` (Node's built-in test runner)
