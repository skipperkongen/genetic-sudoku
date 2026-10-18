// Timeline chart: one row per technique used (easiest at the top), one dot per step with
// time running left to right, and a count bar per row on the right.

import { TECHNIQUES, TIERS } from './techniques.js';

const SVG = 'http://www.w3.org/2000/svg';
const ROW_H = 26;
const PAD = 10;

export const OWN = { id: 'own', name: 'Own move', tier: 0 };

function el(name, attrs, parent) {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}

// entries: [{ technique, actor: 'you' | 'auto', mistake }]
export function renderTimeline(container, entries, { selected = -1, onHover, onLeave, onSelect } = {}) {
  container.replaceChildren();
  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Steps appear here as the puzzle is solved.';
    container.appendChild(p);
    return;
  }

  const used = new Set(entries.map((e) => e.technique));
  const rows = TECHNIQUES.filter((t) => used.has(t.id));
  if (used.has(OWN.id)) rows.push(OWN);
  const rowOf = new Map(rows.map((t, i) => [t.id, i]));
  const counts = rows.map((t) => entries.filter((e) => e.technique === t.id).length);
  const maxCount = Math.max(...counts);

  const width = Math.max(320, container.clientWidth);
  const labelW = width < 560 ? 108 : 150;
  const barW = width < 560 ? 56 : 90;
  const plotX = labelW + PAD;
  const plotW = width - plotX - barW - PAD;
  const height = rows.length * ROW_H + PAD * 2;
  const slot = plotW / entries.length;
  const r = Math.max(4, Math.min(5.5, slot * 0.42));
  const x = (i) => plotX + slot * (i + 0.5);
  const y = (row) => PAD + row * ROW_H + ROW_H / 2;

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Timeline of techniques used, step by step' }, container);

  rows.forEach((t, row) => {
    if (row % 2 === 1) el('rect', { class: 'row-band', x: 0, y: PAD + row * ROW_H, width, height: ROW_H }, svg);
    // A rule between tiers, so the difficulty bands read at a glance.
    if (row > 0 && rows[row - 1].tier !== t.tier) el('line', { class: 'grid', x1: 0, x2: width, y1: PAD + row * ROW_H, y2: PAD + row * ROW_H }, svg);
    const label = el('text', { x: PAD, y: y(row) + 4 }, svg);
    label.textContent = t.name;
    const title = el('title', {}, label);
    title.textContent = t.tier ? `${t.name} (${TIERS[t.tier]})` : 'A move no implemented technique explains';

    const bx = width - barW;
    const len = Math.max(4, ((barW - 34) * counts[row]) / maxCount);
    el('rect', { class: 'bar', x: bx, y: y(row) - 5, width: len, height: 10, rx: 4 }, svg);
    const count = el('text', { x: bx + len + 6, y: y(row) + 4, class: 'muted' }, svg);
    count.textContent = counts[row];
  });

  entries.forEach((e, i) => {
    const cx = x(i);
    const cy = y(rowOf.get(e.technique));
    if (e.mistake) {
      const s = r * 0.9;
      el('path', { class: 'mistake', d: `M${cx - s},${cy - s}L${cx + s},${cy + s}M${cx + s},${cy - s}L${cx - s},${cy + s}` }, svg);
    } else {
      el('circle', { class: e.actor === 'you' ? 'd-you' : 'd-auto', cx, cy, r }, svg);
    }
    if (i === selected) el('circle', { class: 'ring', cx, cy, r: r + 3.5 }, svg);
  });

  // Hit targets larger than the marks, on top.
  entries.forEach((e, i) => {
    const hit = el('rect', {
      class: 'hit',
      x: x(i) - Math.max(slot, 10) / 2,
      y: y(rowOf.get(e.technique)) - ROW_H / 2,
      width: Math.max(slot, 10),
      height: ROW_H,
    }, svg);
    hit.addEventListener('pointerenter', (ev) => onHover?.(i, ev.clientX, ev.clientY));
    hit.addEventListener('pointermove', (ev) => onHover?.(i, ev.clientX, ev.clientY));
    hit.addEventListener('pointerleave', () => onLeave?.());
    hit.addEventListener('click', () => onSelect?.(i));
  });
}
