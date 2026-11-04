/**
 * "Retail onboarding, step by step": an animated BPMN strip of the Retail onboarding workflow
 * (kyc_retail) for a workspace Custom component. Two cases play in turn: a clean file onboarded by
 * the operator, then a medium-risk one that goes to a senior (four eyes) before it is approved.
 *
 * The template and the style are built here from one geometry and one timeline, so the token and
 * the boxes that light up stay in step. Flat on purpose (944 × 424 px: 47 × 21 grid cells) so it
 * sits on a desk without eating its height. Generated (through hub.js) as
 * hub/kyc-flow.hbs, kyc-flow.js (kyc-flow/component.js) and kyc-flow.css.
 */
const fs = require('fs');
const path = require('path');

const { COMPONENTS } = require('../paths');

// The stage, the pool, the main row and the senior row (y of their centre line).
const W = 944;
const H = 424;
const POOL = { x: 24, y: 56, w: 896, h: 318 };
const ROW = 190;
const LANE_SPLIT = 284;
const SENIOR = 328;

// The operator's steps on the main row: x of the box, its width, title, tag and why.
const TASKS = {
  T1: {
    x: 130,
    w: 96,
    title: 'Check file',
    tag: 'papers · data',
    why: 'Know who applies<br>papers under<br>3 months old',
  },
  T2: {
    x: 290,
    w: 96,
    title: 'Verify ID',
    tag: 'Onfido · live',
    why: 'The ID is real<br>and the selfie<br>matches it',
  },
  T3: {
    x: 450,
    w: 96,
    title: 'Screen',
    tag: 'watchlists',
    why: 'AML law: nobody<br>on a sanctions<br>or PEP list',
  },
  T4: {
    x: 610,
    w: 96,
    title: 'Rate the risk',
    tag: 'pick L · M · H',
    why: 'Risk-based<br>approach: funds<br>vs income',
  },
  T5: { x: 770, w: 100, title: 'Approve KYC', tag: 'low risk' },
};
// The question after each check (centre x) and where its "no" goes, on a pill above the row.
const GATES = {
  G1: {
    c: 258,
    exit: 'Missing',
    pill: 'Ask documents',
    tag: 'pre-filled',
    end: 'Waiting on client',
  },
  G2: {
    c: 418,
    exit: 'Not valid',
    pill: 'Ask a new ID',
    tag: 'with the reason',
    end: 'Waiting on client',
  },
  G3: {
    c: 578,
    exit: 'Open hit',
    pill: 'Park the case',
    tag: 'out of the queue',
    end: 'Screening team',
  },
  G4: { c: 738 },
};
const START = 78;
const SENIOR_TASK = { x: 690, w: 100 };
const G5 = 826;
const END = 894;

// ---- the timeline: where the token is, and which box it lights ----------------------------------

const MOVE = 0.35;
const DWELL = 1.5;
const at = (x, y, dwell = 0, el = null, move = MOVE) => ({ x, y, dwell, el, move });
const checks = ['T1', 'G1', 'T2', 'G2', 'T3', 'G3', 'T4', 'G4'].map(id =>
  id.startsWith('T')
    ? at(TASKS[id].x + TASKS[id].w / 2, ROW, DWELL, id, 0.45)
    : at(GATES[id].c, ROW, 0.45, id),
);
const begin = at(START, ROW, 0.6, 'S0', 0);
const RUNS = [
  {
    label: '▶ A clean file · the operator approves',
    stops: [begin, ...checks, at(820, ROW, DWELL, 'T5'), at(END, ROW, 0.7, 'E1')],
  },
  {
    label: '▶ A medium risk · a senior signs off',
    stops: [
      begin,
      ...checks,
      at(740, SENIOR, 1.8, 'SR', 0.5),
      at(G5, SENIOR, 0.45, 'G5'),
      at(G5, ROW, DWELL, 'T5', 0.5),
      at(END, ROW, 0.7, 'E1'),
    ],
  },
];

