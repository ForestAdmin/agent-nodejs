/**
 * The demo's own two KYC cases, created at every boot after the seed, for the "Onboarding desk -
 * KYC Case" workspace. Their references carry SHOWCASE_MARK (KYC-DEMO-0001, -0002): every queue
 * but the desk's own list leaves them out (segments.js), so a self-service visitor always finds
 * them waiting, whatever the robot or other desks do.
 *
 * - KYC-DEMO-0001, the happy path: a clean retail file (papers complete, an ID whose scan passes,
 *   nobody on a watchlist, income that explains the money expected in). The visitor takes it
 *   through the desk's actions one by one, up to Approve KYC.
 * - KYC-DEMO-0002, the escalation: the same clean papers and ID, but more money expected in than
 *   the declared income, so the risk is MEDIUM. The visitor runs the Retail onboarding workflow,
 *   which ends with "Send for senior sign-off": the case joins the senior officer's queue.
 * - KYC-DEMO-0003 and -0004, already in that queue (sent a few hours earlier, so ahead of case 2):
 *   an operator checked them and rated them MEDIUM (more money expected in than the income; funds
 *   from an inheritance with no notary deed). The senior officer's desk shows its inbox with them.
 *
 * Built like the presenter's "Send new applications" (demo-feed.js KINDS), so the papers, the
 * history and the pre-score are those of a real application. "Reset the demo cases" (a Global
 * action on kyc_cases) removes the two and everything they gathered, and creates them again.
 */
const { randomUUID } = require('crypto');
const knex = require('knex');

const { KINDS } = require('./demo-feed');
const { schema, tables } = require('../../model/schema');
const { forestStore, knexStore, newRetailApplicant, newRun } = require('../../seed/live');
const { badge, card } = require('../shared/render');
const { SHOWCASE_MARK } = require('../shared/segments');

const CASES = [
  {
    reference: `KYC-${SHOWCASE_MARK}-0001`,
    kind: 'clean',
    story: 'The happy path: every check clean, approve it with the actions',
  },
  {
    reference: `KYC-${SHOWCASE_MARK}-0002`,
    kind: 'medium',
    story: 'Medium risk: run Retail onboarding, it goes to a senior',
  },
  {
    reference: `KYC-${SHOWCASE_MARK}-0003`,
    kind: 'medium',
    story: 'Waiting for a senior: more money expected in than the income',
    senior: { by: 'lea.girard', hoursAgo: 3 },
  },
  {
    reference: `KYC-${SHOWCASE_MARK}-0004`,
    kind: 'inheritance',
    story: 'Waiting for a senior: funds from an inheritance, no notary deed',
    senior: { by: 'thomas.renaud', hoursAgo: 2 },
  },
];
// Above 70k EUR a year the bank asks for a proof of income the app does not send: not clean.
const PROOF_BANDS = ['FROM_70K_TO_120K', 'ABOVE_120K'];
// The demo's shapes: demo-feed.js's, and an inheritance with no notary deed (a MEDIUM risk).
const SHAPES = {
  ...Object.fromEntries(Object.entries(KINDS).map(([kind, k]) => [kind, k.shape])),
  inheritance: () => ({
    ...KINDS.clean.shape(),
    accept: p => p.source_of_funds === 'INHERITANCE' && !PROOF_BANDS.includes(p.income_band),
    risk: 'MEDIUM',
    intake: 'MEDIUM',
  }),
};
const SENIOR_REASON = 'Medium or high risk: senior sign-off';
const ID_AND_SELFIE = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'SELFIE'];
const MINUTE = 60 * 1000;
const operatorMail = name => `${name}@forest-lab-bank.fr`;

/** The same run, its clock `minutes` earlier: a case sent a few hours before the visit. */
function earlier(run, minutes) {
  const now = new Date(run.now.getTime() - minutes * MINUTE);

  return { ...run, now, at: ago => run.store.stamp(new Date(now.getTime() - ago * MINUTE)) };
}

/**
 * A case as an operator leaves it for a senior: papers and ID checked, screened clear, rated
 * MEDIUM and sent for sign-off, each step a line in its history (as the actions write them).
 */
async function sendToSenior(store, run, kycId, { by }) {
  const who = operatorMail(by);
  const docs = await store.list(
    'documents',
    [
      ['kyc_case_id', '=', kycId],
      ['document_type', 'in', ID_AND_SELFIE],
    ],
    ['id'],
  );
  await Promise.all(
    docs.map(doc =>
      store.patch('documents', doc.id, {
        check_result: 'PASSED',
        verified: true,
        verified_by: who,
        verified_at: run.at(50),
      }),
    ),
  );
  const line = (field, from, to, minutesAgo, reason) =>
    store.insert('status_changes', {
      id: randomUUID(),
      record_type: 'KYC_CASES',
      record_id: kycId,
      field,
      old_value: from,
      new_value: to,
      changed_by: who,
      changed_at: run.at(minutesAgo),
      reason,
    });
  await line('status', 'OPEN', 'IN_REVIEW', 58, `Review started by ${who}`);
  await line('documents', null, 'Complete', 55, '3 papers checked');
  await line('screening', null, 'No match', 45, 'ComplyAdvantage, simulated');
  await line('risk_after', null, 'MEDIUM', 40, 'Risk rated MEDIUM');
  await line('status', 'IN_REVIEW', 'PENDING_APPROVAL', 38, SENIOR_REASON);
  await store.patch('kyc_cases', kycId, {
    status: 'PENDING_APPROVAL',
    risk_after: 'MEDIUM',
    assigned_to: who,
    escalated_at: run.at(38),
    escalation_reason: SENIOR_REASON,
    updated_at: run.at(38),
  });
}

const RESET = 'Reset the demo cases';

