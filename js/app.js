// The technique trainer: analyse the board, explain the next technique, and let the user
// (Manual) or the app (Auto) apply it. Every step lands on a timeline.

import { SIZE, UNITS, PEERS } from './sudoku.js';
import {
  Grid, TECHNIQUES, TECHNIQUE, TIERS, CELL_UNITS,
  nextStep, applyStep, stepIncludes, stepDone, explainMove, cellName, unitName,
} from './techniques.js';
import { renderTimeline, OWN } from './timeline.js';

const $ = (id) => document.getElementById(id);
const boardEl = $('board');

const state = {
  level: 'easy',
  puzzle: null,
  solution: null,
  grid: null,
  mode: 'manual',
  input: 'place',
  selected: -1,
  history: [], // undo stack
  entries: [], // timeline
  step: null, // the analyser's next step for the current grid
  problem: null, // { text, cells, units } when the grid can't be finished
  hint: 0, // manual: 0 nothing shown, 1 technique and where to look, 2 full explanation
  active: null, // manual: a step the user has started applying { step, mistake, hinted }
  showing: false, // auto: the next step is displayed but not yet applied
  playing: false,
  timer: 0,
  inspect: -1, // timeline entry being viewed
  hintsUsed: 0,
  startedAt: 0,
  solvedAt: 0,
  loading: false,
};

// ---------------------------------------------------------------- puzzle lifecycle

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let request = 0;
worker.onmessage = ({ data }) => {
  if (data.id === request) startPuzzle(data.puzzle, data.solution);
};

function newPuzzle() {
  pause();
  state.level = $('level').value;
  state.loading = true;
  worker.postMessage({ id: ++request, level: state.level });
  say(`Generating ${article(state.level)} ${state.level} puzzle…`);
  render();
}

function startPuzzle(puzzle, solution) {
  Object.assign(state, {
    puzzle, solution,
    grid: Grid.fromPuzzle(puzzle),
    selected: -1, history: [], entries: [], hint: 0, active: null, showing: false,
    inspect: -1, hintsUsed: 0, startedAt: 0, solvedAt: 0, loading: false,
  });
  analyse();
  say('');
  render();
}

function analyse() {
  const g = state.grid;
  state.hint = 0;
  state.showing = false;
  state.problem = g.contradiction();
  state.step = state.problem || g.isSolved() ? null : nextStep(g);
  if (!state.step && !state.problem && !g.isSolved()) {
    state.problem = { cells: [], units: [], text: 'None of the techniques in this demo applies. That only happens after a wrong digit or a wrongly removed candidate.' };
  }
  if (g.isSolved() && !state.solvedAt) state.solvedAt = performance.now();
}

// ---------------------------------------------------------------- history and timeline

function snapshot() {
  return { board: state.grid.board.slice(), cand: state.grid.cand.slice() };
}

function pushHistory() {
  state.history.push({ ...snapshot(), entries: state.entries.length, active: state.active, hintsUsed: state.hintsUsed });
}

function undo() {
  const h = state.history.pop();
  if (!h) return;
  restore(h);
}

function restore(h) {
  pause();
  state.grid = new Grid(h.board.slice(), h.cand.slice());
  state.entries.length = h.entries;
  state.active = h.active;
  state.hintsUsed = h.hintsUsed;
  state.inspect = -1;
  state.solvedAt = 0;
  analyse();
  say('');
  render();
}

// Undo back to just before the first step that went against the solution.
function undoToFirstMistake() {
  const first = state.entries.findIndex((e) => e.mistake);
  const at = state.history.findIndex((h) => h.entries >= first && first >= 0);
  if (at < 0) return undo();
  const h = state.history[at];
  state.history.length = at;
  restore(h);
}

function record(entry) {
  state.entries.push({ ...entry, ...snapshot() });
}

// ---------------------------------------------------------------- moves

const isMistake = (move) =>
  move.type === 'place' ? state.solution[move.cell] !== move.digit : state.solution[move.cell] === move.digit;

function applyMove(move) {
  if (move.type === 'place') state.grid.place(move.cell, move.digit);
  else state.grid.remove(move.cell, move.digit);
}