/** Token frames, light windows per element, and each run's span, in seconds. */
function timeline() {
  const frames = [];
  const windows = {};
  const spans = [];
  let t = 0;
  RUNS.forEach(({ stops }) => {
    const start = t;
    stops.forEach((stop, i) => {
      t += i ? stop.move : 0;
      frames.push({ t, x: stop.x, y: stop.y, o: i ? 1 : 0 });

      if (!i) {
        t += 0.05;
        frames.push({ t, x: stop.x, y: stop.y, o: 1 });
      }

      if (stop.el) (windows[stop.el] = windows[stop.el] || []).push([t, t + stop.dwell]);

      if (stop.dwell) {
        t += stop.dwell;
        frames.push({ t, x: stop.x, y: stop.y, o: 1 });
      }
    });
    const last = stops[stops.length - 1];
    t += 0.3;
    frames.push({ t, x: last.x, y: last.y, o: 0 });
    spans.push([start, t]);
    t += 1;
  });

  return { frames, windows, spans, total: t };
}

// ---- the style ------------------------------------------------------------------------------

const pct = (t, total) => `${Math.min(100, Math.max(0, (t / total) * 100)).toFixed(2)}%`;

/** One keyframe set that holds `on` during each window and `off` around them. */
function lightFrames(name, list, total, on, off) {
  const steps = [`0% {${off}}`];
  list.forEach(([a, b]) => {
    steps.push(`${pct(Math.max(0, a - 0.15), total)} {${off}}`);
    steps.push(`${pct(a, total)}, ${pct(b, total)} {${on}}`);
    steps.push(`${pct(b + 0.25, total)} {${off}}`);
  });
  steps.push(`100% {${off}}`);

  return `@keyframes ${name} {\n  ${steps.join('\n  ')}\n}`;
}

const BOX_ON = 'background: var(--kf-tint); border-color: var(--kf-green)';
const BOX_OFF = 'background: var(--kf-white); border-color: var(--kf-black)';
const GATE_LIGHT = ['background: var(--kf-lime)', 'background: var(--kf-white)'];
const LIGHTS = {
  S0: ['background: var(--kf-lime)', 'background: var(--kf-white)'],
  T1: [BOX_ON, BOX_OFF],
  T2: [BOX_ON, BOX_OFF],
  T3: [BOX_ON, BOX_OFF],
  T4: [BOX_ON, BOX_OFF],
  T5: [BOX_ON, BOX_OFF],
  SR: [BOX_ON, BOX_OFF],
  G1: GATE_LIGHT,
  G2: GATE_LIGHT,
  G3: GATE_LIGHT,
  G4: GATE_LIGHT,
  G5: GATE_LIGHT,
  E1: ['background: var(--kf-green)', 'background: var(--kf-white)'],
};

function animationCss() {
  const { frames, windows, spans, total } = timeline();
  const token = frames
    .map(
      f => `${pct(f.t, total)} {transform: translate(${f.x - 7}px, ${f.y - 7}px); opacity: ${f.o}}`,
    )
    .join('\n  ');
  const lights = Object.entries(LIGHTS).map(([id, [on, off]]) =>
    lightFrames(`kf-l-${id}`, windows[id] || [], total, on, off),
  );
  // The why under a task turns green while its task is lit.
  const whys = Object.keys(TASKS)
    .filter(id => TASKS[id].why)
    .map(id =>
      lightFrames(
        `kf-w-${id}`,
        windows[id],
        total,
        'color: var(--kf-green)',
        'color: var(--kf-muted)',
      ),
    );
  const runs = spans.map((span, i) =>
    lightFrames(`kf-r-${i}`, [span], total, 'opacity: 1', 'opacity: 0'),
  );

  return [
    `.kf-wrap { --kf-T: ${total.toFixed(2)}s; }`,
    `@keyframes kf-token {\n  ${token}\n}`,
    ...lights,
    ...whys,
    ...runs,
  ].join('\n\n');
}

// ---- the template ---------------------------------------------------------------------------

const px = (key, value) => (value === undefined ? '' : `${key}:${value}px;`);
const el = (cls, { x, y, w, h, style = '' }, inner = '') =>
  `<div class="${cls}" style="${px('left', x)}${px('top', y)}${px('width', w)}${px(
    'height',
    h,
  )}${style}">${inner}</div>`;
