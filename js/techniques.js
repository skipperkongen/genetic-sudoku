// Human solving techniques. Each technique is a generator over the steps it can take on
// the current grid; a step says what to place or eliminate, which cells and units form the
// pattern (for highlighting), and explains it in words.
//
// Step: { technique, placements: [[cell, digit]], eliminations: [[cell, digit]],
//         units: [unit], cells: [cell], digits: [digit], text }

import { SIZE, UNITS, PEERS } from './sudoku.js';

const ALL = 0x3fe; // bits 1-9
export const COUNT = new Uint8Array(1 << 10);
for (let m = 1; m < COUNT.length; m++) COUNT[m] = (m & 1) + COUNT[m >> 1];

const row = (i) => Math.floor(i / 9);
const col = (i) => i % 9;
const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
const ROW = (r) => r;
const COL = (c) => 9 + c;
const BOX = (b) => 18 + b;
export const CELL_UNITS = [...Array(SIZE)].map((_, i) => [ROW(row(i)), COL(col(i)), BOX(box(i))]);

const SEES = new Uint8Array(SIZE * SIZE);
PEERS.forEach((peers, i) => peers.forEach((p) => (SEES[i * SIZE + p] = 1)));
const sees = (a, b) => SEES[a * SIZE + b] === 1;

export const cellName = (i) => `r${row(i) + 1}c${col(i) + 1}`;
export const unitName = (u) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const digitsOf = (mask) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => mask & (1 << d));