function userMove(move) {
  if (state.inspect >= 0 || state.loading || state.grid.isSolved()) return;
  const g = state.grid;
  const { cell, digit } = move;
  if (g.board[cell]) return say(state.puzzle[cell] ? 'That cell is a given.' : 'That cell is already filled. Use Undo to change it.', true);
  if (move.type === 'place') {
    const p = g.clash(cell, digit);
    if (p >= 0) {
      const shared = CELL_UNITS[cell].find((u) => UNITS[u].includes(p));
      return say(`Not allowed: ${unitName(shared)} already has ${digit === 8 ? 'an' : 'a'} ${digit} (${cellName(p)}).`, true);
    }
  } else {
    if (!g.has(cell, digit)) return say(`${digit} is not a candidate in ${cellName(cell)}.`, true);
    if ((g.cand[cell] & ~(1 << digit)) === 0) return say(`That's the last candidate in ${cellName(cell)}; place it instead.`, true);
  }

  if (!state.startedAt) state.startedAt = performance.now();
  pushHistory();
  const mistake = isMistake(move);
  const before = g.clone();

  if (state.active && stepIncludes(state.active.step, move)) {
    applyMove(move);
    state.active.mistake ||= mistake;
  } else {
    finishActive();
    const justified = state.step && stepIncludes(state.step, move) ? state.step : explainMove(before, move);
    applyMove(move);
    if (justified) {
      const hinted = justified === state.step && state.hint > 0;
      state.active = { step: justified, mistake, hinted };
    } else {
      const changes = [[move.cell, move.digit]];
      const step = { units: [], cells: [move.cell], digits: [move.digit], placements: move.type === 'place' ? changes : [], eliminations: move.type === 'remove' ? changes : [] };
      record({ technique: OWN.id, actor: 'you', mistake, step, text: describeOwn(move) });
    }
  }
  if (state.active && stepDone(g, state.active.step)) finishActive();
  if (!state.active) analyse();
  say('');
  render();
}

function finishActive() {
  const a = state.active;
  if (!a) return;
  record({ technique: a.step.technique, actor: 'you', mistake: a.mistake, step: a.step, text: a.step.text, hinted: a.hinted });
  state.active = null;
}

function describeOwn(move) {
  return move.type === 'place'
    ? `Placed ${move.digit} in ${cellName(move.cell)}. None of the techniques in this demo explains this move from the board as it was.`
    : `Removed ${move.digit} from ${cellName(move.cell)}. None of the techniques in this demo explains this removal from the board as it was.`;
}

// Apply the analyser's step (or finish the user's started one) on the user's behalf.
function doStep() {
  if (state.inspect >= 0) return;
  const step = state.active?.step ?? state.step;
  if (!step) return;
  if (!state.startedAt) state.startedAt = performance.now();
  pushHistory();
  applyStep(state.grid, step);
  state.active = null;
  // Only the user's own moves count as mistakes. A correct deduction on a board that an
  // earlier mistake already broke is not one.
  record({ technique: step.technique, actor: 'auto', mistake: false, step, text: step.text });
  analyse();
}

// ---------------------------------------------------------------- auto mode

const delay = () => 2200 / Number($('speed').value);

function play() {
  if (!state.step) return;
  state.playing = true;
  tick();
  render();
}

function pause() {
  state.playing = false;
  clearTimeout(state.timer);
}

// Show the next step, then apply it, then repeat.
function tick() {
  if (!state.playing) return;
  if (!state.step) return pause(), render();
  if (!state.showing) {
    state.showing = true;
    render();
    state.timer = setTimeout(tick, delay());
  } else {
    doStep();
    render();
    state.timer = setTimeout(tick, delay() * 0.4);
  }
}

function nextAuto() {
  if (state.playing || !state.step) return;
  if (!state.showing) state.showing = true;
  else doStep();
  render();
}

// ---------------------------------------------------------------- rendering

function say(text, error = false) {
  const m = $('message');
  m.textContent = text;
  m.classList.toggle('error', error);
}

const article = (word) => (/^[aeiou]/.test(word) ? 'an' : 'a');

// What the board should highlight right now: { step, level: 'focus' | 'full' | 'applied' }.
function highlight() {
  if (state.inspect >= 0) return { step: state.entries[state.inspect].step, level: 'applied' };
  if (state.active) return { step: state.active.step, level: 'full' };
  if (state.mode === 'auto' && state.showing && state.step) return { step: state.step, level: 'full' };
  if (state.mode === 'manual' && state.step && state.hint) return { step: state.step, level: state.hint === 1 ? 'focus' : 'full' };
  return null;
}