const anim = name => `animation-name:${name};`;

// Flows: a line with an arrowhead at its end (right, down or up).
const right = (x1, x2, y) => el('kf-fl kf-ar', { x: x1, y: y - 1, w: x2 - x1 });
const down = (x, y1, y2) => el('kf-fl kf-vt kf-ar', { x: x - 1, y: y1, h: y2 - y1 });
const up = (x, y1, y2) => el('kf-fl kf-vt kf-up', { x: x - 1, y: y2, h: y1 - y2 });
const lbl = (x, y, text, color) =>
  el('kf-lbl', { x, y, style: color ? `color:var(--kf-${color});` : '' }, text);
const note = (x, y, text, style = '') => el('kf-note', { x, y, style }, text);
const rightAligned = 'transform:translateX(-100%);';

function task(id, { x, w }, y, title, tag, h = 56) {
  return el(
    'kf-task kf-a',
    { x, y, w, h, style: anim(`kf-l-${id}`) },
    `<b>${title}</b><em>${tag}</em>`,
  );
}

const gate = (id, c, y) =>
  el('kf-gw kf-a', { x: c - 14, y: y - 14, w: 28, h: 28, style: anim(`kf-l-${id}`) });

function operatorRow() {
  const parts = [
    note(54, ROW - 50, 'From the<br>inbox', 'color:var(--kf-sage);'),
    el('kf-ev kf-a', { x: START - 14, y: ROW - 14, w: 28, h: 28, style: anim('kf-l-S0') }),
    right(START + 14, TASKS.T1.x, ROW),
  ];
  const ids = ['T1', 'G1', 'T2', 'G2', 'T3', 'G3', 'T4', 'G4', 'T5'];
  ids.forEach((id, i) => {
    if (id.startsWith('T')) {
      const t = TASKS[id];
      parts.push(task(id, t, ROW - 28, t.title, t.tag));

      if (t.why) {
        parts.push(
          el('kf-why kf-a', { x: t.x, y: ROW + 40, style: anim(`kf-w-${id}`) }, `Why · ${t.why}`),
        );
      }

      const next = ids[i + 1];
      if (next) parts.push(right(t.x + t.w, GATES[next].c - 20, ROW));
    } else {
      const g = GATES[id];
      parts.push(gate(id, g.c, ROW));
      parts.push(right(g.c + 20, TASKS[ids[i + 1]].x, ROW));

      if (g.pill) {
        parts.push(up(g.c, ROW - 20, ROW - 56));
        parts.push(lbl(g.c + 6, ROW - 44, g.exit, 'muted'));
        parts.push(
          el(
            'kf-task kf-pill',
            { x: g.c - 52, y: ROW - 92, w: 104, h: 36 },
            `<b>${g.pill}</b><em>${g.tag}</em>`,
          ),
        );
        parts.push(up(g.c, ROW - 92, ROW - 100));
        parts.push(el('kf-ev kf-fin kf-wait', { x: g.c - 10, y: ROW - 120, w: 20, h: 20 }));
        parts.push(lbl(g.c + 16, ROW - 113, g.end, g.end === 'Screening team' ? 'clay' : 'sage'));
      }
    }
  });
  // Approved: the end event right of Approve KYC.
  parts.push(right(TASKS.T5.x + TASKS.T5.w, END - 12, ROW));
  parts.push(
    el('kf-ev kf-fin kf-ok kf-a', {
      x: END - 12,
      y: ROW - 12,
      w: 24,
      h: 24,
      style: anim('kf-l-E1'),
    }),
  );
  parts.push(lbl(830, ROW - 42, 'Onboarded', 'green'));

  return parts;
}

