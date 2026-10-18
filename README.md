# Sudoku Techniques

A static web app that teaches the techniques people use to solve Sudoku. It's plain HTML, CSS
and JavaScript with no build step or dependencies.

## Run

```sh
npm start              # or: python3 -m http.server 8000
open http://localhost:8000
```

You need a local server because the page uses ES modules and a module worker, which browsers
don't load from `file://`. Any static host, such as GitHub Pages, works. `npm test` runs the
tests with Node's built-in test runner.

## How it works

Every step has the same four parts: analyse the board, find the easiest technique that makes
progress, explain it, and apply it.

- **Manual:** you apply each step. **Hint** names the technique and highlights where to look.
  **Show me** explains the exact deduction. **Do it for me** applies it. Moves that break a rule
  (a digit that's already in the row, column or box) are blocked. Moves that are legal but wrong
  are allowed. If they later leave the board unsolvable, the app says why and offers to undo to
  before the first mistake.
- **Auto:** the app shows each step, then applies it. Play runs continuously; Show next step goes
  one step at a time.
- **Timeline:** one dot per step, one row per technique, time left to right, with a count per
  row. Click a dot to see the board at that step. Summary statistics and a table view sit
  alongside.

Your own moves are recognised: if a placement or elimination follows from a technique, it's
recorded under that technique. Otherwise it's recorded as an "Own move".

## Difficulty

Puzzles are graded the way puzzle books grade them: by the hardest technique a person needs,
not by the number of givens. Every puzzle has exactly one solution and can be solved without
guessing.

| Level | Givens | Hardest technique needed |
|---|---|---|
| Easy | 34–38 | Singles |
| Medium | 28–31 | Pointing, claiming, naked or hidden pairs |
| Hard | 24–27 | Triples, X-wing, swordfish |
| Expert | 22–26 | Skyscraper, 2-string kite, XY-wing, XYZ-wing, quads, jellyfish |

[`docs/techniques.md`](docs/techniques.md) lists the known techniques and marks the 18 this app
implements.

## Files

- `index.html`, `style.css`: the page
- `js/techniques.js`: the techniques. Each finds where it applies, explains it, and lists the
  cells to highlight.
- `js/difficulty.js`: grading and level generation
- `js/sudoku.js`: units, full-grid generation, uniqueness check
- `js/app.js`: the app (modes, input, undo, inspect)
- `js/timeline.js`: the timeline chart
- `js/worker.js`: generates puzzles off the main thread
- `test/`: engine tests, including a check that no technique ever contradicts the solution