function renderBoard() {
  const view = state.inspect >= 0 ? state.entries[state.inspect] : state.grid;
  const { board, cand } = view;
  const h = highlight();
  const focus = new Set((h?.step.units ?? []).flatMap((u) => UNITS[u]));
  const pattern = new Set(h && h.level !== 'focus' ? h.step.cells : []);
  const digits = new Set(h && h.level !== 'focus' ? h.step.digits : []);
  const place = new Map(h && h.level !== 'focus' ? h.step.placements.map(([i, d]) => [i, d]) : []);
  const elim = new Set(h && h.level !== 'focus' ? h.step.eliminations.map(([i, d]) => i * 10 + d) : []);
  const problemCells = new Set(state.inspect < 0 && state.problem ? [...state.problem.cells, ...state.problem.units.flatMap((u) => UNITS[u])] : []);
  const peers = new Set(state.selected >= 0 && state.inspect < 0 ? PEERS[state.selected] : []);

  for (let i = 0; i < SIZE; i++) {
    const cell = boardEl.children[i];
    const cls = ['cell'];
    if (state.puzzle?.[i]) cls.push('given');
    if (peers.has(i)) cls.push('peer');
    if (focus.has(i)) cls.push('focus');
    if (pattern.has(i)) cls.push('pattern');
    if (place.has(i)) cls.push('target');
    if (problemCells.has(i)) cls.push('problem');
    if (i === state.selected && state.inspect < 0) cls.push('selected');
    cell.className = cls.join(' ');

    if (board[i]) {
      cell.innerHTML = `<span class="value">${board[i]}</span>`;
      continue;
    }
    let html = '<div class="cands">';
    for (let d = 1; d <= 9; d++) {
      const present = (cand[i] & (1 << d)) !== 0;
      let c = '';
      if (place.get(i) === d) c = 'place';
      else if (elim.has(i * 10 + d)) c = present ? 'elim' : 'gone';
      else if (present && pattern.has(i) && digits.has(d)) c = 'pat';
      const show = present || c === 'gone';
      html += `<span class="${c}" data-d="${d}">${show ? d : ''}</span>`;
    }
    cell.innerHTML = html + '</div>';
  }
}

function renderCard() {
  const card = $('step-card');
  const g = state.grid;
  const manual = state.mode === 'manual';
  let title = 'Next step';
  let tier = '';
  let how = '';
  let text = '';
  card.className = 'card';

  if (state.loading && !g) {
    title = 'Generating puzzle…';
  } else if (state.inspect >= 0) {
    const e = state.entries[state.inspect];
    const t = TECHNIQUE[e.technique] ?? OWN;
    title = `Step ${state.inspect + 1}: ${t.name}`;
    tier = TIERS[t.tier] ?? '';
    text = e.text + (e.mistake ? ' This move went against the solution.' : '');
  } else if (g.isSolved()) {
    card.className = 'card solved';
    title = 'Solved!';
    const mistakes = state.entries.filter((e) => e.mistake).length;
    text = `${state.entries.length} steps${mistakes ? `, ${mistakes} with mistakes` : ''}. The timeline below shows which technique did what.`;
  } else if (state.problem) {
    card.className = 'card problem';
    title = 'The board has a problem';
    text = `${state.problem.text} Something earlier was wrong; undo to fix it.`;
  } else if (state.active) {
    const s = state.active.step;
    const t = TECHNIQUE[s.technique];
    const total = s.placements.length + s.eliminations.length;
    const left = s.placements.filter(([i, d]) => g.board[i] !== d).length +
      s.eliminations.filter(([i, d]) => !g.board[i] && g.cand[i] & (1 << d)).length;
    title = `Applying: ${t.name}`;
    tier = TIERS[t.tier];
    text = `${s.text} (${total - left} of ${total} changes done.)`;
  } else if (manual) {
    const t = TECHNIQUE[state.step.technique];
    if (state.hint === 0) {
      text = 'Find the next move yourself, or ask for a hint.';
    } else {
      title = t.name;
      tier = TIERS[t.tier];
      how = t.how;
      text = state.hint === 2 ? state.step.text : 'The highlighted area is where to look.';
    }
  } else {
    const t = TECHNIQUE[state.step.technique];
    if (state.showing) {
      title = t.name;
      tier = TIERS[t.tier];
      how = t.how;
      text = state.step.text;
    } else {
      const last = state.entries.at(-1);
      text = last ? `Last: ${(TECHNIQUE[last.technique] ?? OWN).name}. ${last.text}` : 'Press Play to watch the puzzle solved step by step, or Show next step to go one step at a time.';
    }
  }

  $('step-title').textContent = title;
  $('step-tier').textContent = tier;
  $('step-tier').hidden = !tier;
  $('step-how').textContent = how;
  $('step-how').hidden = !how;
  $('step-text').textContent = text;

  const live = !!g && state.inspect < 0 && !g.isSolved() && !state.problem;
  $('manual-actions').hidden = !(live && manual);
  $('auto-actions').hidden = !(live && !manual);
  $('problem-actions').hidden = !(state.problem && state.inspect < 0);
  $('undo-mistake').hidden = !state.entries.some((e) => e.mistake);
  $('hint').disabled = !!state.active || state.hint >= 1;
  $('show').disabled = !!state.active || state.hint >= 2;
  $('play').textContent = state.playing ? 'Pause' : 'Play';
  $('next').textContent = state.showing ? 'Apply' : 'Show next step';
  $('next').disabled = state.playing;
}