const normalize = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** The two cases, written through `store` (live.js: the seed's SQLite or the agent's data). */
async function createShowcaseCases(store) {
  const run = newRun(store);
  const entries = await store.list(
    'watchlist_entries',
    [['delisted_at', 'null']],
    ['name', 'aliases'],
  );
  // Every name and alias on a watchlist, normalized as the screening compares them.
  const listed = new Set(
    entries.flatMap(e => [e.name, ...String(e.aliases || '').split(/[;,]/)]).map(normalize),
  );

  // One after the other: each takes the next case reference before it is renamed.
  return CASES.reduce(async (previous, { reference, kind, story, senior }) => {
    const done = await previous;
    const shape = SHAPES[kind]();
    const accept = shape.accept || (() => true);
    const at = senior ? earlier(run, senior.hoursAgo * 60) : run;
    const created = await newRetailApplicant(at, {
      ...shape,
      // The screening finds nobody: no applicant whose name is on a list.
      accept: p => accept(p) && !listed.has(normalize(`${p.first_name} ${p.last_name}`)),
    });
    await store.patch('kyc_cases', created.kycId, { reference });
    if (senior) await sendToSenior(store, at, created.kycId, senior);

    return [...done, { reference, name: created.name, story }];
  }, Promise.resolve([]));
}

/** At boot, in the database at `storage` (the seeded SQLite file). */
async function addShowcaseCases(storage) {
  const db = knex({ client: 'sqlite3', connection: { filename: storage }, useNullAsDefault: true });

  try {
    await createShowcaseCases(knexStore(db));
  } finally {
    await db.destroy();
  }
}

const hasId = table => tables[table].fields.some(f => f.name === 'id');
const inIds = (field, ids) => ({ conditionTree: { field, operator: 'In', value: ids } });

/**
 * Every row the demo cases brought or gathered: the cases, their customers and people, and what
 * hangs on them through the schema's links (papers, requests, hits, the account and card opened on
 * approval…), followed from parent to child only, so shared data (watchlists, rules) is never
 * reached. Table → ids, in the order they were found.
 */
async function showcaseRows(dataSource) {
  const list = (table, field, ids) =>
    dataSource.getCollection(table).list(inIds(field, ids), ['id']);
  const cases = await dataSource.getCollection('kyc_cases').list(
    inIds(
      'reference',
      CASES.map(c => c.reference),
    ),
    ['id', 'customer_id'],
  );
  const customers = [...new Set(cases.map(c => c.customer_id))];
  const members = await dataSource
    .getCollection('customer_members')
    .list(inIds('customer_id', customers), ['individual_id']);
  const found = new Map([
    ['kyc_cases', new Set(cases.map(c => c.id))],
    ['customers', new Set(customers)],
    ['individuals', new Set(members.map(m => m.individual_id).filter(Boolean))],
  ]);
  let frontier = [...found.entries()].map(([table, ids]) => [table, [...ids]]);

  while (frontier.length) {
    const next = [];
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      frontier.flatMap(([parent, ids]) =>
        schema.relations
          .filter(r => r.parent === parent && hasId(r.child))
          .map(async r => {
            const rows = await list(r.child, r.foreignKey, ids);
            const seen = found.get(r.child) || new Set();
            const fresh = rows.map(row => row.id).filter(id => !seen.has(id));
            if (!fresh.length) return;
            fresh.forEach(id => seen.add(id));
            found.set(r.child, seen);
            next.push([r.child, fresh]);
          }),
      ),
    );
    frontier = next;
  }

  return found;
}

/** Remove the demo cases and all they gathered, then create them again, as at boot. */
async function resetShowcaseCases(dataSource) {
  const found = await showcaseRows(dataSource);
  const remove = (table, field, ids) =>
    ids.length ? dataSource.getCollection(table).delete(inIds(field, ids)) : null;
  const all = [...found.values()].flatMap(ids => [...ids]);
  // Their history, and the link tables with no id of their own (alert or investigation lines).
  await remove('status_changes', 'record_id', all);
  await Promise.all(
    schema.relations
      .filter(r => !hasId(r.child) && found.has(r.parent))
      .map(r => remove(r.child, r.foreignKey, [...found.get(r.parent)])),
  );

  // Children first: the tables found last hang on the ones found before.
  // eslint-disable-next-line no-restricted-syntax
  for (const [table, ids] of [...found.entries()].reverse()) {
    // eslint-disable-next-line no-await-in-loop
    await remove(table, 'id', [...ids]);
  }

  const removed = [...found.values()].reduce((n, ids) => n + ids.size, 0);

  return { created: await createShowcaseCases(forestStore(dataSource)), removed };
}

function resetCard({ created, removed }) {
  return card({
    eyebrow: 'Demo cases',
    title: 'The demo cases are back at the start',
    status: ['Ready', 'green'],
    rows: [['Rows removed', `${removed} (the old cases and all they gathered)`]],
    list: {
      head: ['Case', 'Applicant', 'Story'],
      rows: created.map(c => [c.reference, c.name, { html: badge(c.story, 'grey') }]),
    },
    note: 'A workflow run started on an old case stays in Forest: it now points to a removed case.',
  });
}

function addShowcaseReset(collection) {
  collection.addAction(RESET, {
    scope: 'Global',
    execute: async (context, resultBuilder) => {
      const result = await resetShowcaseCases(context.dataSource);

      return resultBuilder.success(
        `Demo cases reset: ${result.created.map(c => `${c.reference} (${c.name})`).join(', ')}.`,
        { html: resetCard(result) },
      );
    },
  });
}

const SENIOR_CASES = CASES.filter(c => c.senior).map(c => c.reference);

module.exports = {
  CASES,
  RESET,
  SENIOR_CASES,
  addShowcaseCases,
  addShowcaseReset,
  resetShowcaseCases,
};