function seniorRow() {
  return [
    down(GATES.G4.c, ROW + 20, SENIOR - 27),
    lbl(GATES.G4.c + 8, ROW + 52, 'Not low', 'clay'),
    note(
      80,
      SENIOR - 14,
      'When the risk is not low, the case moves to a senior’s inbox:<br>' +
        'four eyes before the bank says yes.',
    ),
    task('SR', SENIOR_TASK, SENIOR - 27, 'Senior review', 'approves M · H', 54),
    right(SENIOR_TASK.x + SENIOR_TASK.w, G5 - 20, SENIOR),
    gate('G5', G5, SENIOR),
    up(G5, SENIOR - 20, ROW + 28),
    lbl(G5 + 8, ROW + 70, 'Approve', 'green'),
    right(G5 + 20, END - 11, SENIOR),
    el('kf-ev kf-fin kf-no', { x: END - 11, y: SENIOR - 11, w: 22, h: 22 }),
    lbl(856, SENIOR - 28, 'Rejected', 'clay'),
    note(800, SENIOR + 26, 'or proof of funds', 'color:var(--kf-sage);'),
  ];
}

function stage() {
  const { spans } = timeline();
  const bottom = POOL.y + POOL.h;

  return [
    el('kf-chip', { x: 24, y: 18 }, '<i></i>Workflow'),
    el('kf-h1', { x: 128, y: 18 }, 'Retail onboarding'),
    note(402, 26, 'Four checks · one decision'),
    ...spans.map((_, i) =>
      el(
        'kf-run kf-a',
        { x: POOL.x + POOL.w, y: 26, style: `${rightAligned}${anim(`kf-r-${i}`)}` },
        RUNS[i].label,
      ),
    ),
    el('kf-pool', POOL),
    el('kf-band', { x: POOL.x, y: POOL.y, w: 26, h: LANE_SPLIT - POOL.y }, '<span>Operator</span>'),
    el(
      'kf-band',
      { x: POOL.x, y: LANE_SPLIT + 1, w: 26, h: bottom - LANE_SPLIT - 1 },
      '<span>Senior</span>',
    ),
    el('kf-sep', { x: POOL.x + 26, y: LANE_SPLIT, w: POOL.w - 28 }),
    ...operatorRow(),
    ...seniorRow(),
    el('kf-tok kf-a', { x: 0, y: 0, style: anim('kf-token') }),
    // Legend.
    el('kf-tok kf-still', { x: 24, y: bottom + 14 }),
    note(44, bottom + 15, 'A KYC case'),
    el('kf-fl', { x: 126, y: bottom + 20, w: 26 }),
    note(160, bottom + 15, 'Next step'),
    el('kf-gw kf-still-gw', { x: 244, y: bottom + 13, w: 14, h: 14 }),
    note(268, bottom + 15, 'A decision'),
    el(
      'kf-hint',
      { x: POOL.x + POOL.w, y: bottom + 16, style: rightAligned },
      'Click to play / pause',
    ),
    el('kf-rule', { x: 24, y: H - 12, w: POOL.w, h: 3 }),
    el('kf-prog', { x: 24, y: H - 12, w: POOL.w, h: 3 }),
  ].join('\n    ');
}

function template() {
  return `<div class="kf-wrap" style={{this.wrapStyle}} {{on "click" this.toggle}}>
  <div class={{this.stageClass}} style={{this.stageStyle}}>
    ${stage()}
  </div>
</div>
`;
}

const DIR = path.join(COMPONENTS, 'kyc-flow');

function stylesheet() {
  const base = fs.readFileSync(path.join(DIR, 'style.css'), 'utf8');

  return `${base}\n/* Built by kyc-flow.js */\n.kf-wrap .kf-stage { width: ${W}px; height: ${H}px; }\n\n${animationCss()}\n`;
}

const FILES = {
  'kyc-flow.hbs': template,
  'kyc-flow.css': stylesheet,
  'kyc-flow.js': () =>
    fs
      .readFileSync(path.join(DIR, 'component.js'), 'utf8')
      .replace(
        /\/\* kyc-flow-stage \*\/[\s\S]*?\/\* \/kyc-flow-stage \*\//,
        JSON.stringify({ width: W, height: H }),
      ),
};

/** A served file by name, or null. Built on each request, so edits show on reload. */
function renderKycFlowFile(name) {
  return FILES[name] ? FILES[name]() : null;
}

module.exports = { STAGE: { width: W, height: H }, renderKycFlowFile, timeline };