// "a", "a and b", "a, b and c"
export function list(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

// "remove 4 from r1c2 and r1c5; remove 7 from r3c3"
function removals(eliminations) {
  const byDigit = new Map();
  for (const [cell, d] of eliminations) {
    if (!byDigit.has(d)) byDigit.set(d, []);
    byDigit.get(d).push(cellName(cell));
  }
  return [...byDigit].map(([d, cells]) => `remove ${d} from ${list(cells)}`).join('; ');
}

function* combinations(items, k, start = 0, chosen = []) {
  if (chosen.length === k) {
    yield chosen.slice();
    return;
  }
  for (let i = start; i <= items.length - (k - chosen.length); i++) {
    chosen.push(items[i]);
    yield* combinations(items, k, i + 1, chosen);
    chosen.pop();
  }
}

export class Grid {
  constructor(board, cand) {
    this.board = board;
    this.cand = cand;
  }

  static fromPuzzle(puzzle) {
    const board = Uint8Array.from(puzzle);
    const cand = new Uint16Array(SIZE);
    for (let i = 0; i < SIZE; i++) {
      if (board[i]) continue;
      let used = 0;
      for (const p of PEERS[i]) used |= 1 << board[p];
      cand[i] = ALL & ~used;
    }
    return new Grid(board, cand);
  }

  clone() {
    return new Grid(this.board.slice(), this.cand.slice());
  }

  has(i, d) {
    return !this.board[i] && (this.cand[i] & (1 << d)) !== 0;
  }

  // Place a digit and remove it from the candidates of every peer.
  place(i, d) {
    this.board[i] = d;
    this.cand[i] = 0;
    for (const p of PEERS[i]) this.cand[p] &= ~(1 << d);
  }

  remove(i, d) {
    this.cand[i] &= ~(1 << d);
  }

  // The peer holding digit d, if placing d in cell i would break a rule.
  clash(i, d) {
    return PEERS[i].find((p) => this.board[p] === d) ?? -1;
  }

  isSolved() {
    return this.board.every((d) => d !== 0);
  }

  // Why the grid can no longer be solved, or null.
  contradiction() {
    for (let i = 0; i < SIZE; i++) {
      if (!this.board[i] && !this.cand[i]) return { cells: [i], units: [], text: `${cellName(i)} has no candidates left.` };
    }
    for (let u = 0; u < UNITS.length; u++) {
      for (let d = 1; d <= 9; d++) {
        if (UNITS[u].some((i) => this.board[i] === d || this.has(i, d))) continue;
        return { cells: [], units: [u], text: `In ${unitName(u)} there is no place left for ${d}.` };
      }
    }
    return null;
  }
}

function makeStep(technique, { placements = [], eliminations = [], units = [], cells = [], digits = [], text }) {
  return { technique, placements, eliminations, units, cells, digits, text };
}

// Empty cells of a unit that can still hold digit d.
const placesFor = (g, u, d) => UNITS[u].filter((i) => g.has(i, d));
const placedIn = (g, u, d) => UNITS[u].some((i) => g.board[i] === d);

// ---------------------------------------------------------------- singles

function* fullHouse(g) {
  for (let u = 0; u < UNITS.length; u++) {
    const empty = UNITS[u].filter((i) => !g.board[i]);
    if (empty.length !== 1) continue;
    const used = UNITS[u].reduce((m, i) => m | (1 << g.board[i]), 0);
    const d = digitsOf(ALL & ~used)[0];
    const [cell] = empty;
    if (!g.has(cell, d)) continue;
    yield makeStep('full-house', {
      placements: [[cell, d]],
      units: [u],
      cells: [cell],
      digits: [d],
      text: `${cap(unitName(u))} has one empty cell left, ${cellName(cell)}. The only digit missing from ${unitName(u)} is ${d}.`,
    });
  }
}

// Boxes first: that's where people usually spot hidden singles.
const SCAN_ORDER = [...Array(9).keys()].map(BOX).concat([...Array(18).keys()]);

function* hiddenSingle(g) {
  for (const u of SCAN_ORDER) {
    for (let d = 1; d <= 9; d++) {
      if (placedIn(g, u, d)) continue;
      const places = placesFor(g, u, d);
      if (places.length !== 1) continue;
      const [cell] = places;
      yield makeStep('hidden-single', {
        placements: [[cell, d]],
        units: [u],
        cells: [cell],
        digits: [d],
        text: `In ${unitName(u)}, the digit ${d} fits in only one cell: ${cellName(cell)}. Every other empty cell of ${unitName(u)} has already had ${d} ruled out.`,
      });
    }
  }
}

function* nakedSingle(g) {
  for (let i = 0; i < SIZE; i++) {
    if (g.board[i] || COUNT[g.cand[i]] !== 1) continue;
    const [d] = digitsOf(g.cand[i]);
    yield makeStep('naked-single', {
      placements: [[i, d]],
      units: CELL_UNITS[i],
      cells: [i],
      digits: [d],
      text: `${cellName(i)} has only one candidate left: ${d}. Every other digit has already been ruled out for this cell.`,
    });
  }
}

// ---------------------------------------------------------------- intersections

function* pointing(g) {
  for (let b = 0; b < 9; b++) {
    for (let d = 1; d <= 9; d++) {
      const places = placesFor(g, BOX(b), d);
      if (places.length < 2) continue;
      for (const [line, lineOf] of [[ROW, row], [COL, col]]) {
        const l = lineOf(places[0]);
        if (!places.every((i) => lineOf(i) === l)) continue;
        const u = line(l);
        const eliminations = placesFor(g, u, d)
          .filter((i) => box(i) !== b)
          .map((i) => [i, d]);
        if (!eliminations.length) continue;
        yield makeStep('pointing', {
          eliminations,
          units: [BOX(b), u],
          cells: places,
          digits: [d],
          text: `In box ${b + 1}, the ${d} can only go in ${unitName(u)} (${list(places.map(cellName))}). So the ${d} of ${unitName(u)} must be inside box ${b + 1}: ${removals(eliminations)}.`,
        });
      }
    }
  }
}

function* claiming(g) {
  for (let u = 0; u < 18; u++) {
    for (let d = 1; d <= 9; d++) {
      const places = placesFor(g, u, d);
      if (places.length < 2) continue;
      const b = box(places[0]);
      if (!places.every((i) => box(i) === b)) continue;
      const eliminations = placesFor(g, BOX(b), d)
        .filter((i) => !UNITS[u].includes(i))
        .map((i) => [i, d]);
      if (!eliminations.length) continue;
      yield makeStep('claiming', {
        eliminations,
        units: [u, BOX(b)],
        cells: places,
        digits: [d],
        text: `In ${unitName(u)}, the ${d} can only go inside box ${b + 1} (${list(places.map(cellName))}). So the ${d} of box ${b + 1} must be in ${unitName(u)}: ${removals(eliminations)}.`,
      });
    }
  }
}

// ---------------------------------------------------------------- subsets

const SUBSET = { 2: 'pair', 3: 'triple', 4: 'quad' };

function nakedSubset(k) {
  return function* (g) {
    for (let u = 0; u < UNITS.length; u++) {
      const cells = UNITS[u].filter((i) => !g.board[i] && COUNT[g.cand[i]] >= 2 && COUNT[g.cand[i]] <= k);
      for (const combo of combinations(cells, k)) {
        const union = combo.reduce((m, i) => m | g.cand[i], 0);
        if (COUNT[union] !== k) continue;
        const digits = digitsOf(union);
        const eliminations = [];
        for (const i of UNITS[u]) {
          if (combo.includes(i)) continue;
          for (const d of digits) if (g.has(i, d)) eliminations.push([i, d]);
        }
        if (!eliminations.length) continue;
        yield makeStep(`naked-${SUBSET[k]}`, {
          eliminations,
          units: [u],
          cells: combo,
          digits,
          text: `In ${unitName(u)}, the cells ${list(combo.map(cellName))} can only hold ${list(digits)} between them (a naked ${SUBSET[k]}). Those ${k} digits must fill those ${k} cells, so they can't go anywhere else in ${unitName(u)}: ${removals(eliminations)}.`,
        });
      }
    }
  };
}

function hiddenSubset(k) {
  return function* (g) {
    for (let u = 0; u < UNITS.length; u++) {
      const spots = [];
      for (let d = 1; d <= 9; d++) {
        const places = placesFor(g, u, d);
        if (!placedIn(g, u, d) && places.length >= 2 && places.length <= k) spots.push([d, places]);
      }
      for (const combo of combinations(spots, k)) {
        const cells = [...new Set(combo.flatMap(([, places]) => places))].sort((a, b) => a - b);
        if (cells.length !== k) continue;
        const digits = combo.map(([d]) => d);
        const eliminations = [];
        for (const i of cells) for (const d of digitsOf(g.cand[i])) if (!digits.includes(d)) eliminations.push([i, d]);
        if (!eliminations.length) continue;
        yield makeStep(`hidden-${SUBSET[k]}`, {
          eliminations,
          units: [u],
          cells,
          digits,
          text: `In ${unitName(u)}, the digits ${list(digits)} fit only in ${list(cells.map(cellName))} (a hidden ${SUBSET[k]}). Those cells must hold exactly those digits, so their other candidates go: ${removals(eliminations)}.`,
        });
      }
    }
  };
}

// ---------------------------------------------------------------- fish

const FISH = { 2: ['x-wing', 'an X-wing'], 3: ['swordfish', 'a swordfish'], 4: ['jellyfish', 'a jellyfish'] };

function fish(k) {
  const [id, label] = FISH[k];
  return function* (g) {
    for (const byRows of [true, false]) {
      const base = byRows ? ROW : COL;
      const cover = byRows ? COL : ROW;
      const at = byRows ? (line, pos) => line * 9 + pos : (line, pos) => pos * 9 + line;
      const [baseWord, coverWord] = byRows ? ['rows', 'columns'] : ['columns', 'rows'];
      for (let d = 1; d <= 9; d++) {
        const lines = [];
        for (let l = 0; l < 9; l++) {
          const places = placesFor(g, base(l), d);
          if (places.length >= 2 && places.length <= k) lines.push([l, places.map(byRows ? col : row)]);
        }
        for (const combo of combinations(lines, k)) {
          const positions = [...new Set(combo.flatMap(([, ps]) => ps))].sort((a, b) => a - b);
          if (positions.length !== k) continue;
          const baseLines = combo.map(([l]) => l);
          const eliminations = [];
          for (const p of positions) {
            for (let l = 0; l < 9; l++) if (!baseLines.includes(l) && g.has(at(l, p), d)) eliminations.push([at(l, p), d]);
          }
          if (!eliminations.length) continue;
          const cells = baseLines.flatMap((l) => positions.map((p) => at(l, p)).filter((i) => g.has(i, d)));
          yield makeStep(id, {
            eliminations,
            units: [...baseLines.map(base), ...positions.map(cover)],
            cells,
            digits: [d],
            text: `In ${baseWord} ${list(baseLines.map((l) => l + 1))}, the ${d} can only go in ${coverWord} ${list(positions.map((p) => p + 1))} (${label}). Each of those ${baseWord} needs its ${d} in one of those ${coverWord}, so together they supply the ${d} for all ${k} ${coverWord}: ${removals(eliminations)}.`,
          });
        }
      }
    }
  };
}

// ---------------------------------------------------------------- single-digit patterns

// Rows (or columns) in which digit d has exactly two places: [[line, [a, b]], ...].
function strongLinks(g, d, unitOf) {
  const links = [];
  for (let l = 0; l < 9; l++) {
    const places = placesFor(g, unitOf(l), d);
    if (places.length === 2) links.push([l, places]);
  }
  return links;
}

const seenByBoth = (g, d, a, b) =>
  [...Array(SIZE).keys()].filter((i) => i !== a && i !== b && g.has(i, d) && sees(i, a) && sees(i, b)).map((i) => [i, d]);

function* skyscraper(g) {
  for (const byRows of [true, false]) {
    const lineOf = byRows ? col : row;
    const [lineWord, crossWord] = byRows ? ['rows', 'column'] : ['columns', 'row'];
    for (let d = 1; d <= 9; d++) {
      for (const [[l1, a], [l2, b]] of combinations(strongLinks(g, d, byRows ? ROW : COL), 2)) {
        for (let ia = 0; ia < 2; ia++) {
          for (let ib = 0; ib < 2; ib++) {
            if (lineOf(a[ia]) !== lineOf(b[ib]) || lineOf(a[1 - ia]) === lineOf(b[1 - ib])) continue;
            const [t1, t2] = [a[1 - ia], b[1 - ib]];
            const eliminations = seenByBoth(g, d, t1, t2);
            if (!eliminations.length) continue;
            yield makeStep('skyscraper', {
              eliminations,
              units: [byRows ? ROW(l1) : COL(l1), byRows ? ROW(l2) : COL(l2)],
              cells: [a[ia], b[ib], t1, t2],
              digits: [d],
              text: `In ${lineWord} ${l1 + 1} and ${l2 + 1}, the ${d} has exactly two places each, and ${cellName(a[ia])} and ${cellName(b[ib])} line up in ${crossWord} ${lineOf(a[ia]) + 1}. Those two can't both be ${d}, so at least one of the other ends, ${cellName(t1)} or ${cellName(t2)}, is ${d}. Any cell that sees both can't be ${d}: ${removals(eliminations)}.`,
            });
          }
        }
      }
    }
  }
}

function* twoStringKite(g) {
  for (let d = 1; d <= 9; d++) {
    const rowLinks = strongLinks(g, d, ROW);
    const colLinks = strongLinks(g, d, COL);
    for (const [r, p] of rowLinks) {
      for (const [c, q] of colLinks) {
        if (new Set([...p, ...q]).size !== 4) continue;
        for (let ip = 0; ip < 2; ip++) {
          for (let iq = 0; iq < 2; iq++) {
            if (box(p[ip]) !== box(q[iq])) continue;
            const [e1, e2] = [p[1 - ip], q[1 - iq]];
            const eliminations = seenByBoth(g, d, e1, e2);
            if (!eliminations.length) continue;
            yield makeStep('2-string-kite', {
              eliminations,
              units: [ROW(r), COL(c)],
              cells: [p[ip], q[iq], e1, e2],
              digits: [d],
              text: `Row ${r + 1} has the ${d} in exactly two places (${list(p.map(cellName))}), and so does column ${c + 1} (${list(q.map(cellName))}). ${cellName(p[ip])} and ${cellName(q[iq])} share box ${box(p[ip]) + 1}, so at most one of them is ${d}, which means ${cellName(e1)} or ${cellName(e2)} is ${d}. Any cell that sees both can't be ${d}: ${removals(eliminations)}.`,
            });
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- wings

function* xyWing(g) {
  const bivalue = [...Array(SIZE).keys()].filter((i) => !g.board[i] && COUNT[g.cand[i]] === 2);
  for (const pivot of bivalue) {
    const [x, y] = digitsOf(g.cand[pivot]);
    const wings = bivalue.filter((i) => i !== pivot && sees(i, pivot) && COUNT[g.cand[i] & g.cand[pivot]] === 1);
    for (const a of wings) {
      if (!(g.cand[a] & (1 << x))) continue;
      const z = digitsOf(g.cand[a] & ~(1 << x))[0];
      if (z === y) continue;
      for (const b of wings) {
        if (b === a || g.cand[b] !== ((1 << y) | (1 << z))) continue;
        const eliminations = seenByBoth(g, z, a, b).filter(([i]) => i !== pivot);
        if (!eliminations.length) continue;
        yield makeStep('xy-wing', {
          eliminations,
          units: [],
          cells: [pivot, a, b],
          digits: [x, y, z],
          text: `${cellName(pivot)} is ${x} or ${y}. If it's ${x}, then ${cellName(a)} (${x} or ${z}) must be ${z}; if it's ${y}, then ${cellName(b)} (${y} or ${z}) must be ${z}. Either way one of them is ${z}, so any cell that sees both can't be ${z}: ${removals(eliminations)}.`,
        });
      }
    }
  }
}

function* xyzWing(g) {
  const bivalue = [...Array(SIZE).keys()].filter((i) => !g.board[i] && COUNT[g.cand[i]] === 2);
  for (let pivot = 0; pivot < SIZE; pivot++) {
    if (g.board[pivot] || COUNT[g.cand[pivot]] !== 3) continue;
    const wings = bivalue.filter((i) => sees(i, pivot) && (g.cand[i] & ~g.cand[pivot]) === 0);
    for (const [a, b] of combinations(wings, 2)) {
      const shared = g.cand[a] & g.cand[b];
      if (COUNT[shared] !== 1 || (g.cand[a] | g.cand[b]) !== g.cand[pivot]) continue;
      const [z] = digitsOf(shared);
      const eliminations = seenByBoth(g, z, a, b).filter(([i]) => i !== pivot && sees(i, pivot));
      if (!eliminations.length) continue;
      yield makeStep('xyz-wing', {
        eliminations,
        units: [],
        cells: [pivot, a, b],
        digits: digitsOf(g.cand[pivot]),
        text: `${cellName(pivot)} is ${list(digitsOf(g.cand[pivot]))}, and it sees ${cellName(a)} (${list(digitsOf(g.cand[a]))}) and ${cellName(b)} (${list(digitsOf(g.cand[b]))}). Whatever ${cellName(pivot)} turns out to be, one of the three cells is ${z}, so any cell that sees all three can't be ${z}: ${removals(eliminations)}.`,
      });
    }
  }
}

// ---------------------------------------------------------------- catalogue

export const TIERS = ['', 'Easy', 'Medium', 'Hard', 'Expert'];

// In the order the analyser tries them: easiest first.
export const TECHNIQUES = [
  { id: 'full-house', name: 'Full house', tier: 1, find: fullHouse,
    how: 'Look for a row, column or box with exactly one empty cell. It gets the one digit that unit is missing.' },
  { id: 'hidden-single', name: 'Hidden single', tier: 1, find: hiddenSingle,
    how: 'Pick a box, row or column and a digit it still needs. Rule out every cell that already sees that digit. If only one cell is left, the digit goes there.' },
  { id: 'naked-single', name: 'Naked single', tier: 1, find: nakedSingle,
    how: 'Find a cell with a single candidate left. Every other digit is already in its row, column or box, so that candidate is the answer.' },
  { id: 'pointing', name: 'Pointing', tier: 2, find: pointing,
    how: "In a box, find a digit whose candidates all lie on one row or column. The box's copy of that digit will be on that line, so remove the digit from the rest of the line outside the box." },
  { id: 'claiming', name: 'Claiming', tier: 2, find: claiming,
    how: "In a row or column, find a digit whose candidates all lie inside one box. The line's copy of that digit will be in that box, so remove the digit from the rest of the box." },
  { id: 'naked-pair', name: 'Naked pair', tier: 2, find: nakedSubset(2),
    how: 'Find two cells in the same unit with the same two candidates. Those two digits must go in those two cells, so remove them from every other cell in the unit.' },
  { id: 'hidden-pair', name: 'Hidden pair', tier: 2, find: hiddenSubset(2),
    how: 'Find two digits that, within a unit, fit only in the same two cells. Those cells must hold exactly those digits, so remove every other candidate from them.' },
  { id: 'naked-triple', name: 'Naked triple', tier: 3, find: nakedSubset(3),
    how: 'Find three cells in a unit whose candidates, taken together, are only three digits. Remove those digits from the rest of the unit. Not every cell needs all three digits.' },
  { id: 'hidden-triple', name: 'Hidden triple', tier: 3, find: hiddenSubset(3),
    how: 'Find three digits that, within a unit, fit only in the same three cells. Remove every other candidate from those cells.' },
  { id: 'x-wing', name: 'X-wing', tier: 3, find: fish(2),
    how: 'Pick a digit. Find two rows where it fits in only the same two columns. The digit takes one corner in each row, covering both columns, so remove it from the rest of those columns. The same works with rows and columns swapped.' },
  { id: 'swordfish', name: 'Swordfish', tier: 3, find: fish(3),
    how: 'An X-wing with three rows: a digit fits in three rows only within the same three columns. Remove the digit from the rest of those columns, or rows if the pattern is the other way round.' },
  { id: 'skyscraper', name: 'Skyscraper', tier: 4, find: skyscraper,
    how: 'Pick a digit. Find two rows (or columns) where it has exactly two places, with one place from each lined up. One of the two unaligned ends must hold the digit, so remove it from every cell that sees both ends.' },
  { id: '2-string-kite', name: '2-string kite', tier: 4, find: twoStringKite,
    how: 'Pick a digit with exactly two places in a row and exactly two in a column, where one end of each sits in the same box. One of the two far ends must hold the digit, so remove it from cells that see both far ends.' },
  { id: 'xy-wing', name: 'XY-wing', tier: 4, find: xyWing,
    how: 'Find a two-candidate cell {x,y} (the pivot) that sees a cell {x,z} and a cell {y,z}. Whichever way the pivot goes, one of those two cells becomes z, so remove z from cells that see both of them.' },
  { id: 'xyz-wing', name: 'XYZ-wing', tier: 4, find: xyzWing,
    how: 'Like an XY-wing, but the pivot has three candidates {x,y,z}. Only cells that see the pivot and both wings lose z.' },
  { id: 'naked-quad', name: 'Naked quad', tier: 4, find: nakedSubset(4),
    how: 'Four cells in a unit whose candidates together are only four digits. Remove those digits from the rest of the unit.' },
  { id: 'hidden-quad', name: 'Hidden quad', tier: 4, find: hiddenSubset(4),
    how: 'Four digits that, within a unit, fit only in the same four cells. Remove every other candidate from those cells.' },
  { id: 'jellyfish', name: 'Jellyfish', tier: 4, find: fish(4),
    how: 'The four-row version of the X-wing: a digit fits in four rows only within the same four columns.' },
];

export const TECHNIQUE = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));

// The easiest step available, or null.
export function nextStep(grid) {
  for (const t of TECHNIQUES) {
    const step = t.find(grid).next().value;
    if (step) return step;
  }
  return null;
}

export function applyStep(grid, step) {
  for (const [i, d] of step.placements) grid.place(i, d);
  for (const [i, d] of step.eliminations) grid.remove(i, d);
}

// Move: { type: 'place' | 'remove', cell, digit }.
export function stepIncludes(step, move) {
  const list = move.type === 'place' ? step.placements : step.eliminations;
  return list.some(([i, d]) => i === move.cell && d === move.digit);
}

export function stepDone(grid, step) {
  return (
    step.placements.every(([i, d]) => grid.board[i] === d) &&
    step.eliminations.every(([i, d]) => grid.board[i] !== 0 || !(grid.cand[i] & (1 << d)))
  );
}

// The easiest technique step that justifies a move the user made, or null.
export function explainMove(grid, move) {
  for (const t of TECHNIQUES) for (const step of t.find(grid)) if (stepIncludes(step, move)) return step;
  return null;
}
