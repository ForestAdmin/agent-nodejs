/**
 * Feature explainers: one hidden workspace per Forest feature, opened from the Hub's feature map,
 * each with a "← Hub" button as its only way back. Every explainer is the same workspace Custom
 * component (stored as "smart"), whose files live in features/ and are served next to the Hub's
 * (hub.js hands them over): one template and one style for all, and one `feature-<key>.js` per
 * feature, which is features/component.js with that feature's content written in.
 *
 * - FEATURES: the content. Facts are either computed here from the lab's own files (static) or
 *   read live from the `feature_facts` chart (`live: 'records.customers'`).
 * - featureFacts(): the live figures, read by the `feature_facts` chart.
 * - renderFeatureFile(name): feature.hbs, feature.css and feature-<key>.js, generated at build
 *   time (scripts/build-public.js).
 */
const fs = require('fs');
const path = require('path');

const { SEGMENTS } = require('../customizations/shared/segments');
const { GROUPS } = require('../model/folders');
const { stableId } = require('../model/ids');
const { tables } = require('../model/schema');
const { MODEL, COMPONENTS } = require('../paths');

// The demo layout's record pages (its Customer 360, KYC case and Alert workspaces).
const RECORD_PAGES = ['customers', 'kyc_cases', 'alerts'];
// The Smart Action a desk shows as a button outside its queues (the SARs waiting for TRACFIN).
const LIST_BUTTONS = [['Record TRACFIN answer']];

const { desks, inboxes } = JSON.parse(
  fs.readFileSync(path.join(MODEL, 'workflows', 'desks.json'), 'utf8'),
);
const WORKFLOWS = fs
  .readdirSync(path.join(MODEL, 'workflows'))
  .filter(f => f.endsWith('.json') && f !== 'desks.json')
  .sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(MODEL, 'workflows', f), 'utf8')));
const FILES_DIR = path.join(COMPONENTS, 'features');
const HUB_ID = stableId('hub');

// The tables whose size the explainers quote, read live.
const RECORD_TABLES = [
  'customers',
  'accounts',
  'transactions',
  'kyc_cases',
  'documents',
  'alerts',
  'outgoing_transfers',
];

// The explainers, the Hub aside.
const EXPLAINER_COUNT = 12;

const sum = list => list.reduce((a, b) => a + b, 0);
const aiSteps = wf => wf.steps.filter(s => s.type === 'condition' && s.ai).length;

/** Figures read from the lab's own files: they change only with the code. */
const STATIC = {
  tables: Object.keys(tables).length,
  tablesShown:
    Object.keys(tables).length -
    sum(GROUPS.map(([, , names]) => names.filter(n => n.startsWith('-')).length)),
  segments: Object.keys(SEGMENTS).length,
  inboxes: inboxes.length,
  segmentInboxes: inboxes.filter(b => b.kind === 'segment').length,
  workflowInboxes: inboxes.filter(b => b.kind === 'workflow').length,
  workflows: WORKFLOWS.length,
  aiDecisions: sum(WORKFLOWS.map(aiSteps)),
  aiWorkflows: WORKFLOWS.filter(wf => aiSteps(wf) > 0).length,
  escalations: sum(WORKFLOWS.map(wf => wf.steps.filter(s => s.type === 'escalation').length)),
  desks: desks.length,
  teamDesks: desks.filter(d => d.key !== 'overview').length,
  recordPages: RECORD_PAGES.length,
  // Every Smart Action a desk shows as a button: the desk's, its queues' own (desks.json) and the
  // extra lists' (desk-extras.js), each counted once.
  deskButtons: new Set(
    [
      ...desks.flatMap(d => d.buttons),
      ...inboxes.flatMap(b => b.buttons || []),
      ...LIST_BUTTONS,
    ].map(([name]) => name),
  ).size,
  // The Ops overview shows one counter per segment queue (the demo layout).
  // One per segment inbox the team works (an automated inbox is the robot's: no counter).
  overviewCounters: inboxes.filter(b => b.kind === 'segment' && !b.automated).length,
};

// A queue is named as its inbox on the desks (the segment's own name otherwise).
const queueName = key => inboxes.find(b => b.segment === key)?.name || SEGMENTS[key][1];
const queue = key => ({ live: `queues.${key}`, label: `waiting in “${queueName(key)}”` });
const counter = key => ({ live: `queues.${key}`, label: `on the “${queueName(key)}” counter` });