function renderInput() {
  const g = state.grid;
  $('input').hidden = state.mode !== 'manual';
  $('input').classList.toggle('removing', state.input === 'remove');
  for (const b of document.querySelectorAll('[data-input]')) b.setAttribute('aria-checked', String(b.dataset.input === state.input));
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-checked', String(b.dataset.mode === state.mode));
  const keys = $('keypad').children;
  for (let d = 1; d <= 9; d++) {
    const left = g ? 9 - g.board.filter((x) => x === d).length : 9;
    keys[d - 1].querySelector('small').textContent = left ? `${left} left` : 'done';
    keys[d - 1].disabled = state.input === 'place' && left === 0;
  }
  $('undo').disabled = !state.history.length;
}

function renderInspectBar() {
  const bar = $('inspect-bar');
  bar.hidden = state.inspect < 0;
  if (state.inspect < 0) return;
  $('inspect-label').textContent = `Viewing step ${state.inspect + 1} of ${state.entries.length}`;
  $('inspect-prev').disabled = state.inspect === 0;
  $('inspect-next').disabled = state.inspect === state.entries.length - 1;
}

function formatTime(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function renderStats() {
  const es = state.entries;
  const singles = es.filter((e) => TECHNIQUE[e.technique]?.tier === 1).length;
  const hardest = es.reduce((best, e) => {
    const t = TECHNIQUE[e.technique];
    return t && (!best || t.tier > best.tier || (t.tier === best.tier && TECHNIQUES.indexOf(t) > TECHNIQUES.indexOf(best))) ? t : best;
  }, null);
  const stats = [
    ['Steps', es.length],
    ['Hardest technique', hardest ? hardest.name : '–'],
    ['Done with singles', es.length ? `${Math.round((100 * singles) / es.length)}%` : '–'],
    ['Mistakes', es.filter((e) => e.mistake).length],
    ['Hints used', state.hintsUsed],
    ['Time', state.startedAt ? formatTime((state.solvedAt || performance.now()) - state.startedAt) : '–'],
  ];
  $('stats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

function renderTimelineSection() {
  renderTimeline($('timeline'), state.entries, {
    selected: state.inspect,
    onHover: showTooltip,
    onLeave: () => ($('tooltip').hidden = true),
    onSelect: (i) => {
      pause();
      state.inspect = i;
      render();
    },
  });
  $('timeline-table').innerHTML = state.entries
    .map((e, i) => {
      const t = TECHNIQUE[e.technique] ?? OWN;
      const by = e.actor === 'you' ? (e.hinted ? 'You (after a hint)' : 'You') : 'Auto';
      return `<tr><td>${i + 1}</td><td>${t.name}</td><td>${by}</td><td>${e.mistake ? 'Mistake' : ''}</td></tr>`;
    })
    .join('');
}

function showTooltip(i, x, y) {
  const e = state.entries[i];
  const t = TECHNIQUE[e.technique] ?? OWN;
  const tip = $('tooltip');
  const by = e.actor === 'you' ? 'You' : 'Auto';
  tip.innerHTML = `<strong>Step ${i + 1} · ${t.name} · ${by}${e.mistake ? ' · mistake' : ''}</strong>`;
  const p = document.createElement('span');
  p.textContent = e.text;
  tip.appendChild(p);
  tip.hidden = false;
  const w = tip.offsetWidth;
  tip.style.left = `${Math.min(window.innerWidth - w - 8, x + 12)}px`;
  tip.style.top = `${y + 14}px`;
}

function render() {
  if (!state.grid) {
    renderCard();
    return;
  }
  renderBoard();
  renderCard();
  renderInput();
  renderInspectBar();
  renderStats();
  renderTimelineSection();
}

// ---------------------------------------------------------------- setup

function buildBoard() {
  for (let i = 0; i < SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.dataset.i = i;
    boardEl.appendChild(cell);
  }
  for (const [sel, n] of [['.col-labels', 9], ['.row-labels', 9]]) {
    document.querySelector(sel).innerHTML = Array.from({ length: n }, (_, k) => `<span>${k + 1}</span>`).join('');
  }
  boardEl.addEventListener('click', (ev) => {
    const cell = ev.target.closest('.cell');
    if (!cell || state.inspect >= 0) return;
    const i = Number(cell.dataset.i);
    // In Candidate mode, clicking a small digit removes it directly.
    const d = Number(ev.target.dataset?.d);
    if (state.mode === 'manual' && state.input === 'remove' && d && ev.target.textContent) {
      state.selected = i;
      userMove({ type: 'remove', cell: i, digit: d });
      return;
    }
    state.selected = i;
    render();
  });

  $('keypad').innerHTML = Array.from({ length: 9 }, (_, k) => `<button data-digit="${k + 1}">${k + 1}<small></small></button>`).join('');
  $('keypad').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-digit]');
    if (!b) return;
    if (state.selected < 0) return say('Select a cell first.', true);
    userMove({ type: state.input, cell: state.selected, digit: Number(b.dataset.digit) });
  });

  $('reference').innerHTML = TECHNIQUES.map(
    (t) => `<article><h3>${t.name}<span class="tier">${TIERS[t.tier]}</span></h3><p>${t.how}</p></article>`,
  ).join('');
}

