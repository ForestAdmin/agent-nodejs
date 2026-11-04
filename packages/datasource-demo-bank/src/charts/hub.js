/**
 * The Hub: the demo's landing workspace. One workspace Custom component (stored as type "smart"),
 * generated from components/hub/ at build time (scripts/build-public.js), plus one API chart,
 * `hub_counts`, that the component reads for its live counts.
 *
 * - hubContent(): the desks, their descriptions and the feature map, written into component.js,
 *   so the page shows even if the counts fail.
 * - hubCounts(listRows): per desk, the tasks waiting in its queues (the same filters as its
 *   inboxes, segments.js) and how many are past their deadline.
 * - renderHubFile(name): a generated file by name: the Hub's, and the feature explainers'
 *   (features.js), the desk buttons' (select-first-files.js) and the Retail onboarding picture's
 *   (kyc-flow.js).
 */
const fs = require('fs');
const path = require('path');

const { MODEL, COMPONENTS } = require('../paths');
const { hubFeatureCards, renderFeatureFile } = require('./features');
const { renderKycFlowFile } = require('./kyc-flow');
const { renderSelectFirstFile } = require('./select-first-files');
const { SEGMENTS } = require('../customizations/shared/segments');
const { stableId } = require('../model/ids');

const { desks, inboxes } = JSON.parse(
  fs.readFileSync(path.join(MODEL, 'workflows', 'desks.json'), 'utf8'),
);
const FILES_DIR = path.join(COMPONENTS, 'hub');
const HUB_ID = stableId('hub');
// "New to Forest? Take a tour!": the demo path's first desk, the demo layout's Simplified
// onboarding desk.
const TOUR_WORKSPACE_ID = '59d602ed-70de-43b8-8690-6b7b274affc4';
// The demo layout's Data model workspace.
const DATA_MAP_DESK = stableId('data-map-desk');

const DESCRIPTIONS = {
  onboarding:
    'Retail and business KYC: check the ID, the owners and the documents, then approve or ask for more.',
  alerts: 'AML and fraud alerts raised by the rules: clear the noise, escalate the real ones.',
  investigations:
    'Open cases and screening hits: build the case file, ask for due diligence, draft the SAR.',
  mlro: 'The MLRO signs off: file the SAR, send it back to the analyst, or close without one.',
  payments: 'High-value transfers to validate, and the SEPA recalls other banks send us.',
  disputes:
    'Card and SEPA disputes: route each request, file chargebacks, answer the merchant’s bank.',
  overview: 'Every queue of every team on one page: the manager’s view.',
};

// Where a task is late: the queue's table and the field holding its deadline.
const DEADLINES = {
  kyc_cases: 'due_at',
  information_requests: 'due_at',
  alerts: 'due_at',
  investigations: 'due_at',
  outgoing_transfers: 'requested_execution_date',
  sepa_disputes: 'response_due',
  chargebacks: 'representment_deadline',
};
// Desks whose queues have no deadline say something else about their work (none today).
const SECOND_FIGURE = {};

/** What the page shows, counts aside. The feature map's cards open the explainers (features.js). */
function hubContent() {
  return {
    hubId: HUB_ID,
    tourWorkspaceId: TOUR_WORKSPACE_ID,
    dataMapWorkspaceId: DATA_MAP_DESK,
    desks: desks.map(d => ({
      key: d.key,
      name: d.name,
      icon: d.icon,
      description: DESCRIPTIONS[d.key] || '',
      workspaceId: stableId(d.key),
    })),
    features: hubFeatureCards(),
  };
}

// Queues that wait on someone else (the customer), not on the team: not "to review".
const WAITING_ON_OTHERS = new Set(['rfi_waiting']);

/**
 * The segment queues a desk works (the overview: all of them). Workflow inboxes are fed by runs,
 * not by the data, and automated inboxes are worked by a robot, so neither is counted.
 */