/**
 * The explainers, in the Hub's order. Buttons open a desk (`desk`), a table (`table`) or the Hub
 * (`hub`). `art` names the illustration.
 */
const FEATURES = [
  {
    key: 'collections',
    icon: '🗂️',
    name: 'Collections & record pages',
    promise: 'Every table of your bank, browsable, with a page per customer that tells the story.',
    hubWhere: 'Customers table: open a customer for its Customer 360.',
    what: [
      'Forest reads your database and shows each table as a collection: a list you can search, filter, sort and export, without writing a screen.',
      'Open a row and you get its record: its fields, then everything linked to it. A customer shows its accounts, cards, KYC cases and alerts one click away, and documents open as PDFs.',
      'A record page goes further: one page designed for one kind of record, like a Customer 360 that puts identity, risk and recent activity side by side.',
    ],
    facts: [
      { value: STATIC.tablesShown, label: 'tables in the left panel' },
      { live: 'records.customers', label: 'customers' },
      { live: 'records.transactions', label: 'transactions' },
      { value: STATIC.recordPages, label: 'record pages (Customer 360, KYC case, Alert)' },
    ],
    buttons: [
      { label: 'Open Customers', table: 'customers' },
      { label: 'Open KYC cases', table: 'kyc_cases' },
    ],
    setup: [
      'Nothing to build: every table the agent sends is already a collection.',
      'Turn on the Layout Editor (top bar), click the cog next to a table: rename it, pick its summary field, hide or reorder columns.',
      'On a record, still in the Layout Editor: reorder fields, add tabs, choose which related data shows.',
      'For a record page, build its Summary view: drag fields, related data and actions onto it.',
    ],
    docs: 'https://docs.forest.app/product/build/layout-editor.md',
    art: 'collections',
  },
  {
    key: 'segments',
    icon: '🔖',
    name: 'Segments',
    promise: 'Saved lists your whole team shares: “transfers to validate” is one click away.',
    hubWhere: 'Alerts table: AML alerts to review, Fraud and takeover alerts.',
    what: [
      'A segment is a saved filter on a collection, with a name. Everyone on the team sees the same rows, kept up to date as the data changes.',
      'Build one with the filter builder, with a SQL query, or in the agent’s code when the rule is too rich for a filter.',
      'Segments are the bricks of the rest: the queues that hand out cases are built on them, and the desks’ counters count them.',
    ],
    facts: [
      { value: STATIC.segments, label: 'segments in this demo' },
      queue('alerts_aml'),
      queue('transfers_validate'),
      queue('disputes_new'),
    ],
    buttons: [
      { label: 'Open Alerts', table: 'alerts' },
      { label: 'Open Outgoing transfers', table: 'outgoing_transfers' },
    ],
    setup: [
      'Turn on the Layout Editor, click the cog next to the table, open the Segments tab.',
      'Click “+ New segment”, name it, add the filters (say Validation status is Pending), pick a sort.',
      'Save, then switch it on: new segments start disabled.',
      'Or filter the list first and save it as a segment from there.',
    ],
    docs: 'https://docs.forest.app/product/process/segments/creating-segments.md',
    art: 'segments',
  },
  {
    key: 'inboxes',
    icon: '📥',
    name: 'Inboxes & queues',
    promise:
      'Each analyst gets the next task, in the right order, and nobody works the same case twice.',
    hubWhere: 'Onboarding desk: Retail onboarding, Business onboarding.',
    what: [
      'An inbox turns a segment into a queue. An analyst clicks “Next ticket” and gets the next case, sorted the way the team decided: oldest first, highest score first.',
      'The task is theirs until they finish it. A cap stops anyone hoarding cases, and an idle task goes back to the queue on its own.',
      'Some inboxes are fed by workflows instead: when a step escalates, the run waits there for a senior analyst or the MLRO to pick it up.',
    ],
    facts: [
      { value: STATIC.segmentInboxes, label: 'queues built on segments' },
      { value: STATIC.workflowInboxes, label: 'escalation inboxes fed by workflows' },
      queue('alerts_fraud'),
      queue('disputes_new'),
    ],
    buttons: [
      { label: 'Open the Onboarding desk', desk: 'onboarding' },
      { label: 'Open the Alerts desk', desk: 'alerts' },
    ],
    setup: [
      'Turn on the Layout Editor. In the left panel, find Inboxes and click Add New.',
      'Pick the collection, then the segment whose rows become tasks.',
      'In the inbox settings: the sort order, the most tasks one person may hold, the idle time before a task goes back.',
      'Put it on a desk: drag an Inbox component into a workspace.',
    ],
    docs: 'https://docs.forest.app/product/manage/inbox.md',
    art: 'inboxes',
  },
  {
    key: 'workflows',
    icon: '🧭',
    name: 'Workflows',
    promise:
      'Your procedure, step by step on screen: the analyst follows it, and the hard cases go up.',
    hubWhere:
      'Alerts desk: Fraud and takeover alert. Payments desk: High-value transfer validation.',
    what: [
      'A workflow is your procedure drawn as steps: read these fields, run this check, decide, act. The analyst sees one step at a time next to the record.',
      'Some steps run on their own (start the review, call SEON). Others wait for the analyst to read and click Done. A decision can be left to AI, which explains its choice.',
      'When a case needs a second pair of eyes, an escalation step parks the run in an inbox, and a senior analyst carries on where it stopped.',
    ],
    facts: [
      { value: STATIC.workflows, label: 'workflows in this demo' },
      { value: STATIC.aiDecisions, label: 'decisions left to AI' },
      { value: STATIC.escalations, label: 'escalation steps to an inbox' },
      queue('alerts_fraud'),
    ],
    buttons: [
      { label: 'Open the Alerts desk', desk: 'alerts' },
      { label: 'Open the Payments desk', desk: 'payments' },
    ],
    setup: [
      'Open the table’s settings (cog, in the Layout Editor), Workflows tab, click “+ New”.',
      'Drag steps from the toolbar onto the canvas: Guidance, Get data, Trigger action, Decision, Escalation, End.',
      'On a Decision, set the decision maker to AI to let it pick the branch from what earlier steps read.',
      'On an Escalation, pick the inbox that receives the run. Save, then add a Workflow button to a desk.',
    ],
    docs: 'https://docs.forest.app/product/process/workflows/overview.md',
    art: 'workflows',
  },
  {
    key: 'smart-actions',
    icon: '⚡',
    name: 'Smart Actions',
    promise:
      'Your business operations as buttons: a form, your code runs, a card shows what it did.',
    hubWhere: 'MLRO desk: File SAR. Disputes desk: Route dispute, File with network.',
    what: [
      'A Smart Action is a button on a record that runs your own code in the agent: approve a transfer, file a SAR, block a card, call a provider.',
      'It can ask for input first, with a form that adapts as you fill it, and finish with a result card that shows what changed.',
      'Sensitive ones can need a second person: with approvals on, the action waits until someone allowed to approve it says yes.',
    ],
    facts: [
      { live: 'actions.total', label: 'Smart Actions in this demo' },
      { value: STATIC.deskButtons, label: 'of them as buttons on the desks' },
    ],
    buttons: [
      { label: 'Open the Disputes desk', desk: 'disputes' },
      { label: 'Open the MLRO desk', desk: 'mlro' },
    ],
    setup: [
      'A developer declares it in the agent: collection.addAction("Route dispute", { scope, form, execute }).',
      'The form fields go in “form”; the result card is the HTML the action returns.',
      'In the Layout Editor, table settings, Actions tab: choose where the button shows and its color.',
      'Approvals: Project settings, Roles, then per action “Require approval” and who may approve. Requests land in Collaboration, Approval Workflow.',
    ],
    docs: 'https://docs.forest.app/product/execute/actions.md',
    art: 'actions',
  },
  {
    key: 'charts',
    icon: '📊',
    name: 'Charts & analytics',
    promise: 'Live counters and graphs on your data, where the team works, with no BI project.',
    hubWhere: 'Ops overview: a live counter per queue, across the teams.',
    what: [
      'A chart is a number or a graph computed from your data when the page opens: a counter, a trend over time, a breakdown, a leaderboard, progress against a target.',
      'Build it with clicks (a table, a count or a sum, a filter), with SQL, or in the agent’s code when you need any logic at all. The Hub’s live counts are such a chart.',
      'Charts go on dashboards, on a record’s Analytics tab, and on desks, right above the queues they count.',
    ],
    facts: [
      { value: STATIC.overviewCounters, label: 'live counters on the Ops overview' },
      counter('alerts_fraud'),
      counter('transfers_validate'),
      counter('inv_open'),
    ],
    buttons: [
      { label: 'Open the Ops overview', desk: 'overview' },
      { label: 'Open the Payments desk', desk: 'payments' },
    ],
    setup: [
      'Turn on the Layout Editor, open the Dashboard tab (or a record’s Analytics tab).',
      'Click “Add a new chart”, name it, pick the type: single value, repartition, time-based, percentage, objective, leaderboard.',
      'Pick the table, the count or sum, the filters. Or switch to SQL, or point it at a chart coded in the agent.',
      'On a desk: drag a Chart component into the workspace.',
    ],
    docs: 'https://docs.forest.app/product/manage/charts/overview.md',
    art: 'charts',
  },
  {
    key: 'workspaces',
    icon: '🧩',
    name: 'Workspaces & the layout editor',
    promise:
      'A page per team: its queue, the case, and the buttons to act, without a line of code.',
    hubWhere: 'Every desk. The Hub and this page are workspaces too.',
    what: [
      'A workspace is a page you assemble: an inbox on the left, the picked case’s fields in tabs, the workflow and action buttons on the right, counters on top.',
      'Components talk to each other: pick a task in the inbox and every field, button and tab follows it.',
      'The Layout Editor rearranges everything else too: tables, columns, record pages, forms. Changes are a draft for your team until you publish them.',
    ],
    facts: [
      { value: STATIC.teamDesks, label: 'team desks, plus the manager’s Ops overview' },
      { value: STATIC.recordPages, label: 'record pages' },
      { value: STATIC.inboxes, label: 'inboxes, filed in the team folders' },
    ],
    buttons: [
      { label: 'Open the Onboarding desk', desk: 'onboarding' },
      { label: 'Open the Ops overview', desk: 'overview' },
    ],
    setup: [
      'Click “+ Add New” in the left panel, choose Workspace, name it (“KYC review”).',
      'Drag components from the side: Inbox or Collection, then Fields, Actions, Workflow, Chart, Text, Tabs.',
      'Set the collection’s row click to “Select a record”, so the fields follow the picked row.',
      'Exit the builder and try it as an operator.',
    ],
    docs: 'https://docs.forest.app/product/build/workspaces.md',
    art: 'workspaces',
  },
  {
    key: 'custom-components',
    icon: '🛠️',
    name: 'Custom components',
    promise:
      'When the built-in blocks are not enough, drop your own HTML, code and style into a page.',
    hubWhere: 'This Hub: the cards, the live counts and the tour button.',
    what: [
      'A custom component is a workspace block you write yourself: a template, a small JavaScript component and a stylesheet, served from a URL.',
      'It runs inside Forest with the viewer’s session, so it can read the agent (charts, records) with their rights, and use Forest’s own UI pieces.',
      'This page is one. So is the Hub: one shared template, with each feature’s content written in when the demo is built.',
    ],
    facts: [
      {
        value: 1 + EXPLAINER_COUNT,
        label: `custom pages: the Hub and ${EXPLAINER_COUNT} explainers`,
      },
      { value: 3, label: 'files each: template, component, style' },
    ],
    buttons: [{ label: 'Open the Hub', hub: true }],
    setup: [
      'Write three files: a template (HTML), a small JavaScript component, a stylesheet.',
      'Serve them from a URL the browser can reach. Here a public CDN serves them, from the demo’s npm package.',
      'In the workspace builder, drag a Custom component and give it the three URLs.',
      'From the code, read the agent as the viewer, with their rights: here, an API chart for the live counts.',
    ],
    docs: 'https://docs.forest.app/product/build/workspaces.md',
    art: 'custom',
  },
  {
    key: 'roles',
    icon: '🔐',
    name: 'Roles, teams & permissions',
    promise: 'Analysts see what they need and do what they may; the MLRO signs, the rest cannot.',
    hubWhere: 'This demo runs as the Operations team. Project settings, Roles.',
    what: [
      'Teams decide what people see: each team has its own layout, desks and inboxes. Compliance does not have to see the payments queues.',
      'Roles decide what people may do, table by table (see, create, edit, delete, export) and action by action (run it, need approval, approve).',
      'A user belongs to one or more teams, with one role. Admins manage all of it in Project settings.',
    ],
    facts: [],
    liveText:
      'This demo runs as the Operations team, and you are its admin: every desk and every action is open to you. Open Project settings (top-right menu), then Roles and Teams, to see where it is set.',
    buttons: [],
    setup: [
      'Project settings (top-right menu), Teams: create “Compliance”, “Payments”, add people.',
      'Project settings, Roles: create “Analyst”, “MLRO”; per table, tick list, details, create, update, delete, export.',
      'Per Smart Action: trigger, require approval, approve, self-approve.',
      'Switch team (top bar) to lay out each team’s desks: layouts are per team and environment.',
    ],
    docs: 'https://docs.forest.app/get-started/control/roles-permissions.md',
    art: 'roles',
  },
  {
    key: 'agent',
    icon: '🛡️',
    name: 'The agent & data privacy',
    promise:
      'Your data never leaves your infrastructure: Forest sees the shape of your tables, not the rows.',
    hubWhere: 'This demo’s agent runs on this Mac, on port 3310.',
    what: [
      'The agent is a small Node.js server you run next to your database. It is the only thing that reads and writes your data.',
      'Forest’s servers hold the interface: layouts, segments, workflows, permissions. They receive a description of your tables (the schema), never the records.',
      'Your browser loads the interface from Forest, then asks the agent for the data directly. Here, everything you see in a list came from localhost.',
    ],
    facts: [
      { value: STATIC.tables, label: 'tables described to Forest (schema only)' },
      { live: 'records.customers', label: 'customers, read from the agent' },
      { live: 'records.transactions', label: 'transactions that stay on this machine' },
    ],
    buttons: [{ label: 'Open Customers', table: 'customers' }],
    setup: [
      'The forest start command created this agent: its code is index.ts, its secrets in .env.',
      'Point it at your database (Postgres, MySQL, SQL Server, Mongo…) and run it: here on localhost:3310.',
      'In production, deploy it like any service: Docker, your cloud, behind your firewall.',
      'Customize in code: Smart Actions, computed fields, segments, charts, all in the agent.',
    ],
    docs: 'https://docs.forest.app/get-started/connect/architectures/self-hosted.md',
    art: 'agent',
  },
  {
    key: 'ai',
    icon: '✨',
    name: 'AI in Forest',
    promise:
      'AI that decides inside your procedure, explains why, and stays inside your permissions.',
    hubWhere: 'Alerts desk: the Fraud and takeover alert workflow decides with AI.',
    what: [
      'In a workflow, a decision can be left to AI: it reads what the earlier steps gathered, picks the branch, and writes down why. The analyst sees the reason and can overrule.',
      'AI steps can also suggest the next action or fetch the fields that matter, so the analyst clicks less.',
      'With the MCP server, an AI assistant (Claude, Cursor…) can browse records, run actions and start workflows, as the connected user, with the same permissions and audit trail.',
    ],
    facts: [
      { value: STATIC.aiDecisions, label: 'AI decisions in the workflows' },
      { value: STATIC.aiWorkflows, label: `of ${STATIC.workflows} workflows use AI` },
    ],
    buttons: [
      { label: 'Open the Alerts desk', desk: 'alerts' },
      { label: 'Open the Onboarding desk', desk: 'onboarding' },
    ],
    setup: [
      'In the workflow editor, select a Decision step and set its decision maker to AI.',
      'Make sure the steps before it read the fields the decision needs.',
      'MCP: add the gateway to the agent (addGateway({ mcp: true })), restart, connect your assistant to <agent url>/mcp.',
      'Turn on the MCP trigger of each workflow an assistant may start.',
    ],
    docs: 'https://docs.forest.app/product/embed/mcp-server.md',
    art: 'ai',
  },
  {
    key: 'activity',
    icon: '📜',
    name: 'Activity log & audit',
    promise: 'Who did what, on which record, and when: every click an auditor will ask about.',
    hubWhere: 'Any record: its Activity tab.',
    what: [
      'Forest records every change: records created, edited or deleted, actions run and approved, inbox tasks taken, workflow steps done, notes left.',
      'Each entry names the person, the record and the time. Record values are not copied into the log, only the record’s id.',
      'Open a record’s Activity tab for its history, or the project’s activity log for the whole team, filtered by person, type and date. Admins can export it.',
    ],
    facts: [],
    liveText:
      'Run an action on a desk (say Approve KYC), then open that KYC case from the list and its Activity tab: your action is there, with your name and the time.',
    buttons: [
      { label: 'Open the Onboarding desk', desk: 'onboarding' },
      { label: 'Open KYC cases', table: 'kyc_cases' },
    ],
    setup: [
      'Nothing to set up: the log is on.',
      'Open any record, then its Activity tab.',
      'Filter by author, activity type or date; switch newest or oldest first.',
      'Admins: Export, pick a date range, and the file arrives by email. Field-level diffs need the audit trail on the agent.',
    ],
    docs: 'https://docs.forest.app/get-started/control/audit.md',
    art: 'activity',
  },
];