function setMode(mode) {
  pause();
  state.mode = mode;
  state.showing = false;
  state.hint = 0;
  render();
}

function moveSelection(dr, dc) {
  const i = state.selected < 0 ? 40 : state.selected;
  const r = (Math.floor(i / 9) + dr + 9) % 9;
  const c = ((i % 9) + dc + 9) % 9;
  state.selected = r * 9 + c;
  render();
}

function bind() {
  $('new').addEventListener('click', newPuzzle);
  $('level').addEventListener('change', newPuzzle);
  for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  for (const b of document.querySelectorAll('[data-input]')) b.addEventListener('click', () => ((state.input = b.dataset.input), render()));
  $('hint').addEventListener('click', () => {
    state.hint = 1;
    state.hintsUsed++;
    render();
  });
  $('show').addEventListener('click', () => {
    if (state.hint === 0) state.hintsUsed++;
    state.hint = 2;
    render();
  });
  $('do').addEventListener('click', () => {
    doStep();
    render();
  });
  $('play').addEventListener('click', () => (state.playing ? (pause(), render()) : play()));
  $('next').addEventListener('click', nextAuto);
  $('undo').addEventListener('click', undo);
  $('undo-mistake').addEventListener('click', undoToFirstMistake);
  $('inspect-prev').addEventListener('click', () => ((state.inspect = Math.max(0, state.inspect - 1)), render()));
  $('inspect-next').addEventListener('click', () => ((state.inspect = Math.min(state.entries.length - 1, state.inspect + 1)), render()));
  $('inspect-close').addEventListener('click', () => ((state.inspect = -1), render()));

  document.addEventListener('keydown', (ev) => {
    if (ev.target.closest('input, select, textarea')) return;
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'z') {
      ev.preventDefault();
      return undo();
    }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (state.inspect >= 0) {
      if (ev.key === 'ArrowLeft') $('inspect-prev').click();
      else if (ev.key === 'ArrowRight') $('inspect-next').click();
      else if (ev.key === 'Escape') $('inspect-close').click();
      return;
    }
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[ev.key]) {
      ev.preventDefault();
      return moveSelection(...arrows[ev.key]);
    }
    if (ev.key === 'n' || ev.key === 'N') {
      state.input = state.input === 'place' ? 'remove' : 'place';
      return render();
    }
    const m = /^Digit([1-9])$|^Numpad([1-9])$/.exec(ev.code);
    if (m && state.mode === 'manual' && state.selected >= 0) {
      const digit = Number(m[1] ?? m[2]);
      userMove({ type: ev.shiftKey || state.input === 'remove' ? 'remove' : 'place', cell: state.selected, digit });
    }
  });

  new ResizeObserver(() => state.grid && renderTimelineSection()).observe($('timeline'));
  // Keep the timer ticking while a manual solve is in progress.
  setInterval(() => state.startedAt && !state.solvedAt && renderStats(), 1000);
}

buildBoard();
bind();
newPuzzle();