function deskQueues(desk) {
  const boxes = desk.key === 'overview' ? inboxes : inboxes.filter(b => b.desk === desk.key);
  const keys = [
    ...new Set(
      boxes
        // An automated inbox is the robot's work, not the team's: not counted either.
        .filter(b => b.kind === 'segment' && !b.automated && !WAITING_ON_OTHERS.has(b.segment))
        .map(b => b.segment),
    ),
  ];

  return keys.map(key => ({ key, table: SEGMENTS[key][0], tree: SEGMENTS[key][2] }));
}

/** A date-only deadline is late from the next day; a date and time, from that moment. */
function isPast(value, now) {
  if (value === null || value === undefined || value === '') return false;
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text < now.toISOString().slice(0, 10);
  const time = Date.parse(text);

  return !Number.isNaN(time) && time < now.getTime();
}

/**
 * Counts per desk. `listRows(table, conditionTree, fields)` returns the rows of one queue with
 * those fields (collection.list in the agent).
 */
async function hubCounts(listRows, now = new Date()) {
  const queues = new Map();
  desks.forEach(desk => deskQueues(desk).forEach(q => queues.set(q.key, q)));
  const rows = {};
  await Promise.all(
    [...queues.values()].map(async q => {
      const fields = [DEADLINES[q.table], SECOND_FIGURE[q.table]?.field].filter(Boolean);
      rows[q.key] = await listRows(q.table, q.tree, fields);
    }),
  );
  const result = {};
  desks.forEach(desk => {
    const mine = deskQueues(desk);
    const all = mine.flatMap(q => rows[q.key].map(r => ({ table: q.table, row: r })));
    const overdue = all.filter(
      ({ table, row }) => DEADLINES[table] && isPast(row[DEADLINES[table]], now),
    ).length;
    const second = SECOND_FIGURE[desk.key];
    result[desk.key] = {
      waiting: all.length,
      overdue,
      hasDeadline: mine.some(q => DEADLINES[q.table]),
      queues: Object.fromEntries(mine.map(q => [q.key, rows[q.key].length])),
      ...(second
        ? {
            extra: {
              label: second.label,
              count: all.filter(
                ({ table, row }) => table === second.table && second.test(row[second.field]),
              ).length,
            },
          }
        : {}),
    };
  });

  return { desks: result, at: now.toISOString() };
}

/** The API chart the component reads: `GET /forest/_charts/hub_counts`. */
function addHubChart(customizer) {
  customizer.addChart('hub_counts', async (context, resultBuilder) => {
    const listRows = (table, conditionTree, fields) =>
      context.dataSource.getCollection(table).list({ conditionTree }, ['id', ...fields]);

    return resultBuilder.smart(await hubCounts(listRows));
  });
}

// back.js is component.js in its "back to the Hub" mode.
const SOURCES = {
  'template.hbs': 'template.hbs',
  'component.js': 'component.js',
  'style.css': 'style.css',
  'back.hbs': 'back.hbs',
  'back.js': 'component.js',
};

/**
 * A generated file by name, or null: component.js gets the content and its mode. Other names may
 * be the desk buttons' (select-first-files.js), the Retail onboarding picture's (kyc-flow.js) or a
 * feature explainer's (features.js).
 */
function renderHubFile(name) {
  const source = SOURCES[name];

  if (!source) {
    return renderSelectFirstFile(name) ?? renderKycFlowFile(name) ?? renderFeatureFile(name);
  }

  let text = fs.readFileSync(path.join(FILES_DIR, source), 'utf8');

  if (source === 'component.js') {
    const fill = (marker, value) => {
      text = text.replace(
        new RegExp(`/\\* ${marker} \\*/[\\s\\S]*?/\\* /${marker} \\*/`),
        JSON.stringify(value),
      );
    };

    fill('hub-content', hubContent());
    fill('hub-mode', name === 'back.js' ? 'back' : 'hub');
  }

  return text;
}

module.exports = { HUB_ID, addHubChart, hubContent, hubCounts, renderHubFile };