const featureWorkspaceId = key => stableId(`feature:${key}`);

/** What the Hub's feature map shows: each card opens its explainer. */
function hubFeatureCards() {
  return FEATURES.map(f => ({
    name: f.name,
    what: f.promise,
    where: f.hubWhere,
    workspaceId: featureWorkspaceId(f.key),
    collection: null,
  }));
}

/** One explainer's content, as its component gets it. */
function featureContent(key) {
  const index = FEATURES.findIndex(f => f.key === key);
  if (index < 0) return null;
  const { buttons, ...feature } = FEATURES[index];

  return {
    hubId: HUB_ID,
    workspaceId: featureWorkspaceId(key),
    position: index + 1,
    total: FEATURES.length,
    ...feature,
    buttons: buttons.map(b => ({
      label: b.label,
      workspaceId: (b.hub && HUB_ID) || (b.desk && stableId(b.desk)) || null,
      collection: b.table || null,
    })),
  };
}

/**
 * The live figures. `count(table, tree)` counts a table's rows (all of them when `tree` is null);
 * `actionCount()` counts the Smart Actions the agent declares.
 */
async function featureFacts({ count, actionCount }, now = new Date()) {
  const records = {};
  const queues = {};
  await Promise.all([
    ...RECORD_TABLES.map(async t => {
      records[t] = await count(t, null);
    }),
    ...Object.entries(SEGMENTS).map(async ([key, [table, , tree]]) => {
      queues[key] = await count(table, tree);
    }),
  ]);

  return { records, queues, actions: { total: await actionCount() }, at: now.toISOString() };
}

// The lab's finished data source: charts sit below Smart Actions in the customizer's stack, so the
// chart's own context sees no action. withFeatureSource() keeps the top one for it.
let topDataSource = null;

/** Wraps the lab's data source factory to remember what it builds. */
function withFeatureSource(factory) {
  return async (...args) => {
    topDataSource = await factory(...args);

    return topDataSource;
  };
}

/** The API chart the explainers read: `GET /forest/_charts/feature_facts`. */
function addFeatureChart(customizer) {
  customizer.addChart('feature_facts', async (context, resultBuilder) => {
    const count = async (table, conditionTree) => {
      const [row] = await context.dataSource
        .getCollection(table)
        .aggregate(conditionTree ? { conditionTree } : {}, { operation: 'Count' });

      return Number(row?.value ?? 0);
    };

    const actionCount = () =>
      topDataSource
        ? sum(topDataSource.collections.map(c => Object.keys(c.schema.actions).length))
        : undefined;

    return resultBuilder.smart(await featureFacts({ count, actionCount }));
  });
}

/**
 * A generated explainer file, or null: feature.hbs, feature.css, and feature-<key>.js (the
 * component with that feature's content written in).
 */
function renderFeatureFile(name) {
  if (name === 'feature.hbs' || name === 'feature.css') {
    const file = name === 'feature.hbs' ? 'template.hbs' : 'style.css';

    return fs.readFileSync(path.join(FILES_DIR, file), 'utf8');
  }

  const match = /^feature-([a-z-]+)\.js$/.exec(name);
  const content = match && featureContent(match[1]);
  if (!content) return null;
  let text = fs.readFileSync(path.join(FILES_DIR, 'component.js'), 'utf8');

  const fill = (marker, value) => {
    text = text.replace(
      new RegExp(`/\\* ${marker} \\*/[\\s\\S]*?/\\* /${marker} \\*/`),
      JSON.stringify(value),
    );
  };

  fill('feature-content', content);

  return text;
}

module.exports = {
  FEATURES,
  addFeatureChart,
  hubFeatureCards,
  renderFeatureFile,
  withFeatureSource,
};
