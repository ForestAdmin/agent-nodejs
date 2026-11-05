/**
 * Smart Actions of the onboarding, alert and screening work. Each action checks the record's
 * state first, writes a status_changes row for every status it changes, and gives new case rows a
 * reference. Simulated providers answer from the data, never at random, and say so in their
 * message.
 */
import type { RecordData } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { createHash, randomUUID } from 'crypto';

import { handoverReason } from './robot-results';
import { businessDays } from '../../seed/ledger';
import { scanFlaw } from '../../seed/random';
import { BIC, frenchIban } from '../../seed/reference';
import { REFUSAL, customerStatusAfter, refusalOfPaper, refusalReason } from '../../seed/refusals';
import { tables } from '../../seed/schema';
import {
  callAnswer,
  deviceVerdict,
  alertTransactions as evidenceTransactions,
  loginFacts,
  paymentOf,
  paymentStatusText,
  phoneOnFile,
} from '../evidence/alerts';
import {
  LABELS as CASE_LABELS,
  KBIS_MAX_DAYS,
  applicantRequest,
  caseFile,
  checkReasons,
  companyDocuments,
  owners as companyOwners,
  documentCheck,
  reader,
  registerOf,
} from '../shared/case-file';
import { PROVIDERS, freezeReport, resultsFrom } from '../shared/providers';
import { badge, card, codeText, euros, frDate, frStamp } from '../shared/render';

const DAY = 24 * 3600 * 1000;
const CLOSED_CASE = ['APPROVED', 'REJECTED'];
const ID_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'];
const OPEN_REQUEST = ['DRAFT', 'SENT', 'OVERDUE'];
const REVIEW_YEARS = { LOW: 3, MEDIUM: 2, HIGH: 1 };
const INVESTIGATION_TYPE = { AML: 'AML', FRAUD: 'FRAUD', ACCOUNT_TAKEOVER: 'ACCOUNT_TAKEOVER' };
const DISCARD_REASONS = [
  'Homonym: different date of birth',
  'Homonym: different country',
  'Different entity type',
  'Other',
];

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

const enumOf = (table, field) => tables[table].fields.find(f => f.name === field).enum;
const hasId = table => tables[table].fields.some(f => f.name === 'id');
const now = () => new Date().toISOString();
const inDays = days => new Date(Date.now() + days * DAY).toISOString();
const dateOnly = iso => iso.slice(0, 10);
const money = n => Math.round(Number(n) * 100) / 100;
const hex = (seed, length) =>
  createHash('md5').update(String(seed)).digest('hex').slice(0, length).toUpperCase();
const normalize = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
// Codes read as words; a driving licence is never a "drivers license" on a card.
const label = code =>
  code === 'DRIVERS_LICENSE' ? 'driving licence' : code.replace(/_/g, ' ').toLowerCase();
const fullName = p => `${p.first_name} ${p.last_name}`;

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const not = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'NotIn' : 'NotEqual', value);
const where = leaves => ConditionTreeFactory.intersect(...leaves);
// A document nobody checked yet has no result: MANUAL_REVIEW is an answer of a check ("look closer").
const notChecked = () => new ConditionTreeLeaf('check_result', 'Missing');
const waitsForCheck = doc => !doc.check_result;

/** Read and write any table, as the operator running the action. */
function db(context) {
  const collection = table => context.dataSource.getCollection(table);
  const list = (table, leaves, fields, sort?) =>
    collection(table).list(
      new PaginatedFilter({ conditionTree: where(leaves), sort: sort && new Sort(sort) }),
      fields,
    );

  return {
    email: context.caller.email,
    list,
    one: async (table, id, fields) => (id ? (await list(table, [eq('id', id)], fields))[0] : null),
    update: (table, leaves, patch) =>
      collection(table).update(new Filter({ conditionTree: where(leaves) }), patch),
    create: async (table, row) =>
      (await collection(table).create([hasId(table) ? { id: randomUUID(), ...row } : row]))[0],
  };
}

/** One row in the status history (record_type is the table name in capitals). */
function logStatus(d, table, recordId, from, to, reason) {
  return d.create('status_changes', {
    record_type: table.toUpperCase(),
    record_id: recordId,
    field: 'status',
    old_value: from || null,
    new_value: to,
    changed_by: d.email,
    changed_at: now(),
    reason: reason || null,
  });
}

/** Hands out PREFIX-YEAR-NUMBER references, following the last one of the year in the table. */
async function referenceMaker(d, table, prefix) {
  const start = `${prefix}-${new Date().getFullYear()}-`;
  const rows = await d.list(
    table,
    [new ConditionTreeLeaf('reference', 'StartsWith', start)],
    ['reference'],
  );
  let last = Math.max(0, ...rows.map(r => Number(r.reference.slice(start.length)) || 0));

  return () => {
    last += 1;

    return `${start}${String(last).padStart(6, '0')}`;
  };
}

async function nextReference(d, table, prefix) {
  return (await referenceMaker(d, table, prefix))();
}

// ---------------------------------------------------------------------------------------------
// Customers, people and accounts
// ---------------------------------------------------------------------------------------------

const PERSON_FIELDS = ['id', 'first_name', 'last_name', 'date_of_birth', 'nationality'];
const PERSON_FLAGS = [...PERSON_FIELDS, 'is_sanctioned'];

/** The case's customer, its people (holders, and owners and directors of a company), its company. */
async function caseParties(d, kyc) {
  const customer = await d.one('customers', kyc.customer_id, [
    'id',
    'status',
    'customer_type',
    'business_id',
    'display_name',
  ]);
  const holders = await d.list(
    'customer_members',
    [eq('customer_id', customer.id), new ConditionTreeLeaf('until', 'Missing')],
    ['individual_id', 'is_primary_contact'],
  );
  const business = await d.one('businesses', customer.business_id, [
    'id',
    'legal_name',
    'trading_name',
    'country',
    'is_sanctioned',
    'accepts_card_payments',
  ]);
  const members = business
    ? await d.list(
        'business_members',
        [eq('business_id', business.id), new ConditionTreeLeaf('until', 'Missing')],
        ['individual_id'],
      )
    : [];
  const ids = [...new Set([...holders, ...members].map(m => m.individual_id).filter(Boolean))];
  const people = ids.length ? await d.list('individuals', [eq('id', ids)], PERSON_FLAGS) : [];
  const contact = holders.find(h => h.is_primary_contact) || holders[0];

  return { customer, business, people, contactId: contact?.individual_id || ids[0] || null };
}

/** The account a fraud team freezes first: the oldest current or business account still open. */
async function mainAccount(d, customerId) {
  const accounts = await d.list(
    'accounts',
    [eq('customer_id', customerId), not('type', 'SAVINGS'), not('status', 'CLOSED')],
    ['id', 'iban', 'status', 'freeze_reason'],
    { field: 'opened_at', ascending: true },
  );

  return accounts[0] || null;
}

/** Same rules as 'Freeze account' on accounts. Returns an error message, or null when done. */
async function freeze(d, account, reason, note) {
  if (account.status === 'FROZEN' || account.status === 'CLOSED') {
    return `Account ${account.iban} is ${account.status.toLowerCase()} already.`;
  }

  await d.update('accounts', [eq('id', account.id)], {
    status: 'FROZEN',
    frozen_at: now(),
    freeze_reason: reason,
    freeze_note: note || null,
  });

  return null;
}

/** Same rules as 'Unfreeze account' on accounts. Returns an error message, or null when done. */
async function unfreeze(d, account) {
  if (account.status !== 'FROZEN') return `Account ${account.iban} is not frozen.`;

  await d.update('accounts', [eq('id', account.id)], {
    status: 'ACTIVE',
    frozen_at: null,
    freeze_reason: null,
    freeze_note: null,
  });

  return null;
}

// ---- the account a new customer gets on approval ----------------------------------------------

// What the seed opens for an approved customer (retail.ts accountRows, onboarding-funnel.ts):
// a current account, or a business one. At zero, no overdraft until it has a history.
const FIRST_ACCOUNT = {
  RETAIL: { type: 'CURRENT', purpose: 'DAILY_BANKING', plan: 'STANDARD' },
  BUSINESS: {
    type: 'BUSINESS',
    name: 'Compte professionnel',
    purpose: 'BUSINESS_OPERATIONS',
    plan: 'BUSINESS_PRO',
  },
};
// Who gets a card on it: the people who can pay from it (banking.ts holdersOf).
const CARD_ROLES = ['HOLDER', 'JOINT_HOLDER', 'SIGNATORY'];
const accountNumberOf = iban => Number(String(iban).replace(/ /g, '').slice(14, 25)) || 0;
const randomDigits = n => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const plainUpper = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

/** The next account number at the bank: after the highest it gave, as the seed numbers them. */
async function nextAccountNumber(d) {
  const ours = await d.list('accounts', [eq('bic', BIC)], ['iban']);

  return (
    Math.max(0, ...ours.map(a => accountNumberOf(a.iban))) + 7 + Math.floor(Math.random() * 85)
  );
}

/** A physical card ordered for one holder: PENDING until it arrives and is activated. */
function orderedCard(account, customerId, holder, at) {
  const expires = new Date(Date.parse(at) + 3 * 365 * DAY);

  return {
    customer_id: customerId,
    account_id: account.id,
    holder_id: holder.id,
    card_type: 'PHYSICAL',
    network: Math.random() < 0.6 ? 'VISA' : 'MASTERCARD',
    embossed_name: plainUpper(fullName(holder)).slice(0, 26),
    last_four_digits: randomDigits(4),
    card_token: `tok_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    issued_at: at,
    expires_at: dateOnly(expires.toISOString()),
    activated_at: null,
    status: 'PENDING',
    blocked_at: null,
    blocked_reason: null,
    replaces_card_id: null,
  };
}

/**
 * Opens the new customer's account the moment the onboarding is approved, as a neobank does: a
 * French IBAN at the bank, ACTIVE, balance 0 until the first deposit, and a card ordered for each
 * holder. Nothing when the customer has an account open already. Returns { account, cards }.
 */
async function openFirstAccount(d, customer) {
  const open = await d.list(
    'accounts',
    [eq('customer_id', customer.id), not('status', 'CLOSED')],
    ['id'],
  );
  const kind = FIRST_ACCOUNT[customer.customer_type];
  if (open.length || !kind) return null;
  const members = await d.list(
    'customer_members',
    [
      eq('customer_id', customer.id),
      eq('role', CARD_ROLES),
      new ConditionTreeLeaf('until', 'Missing'),
    ],
    ['individual_id', 'is_primary_contact'],
  );
  const ids = members
    .sort((a, b) => b.is_primary_contact - a.is_primary_contact)
    .map(m => m.individual_id)
    .filter(Boolean);
  const holders = ids.length
    ? (await d.list('individuals', [eq('id', ids)], ['id', 'first_name', 'last_name'])).sort(
        (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id),
      )
    : [];
  const at = now();
  const account = await d.create('accounts', {
    customer_id: customer.id,
    iban: frenchIban(await nextAccountNumber(d)),
    bic: BIC,
    name: kind.name || (holders.length > 1 ? 'Compte joint' : 'Compte courant'),
    purpose: kind.purpose,
    type: kind.type,
    currency: 'EUR',
    plan: kind.plan,
    balance: 0,
    available_balance: 0,
    overdraft_limit: 0,
    status: 'ACTIVE',
    opened_at: at,
    last_activity_at: at,
    closed_at: null,
    frozen_at: null,
    freeze_reason: null,
    freeze_note: null,
    interest_rate: null,
  });
  const cards = [];

  for (const holder of holders) {
    // eslint-disable-next-line no-await-in-loop
    cards.push(await d.create('cards', orderedCard(account, customer.id, holder, at)));
  }

  return { account, cards };
}

/** "Visa ending 4821 for CAMILLE ROUSSEAU, on its way" */
const cardLine = cards =>
  cards
    .map(
      c =>
        `${c.network === 'VISA' ? 'Visa' : 'Mastercard'} ending ${c.last_four_digits} for ${
          c.embossed_name
        }`,
    )
    .join(', ');

const TX_FIELDS = ['id', 'account_id', 'amount', 'status', 'direction', 'rail', 'reference'];

/**
 * Books a HELD payment. A held debit already counts as pending (available_balance is lower), so
 * booking it only lowers the balance. A held credit was not counted anywhere: both go up.
 */
async function bookHeld(d, tx) {
  const account = await d.one('accounts', tx.account_id, ['id', 'balance', 'available_balance']);
  const amount = money(tx.amount);
  const balance = money(account.balance + (tx.direction === 'DEBIT' ? -amount : amount));
  const available = money(account.available_balance + (tx.direction === 'DEBIT' ? 0 : amount));
  await d.update('accounts', [eq('id', account.id)], { balance, available_balance: available });
  await d.update('transactions', [eq('id', tx.id)], {
    status: 'BOOKED',
    booked_at: now(),
    value_date: dateOnly(now()),
    balance_after: balance,
  });
  await d.update('outgoing_transfers', [eq('transaction_id', tx.id)], {
    validation_status: 'APPROVED',
    validated_by: d.email,
    validated_at: now(),
  });
}

/** Rejects a HELD debit: the money was set aside, so the available balance gets it back. */
async function rejectHeld(d, tx, reason) {
  const account = await d.one('accounts', tx.account_id, ['id', 'available_balance']);
  const available = money(account.available_balance + money(tx.amount));
  await d.update('accounts', [eq('id', account.id)], { available_balance: available });
  await d.update('transactions', [eq('id', tx.id)], { status: 'REJECTED', status_reason: reason });
  await d.update('outgoing_transfers', [eq('transaction_id', tx.id)], {
    validation_status: 'REJECTED',
    rejection_reason: reason,
    validated_by: d.email,
    validated_at: now(),
  });
}

// ---------------------------------------------------------------------------------------------
// KYC cases
// ---------------------------------------------------------------------------------------------

/** Moves a case to another status, with its line in the history. */
async function moveCase(d, kyc, status, reason, patch = {}) {
  if (kyc.status === status) return;
  await d.update('kyc_cases', [eq('id', kyc.id)], { status, updated_at: now(), ...patch });
  await logStatus(d, 'kyc_cases', kyc.id, kyc.status, status, reason);
}

const KYC_FIELDS = [
  'id',
  'reference',
  'status',
  'type',
  'customer_id',
  'risk_before',
  'assigned_to',
];

/**
 * The case an action runs on, now in the hands of whoever runs it: a waiting case moves to
 * IN_REVIEW, and the case is assigned to the caller, with a history line when it changes hands (a
 * senior signing off, a person taking a file over from the robot). Taking a task in a Forest inbox
 * is recorded by Forest, not in this data: the first action run on the case writes it here.
 */
async function openCase(context) {
  const kyc = await context.getRecord(KYC_FIELDS);
  const closed = CLOSED_CASE.includes(kyc.status);
  if (closed) return { kyc, error: `${kyc.reference} is ${kyc.status.toLowerCase()} already.` };
  const d = db(context);
  const me = context.caller?.email || null;
  const patch = me && kyc.assigned_to !== me ? { assigned_to: me } : {};

  if (kyc.status === 'OPEN') {
    await moveCase(d, kyc, 'IN_REVIEW', `Review started${me ? ` by ${me}` : ''}`, patch);
  } else if (patch.assigned_to) {
    await d.update('kyc_cases', [eq('id', kyc.id)], { ...patch, updated_at: now() });
  }

  if (patch.assigned_to) {
    await d.create('status_changes', {
      record_type: 'KYC_CASES',
      record_id: kyc.id,
      field: 'assigned_to',
      old_value: kyc.assigned_to || null,
      new_value: me,
      changed_by: me,
      changed_at: now(),
      reason: kyc.assigned_to ? `Taken over from ${kyc.assigned_to}` : 'Case taken',
    });
  }

  const status = kyc.status === 'OPEN' ? 'IN_REVIEW' : kyc.status;

  return { kyc: { ...kyc, status, ...patch }, error: null };
}

/** Watchlist names and aliases, normalized. */
const namesOf = entry => [entry.name, ...String(entry.aliases || '').split(/[;,]/)].map(normalize);

/** One possible match: a name on the list, scored on the birth date and the country too. */
function scoreMatch(entry, subject) {
  const sameBirth = subject.birth && String(entry.date_of_birth || '') === String(subject.birth);
  const sameCountry = subject.country && entry.country === subject.country;
  const on = ['Name', sameBirth && 'date of birth', sameCountry && 'nationality'].filter(Boolean);

  return { score: 78 + (sameBirth ? 15 : 0) + (sameCountry ? 7 : 0), matchedOn: on.join(', ') };
}

/** The names to screen: each person, and the company under its legal and trading names. */
function subjectsOf({ people, business }) {
  const persons = people.map(p => ({
    key: { individual_id: p.id },
    entityType: 'PERSON',
    names: [fullName(p)],
    birth: p.date_of_birth,
    country: p.nationality,
  }));
  if (!business) return persons;

  return [
    ...persons,
    {
      key: { business_id: business.id },
      entityType: 'ENTITY',
      names: [business.legal_name, business.trading_name].filter(Boolean),
      country: business.country,
    },
  ];
}

function findMatches(subjects, entries) {
  return subjects.flatMap(subject =>
    entries
      .filter(e => e.entity_type === subject.entityType)
      .filter(e => subject.names.some(n => namesOf(e).includes(normalize(n))))
      .map(entry => ({ subject, entry, ...scoreMatch(entry, subject) })),
  );
}

async function createHits(d, kyc, matches) {
  const reference = await referenceMaker(d, 'screening_hits', 'HIT');
  const created = [];
  await matches.reduce(async (previous, { subject, entry, score, matchedOn }) => {
    await previous;
    const [field, id] = Object.entries(subject.key)[0];
    // Like a real screening tool: an open hit is not doubled, a cleared namesake is not reopened.
    const earlier = await d.list(
      'screening_hits',
      [eq(field, id), eq('watchlist_entry_id', entry.id), eq('status', ['OPEN', 'FALSE_POSITIVE'])],
      ['reference', 'status'],
    );
    const known = earlier.find(h => h.status === 'OPEN') || earlier[0];

    if (known) {
      const state = known.status === 'OPEN' ? 'already open' : 'cleared before as a false positive';
      created.push(`${subject.names[0]}: ${known.reference} ${state}`);

      return;
    }

    const hit = await d.create('screening_hits', {
      ...subject.key,
      watchlist_entry_id: entry.id,
      match_score: score,
      status: 'OPEN',
      reference: reference(),
      created_at: now(),
      screened_name: subject.names[0],
      trigger: kyc.type === 'ONBOARDING' ? 'ONBOARDING' : 'DAILY_RESCREENING',
      matched_on: matchedOn,
      hit_type: entry.list === 'PEP' ? 'PEP' : 'SANCTIONS',
      entity_type: subject.entityType,
    });
    await logStatus(d, 'screening_hits', hit.id, null, 'OPEN', `Screening of ${kyc.reference}`);
    created.push(
      `${subject.names[0]} matches ${entry.list} entry "${entry.name}" (${hit.reference})`,
    );
  }, Promise.resolve());

  return created;
}

const LISTS_SEARCHED = 'EU, UN, OFAC, UK HMT (and PEP)';

/** One row per name screened: its best match on the lists, or none. */
function screeningCard(check, subjects, matches, lines) {
  const rows = subjects.map(subject => {
    const found = matches.filter(m => m.subject === subject).sort((a, b) => b.score - a.score)[0];
    const kind = subject.entityType === 'PERSON' ? 'Person' : 'Company';
    if (!found) return [subject.names[0], kind, { html: badge('No match', 'green') }, '—'];

    const tone = found.score >= 90 ? 'red' : 'amber';
    const result = badge(`${found.entry.list}: ${found.entry.name}`, tone);

    return [subject.names[0], kind, { html: result }, `${found.score}% (${found.matchedOn})`];
  });

  return card({
    eyebrow: resultsFrom(PROVIDERS.screening, 'sanctions and PEP screening'),
    title: `Sanctions and PEP screening · ${check}`,
    status: matches.length ? [`${matches.length} possible match(es)`, 'amber'] : ['Clear', 'green'],
    rows: [
      ['Lists searched', LISTS_SEARCHED],
      ['Names screened', String(subjects.length)],
      ['Screened at', frStamp(now())],
    ],
    list: { head: ['Name', 'Type', 'Result', 'Match score'], rows },
    note: lines.length ? `Hits to review: ${lines.join('; ')}.` : 'No hit created.',
  });
}

/** One row per paper: what it is, whose, received and valid or why not. */
function documentsCard(kyc, rows) {
  const missing = rows.filter(r => !r.ok);

  const result = r => {
    let text = r.ok ? 'Valid' : 'Missing or invalid';
    if (r.tone === 'grey') text = 'Not needed';

    return { html: badge(text, r.tone) };
  };

  return card({
    eyebrow: 'Document check · the papers on file against the onboarding rules',
    title: `Documents · ${kyc.reference}`,
    status: missing.length ? [`${missing.length} to ask for`, 'amber'] : ['Complete', 'green'],
    rows: [
      ['Papers checked', String(rows.length)],
      ['Rules', 'ID valid, selfie for a remote application, proof of address under 3 months'],
      ['Checked at', frStamp(now())],
    ],
    list: {
      head: ['Paper', 'Whose', 'Result', 'Details'],
      rows: rows.map(r => [r.what, r.who, result(r), r.details]),
    },
    note: missing.length
      ? 'Request missing documents asks the client for these, pre-filled.'
      : 'Every paper the application needs is on file and valid.',
  });
}

async function checkDocuments(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const checked = await documentCheck(reader(context.dataSource), kyc);
  if (!checked) return resultBuilder.error(`${kyc.reference} has nobody to check papers for.`);
  const missing = checked.rows.filter(r => !r.ok);
  // The case file shows its "Documents ·" fields from this line on (case-file.ts, checksRun).
  await d.create('status_changes', {
    record_type: 'KYC_CASES',
    record_id: kyc.id,
    field: 'documents',
    old_value: null,
    new_value: missing.length ? `${missing.length} missing or invalid` : 'Complete',
    changed_by: d.email,
    changed_at: now(),
    reason: `${checked.rows.length} papers checked`,
  });

  return resultBuilder.success(
    missing.length
      ? `${kyc.reference}: ${missing.length} paper(s) to ask for: ${missing
          .map(r => `${r.what} (${r.details})`)
          .join('; ')}.`
      : `${kyc.reference}: every paper is on file and valid.`,
    { html: documentsCard(kyc, checked.rows) },
  );
}

async function screenCase(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const subjects = subjectsOf(await caseParties(d, kyc));
  const entries = await d.list(
    'watchlist_entries',
    [new ConditionTreeLeaf('delisted_at', 'Missing')],
    ['id', 'list', 'name', 'aliases', 'country', 'date_of_birth', 'entity_type'],
  );
  const checkId = `SCR-${hex(kyc.id, 10)}`;
  const check = `check ${checkId}`;
  const screened = subjects.map(s => s.names[0]).join(', ');
  const matches = findMatches(subjects, entries);
  // The case file shows its screening fields from this line on (case-file.ts, checksRun).
  await d.create('status_changes', {
    record_type: 'KYC_CASES',
    record_id: kyc.id,
    field: 'screening',
    old_value: null,
    new_value: matches.length ? `${matches.length} possible match(es)` : 'No match',
    changed_by: d.email,
    changed_at: now(),
    reason: `${PROVIDERS.screening}, ${check}`,
  });

  if (!matches.length) {
    return resultBuilder.success(
      `No match for ${screened} (${PROVIDERS.screening}, simulated, ${check}).`,
      {
        html: screeningCard(checkId, subjects, matches, []),
      },
    );
  }

  const lines = await createHits(d, kyc, matches);

  return resultBuilder.success(
    `${matches.length} possible match(es) (${
      PROVIDERS.screening
    }, simulated, ${check}): ${lines.join('; ')}.`,
    { html: screeningCard(checkId, subjects, matches, lines) },
  );
}

/** The flaw render.ts draws on an ID (random.ts scanFlaw: same seed, so the same picture). */
const drawnFlaw = scanFlaw;

const FLAW_OUTCOME = {
  clean: ['PASSED', null],
  glare: ['PASSED', null],
  cropped: ['MANUAL_REVIEW', 'Document cut off: one edge of the card is missing'],
  name: ['FAILED', 'Name on the document differs from the application'],
};

/** What the ID provider answers, from the document itself: never random. */
function idCheck(doc) {
  if (doc.expires_at && String(doc.expires_at) < now()) {
    return ['FAILED', `Document expired on ${String(doc.expires_at).slice(0, 10)}`];
  }

  if (doc.check_result === 'FAILED') return ['FAILED', doc.failure_reason];

  return FLAW_OUTCOME[drawnFlaw(doc.id)];
}

const MARK = { ok: ['✓', 'green'], warn: ['⚠', 'amber'], bad: ['✗', 'red'] };
const RESULT_TONE = { PASSED: 'green', MANUAL_REVIEW: 'amber', FAILED: 'red' };
const OK_CHECKS = {
  mrz: ['ok', 'Read, checksums valid'],
  tamper: ['ok', 'No sign of editing'],
};
const FLAW_CHECKS = {
  clean: {},
  glare: { tamper: ['warn', 'Glare on the document number, still readable'] },
  cropped: { mrz: ['warn', 'One edge cut off: machine-readable zone read in part'] },
  name: { mrz: ['bad', 'Name in the machine-readable zone differs from the application'] },
};

/** The face match: the similarity the provider gives, low when the faces differ. */
function faceRow(doc, reason, otherFace) {
  const face = 86 + (parseInt(hex(`${doc.id}face`, 4), 16) % 12);

  return otherFace
    ? ['bad', `${reason} (${20 + (face % 25)}% similarity)`]
    : ['ok', `${face}% similarity`];
}

/** What the provider looked at, from the same facts as idCheck(): never random. */
function idCheckRows(doc, reason) {
  const expiry = doc.expires_at ? String(doc.expires_at).slice(0, 10) : null;
  const expired = expiry && String(doc.expires_at) < now();
  const failedBefore = !expired && doc.check_result === 'FAILED';
  const flaw = expired || failedBefore ? {} : FLAW_CHECKS[drawnFlaw(doc.id)];
  const checks = { ...OK_CHECKS, ...flaw };
  // The faces differ: the ID itself reads fine, the face match fails.
  const otherFace = !expired && /selfie/i.test(reason || '');

  if (failedBefore && !otherFace) {
    checks[/name/i.test(reason) ? 'mrz' : 'tamper'] = ['bad', reason || 'Failed'];
  }

  const rows = [
    ['MRZ', checks.mrz],
    [
      'Expiry date',
      expired ? ['bad', reason] : ['ok', expiry ? `Valid until ${expiry}` : 'No expiry'],
    ],
    ['Face match with the selfie', faceRow(doc, reason, otherFace)],
    ['Tampering and image quality', checks.tamper],
  ];

  return rows.map(([name, [level, detail]]) => {
    const [mark, tone] = MARK[level];

    return [name, { html: badge(mark, tone) }, detail];
  });
}

function documentCard(doc, checkId, result, reason) {
  return card({
    eyebrow: resultsFrom(PROVIDERS.idCheck, 'ID verification'),
    title: `${label(doc.document_type)} · check ${checkId}`,
    status: [result.replace('_', ' '), RESULT_TONE[result]],
    rows: [
      ['Document type', label(doc.document_type)],
      ['Overall result', reason ? `${result}: ${reason}` : result],
    ],
    list: { head: ['Check', '', 'Detail'], rows: idCheckRows(doc, reason) },
  });
}

const ID_DOC_FIELDS = [
  'id',
  'document_type',
  'individual_id',
  'kyc_case_id',
  'expires_at',
  'check_result',
  'failure_reason',
  'provider_check_id',
];

/**
 * The ID provider's check on some ID documents, recorded now. A passed ID also passes its
 * person's selfie still waiting (the provider matched the face). Shared by the case and document
 * actions, so they never disagree.
 */
async function runIdChecks(d, docs) {
  return Promise.all(
    docs.map(async doc => {
      const [result, reason] = idCheck(doc);
      const checkId = doc.provider_check_id || `IDV-${hex(doc.id, 12)}`;
      const stamp = { verified_at: now(), verified_by: d.email, provider_check_id: checkId };
      await d.update('documents', [eq('id', doc.id)], {
        check_result: result,
        failure_reason: reason,
        verified: result === 'PASSED',
        ...stamp,
      });
      // The selfie passes with its ID, or fails with it when the faces differ (as the seed does).
      const faceFailed = result === 'FAILED' && reason === REFUSAL.IDENTITY_FAILED;

      if ((result === 'PASSED' || faceFailed) && doc.individual_id && doc.kyc_case_id) {
        await d.update(
          'documents',
          [
            eq('kyc_case_id', doc.kyc_case_id),
            eq('individual_id', doc.individual_id),
            eq('document_type', 'SELFIE'),
            notChecked(),
          ],
          faceFailed
            ? { check_result: 'FAILED', failure_reason: reason, verified: false, ...stamp }
            : { check_result: 'PASSED', verified: true, ...stamp },
        );
      }

      return { doc, checkId, result, reason };
    }),
  );
}

function idCheckResult(checks) {
  const what = checks
    .map(
      c =>
        `ID check ${c.result} on the ${label(c.doc.document_type)}${
          c.reason ? `: ${c.reason}` : ''
        }`,
    )
    .join('; ');

  return {
    message: `${what} (${PROVIDERS.idCheck}, simulated).`,
    html: checks.map(c => documentCard(c.doc, c.checkId, c.result, c.reason)).join(''),
  };
}

async function verifyDocument(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const docs = await d.list(
    'documents',
    [eq('kyc_case_id', kyc.id), eq('document_type', ID_TYPES)],
    ID_DOC_FIELDS,
    { field: 'uploaded_at', ascending: false },
  );

  if (!docs.length) {
    return resultBuilder.error(`No ID document on ${kyc.reference}: run "Request ID document".`);
  }

  // Every ID not checked yet (a company has several directors); else re-check one that failed or
  // that the provider could not read.
  const waiting = docs.filter(waitsForCheck);
  const targets = waiting.length
    ? waiting
    : docs.filter(x => ['FAILED', 'MANUAL_REVIEW'].includes(x.check_result)).slice(0, 1);

  // Nothing left to check is an answer, not an error: a workflow step moves on with it.
  if (!targets.length) {
    return resultBuilder.success(
      `All ID documents on ${kyc.reference} passed their ID check already (${docs
        .map(doc => label(doc.document_type))
        .join(', ')}).`,
    );
  }

  const { message, html } = idCheckResult(await runIdChecks(d, targets));

  return resultBuilder.success(message, { html });
}

/** Opens a request for information on the case, unless one is still waiting for an answer. */

/** Opens a request for information on the case, unless one is still waiting for an answer.
 * Either way the case now waits on the client, out of the work queue. */
async function requestInformation(d, kyc, parties, questions) {
  const waiting = await d.list(
    'information_requests',
    [eq('kyc_case_id', kyc.id), eq('status', OPEN_REQUEST)],
    ['reference', 'questions', 'sent_at', 'due_at'],
  );

  if (waiting.length) {
    await moveCase(d, kyc, 'WAITING_CUSTOMER', `${waiting[0].reference} waiting for an answer`);

    return {
      error: `${waiting[0].reference} is still waiting for an answer.`,
      waiting: waiting[0],
    };
  }

  const request = await d.create('information_requests', {
    customer_id: kyc.customer_id,
    context: 'KYC_CASE',
    addressed_to_id: parties.contactId,
    kyc_case_id: kyc.id,
    channel: 'APP',
    questions,
    requested_by: d.email,
    sent_at: now(),
    due_at: inDays(14),
    reminders_sent: 0,
    status: 'SENT',
    reference: await nextReference(d, 'information_requests', 'RFI'),
    created_at: now(),
  });
  await logStatus(d, 'information_requests', request.id, null, 'SENT', `For ${kyc.reference}`);
  await moveCase(d, kyc, 'WAITING_CUSTOMER', `${request.reference} sent`);

  return { request };
}

/** The result card of a request sent on a KYC case. */
function requestCard(kyc, parties, request) {
  const contact = parties.people.find(p => p.id === parties.contactId);

  return card({
    eyebrow: `Request for information · ${kyc.reference}`,
    title: `${request.reference} sent`,
    status: ['Waiting on the client', 'amber'],
    rows: [
      ['Customer', parties.customer.display_name],
      ['Addressed to', contact ? fullName(contact) : null],
      ['Channel', 'In the app'],
      ['Asked', request.questions],
      ['Sent', frDate(request.sent_at)],
      ['Answer due', frDate(request.due_at)],
      [
        'Case',
        kyc.status === 'WAITING_CUSTOMER'
          ? 'waiting on the client'
          : `${label(kyc.status)} → waiting on the client`,
      ],
    ],
    note:
      'The case leaves the onboarding queue; the request shows in "Waiting on the client" until ' +
      'the answer comes in.',
  });
}

/** What a request still out asks for, in two words. */
function askedFor(questions) {
  const q = String(questions || '');
  if (/money you plan|source of funds|where the money/i.test(q)) return 'proof of funds';
  if (/passport|ID card|ID document/i.test(q)) return 'ID document';
  if (/proof of address/i.test(q)) return 'proof of address';
  if (/Kbis|business account|company/i.test(q)) return 'company documents';

  return 'documents';
}

/** One request at a time: the new one waits for the answer to the request still out. */
function notSent(kyc, parties, waiting, what) {
  const message = `Nothing sent: the ${what} goes out once ${waiting.reference} (${askedFor(
    waiting.questions,
  )}) is answered.`;
  const html = card({
    eyebrow: `Request for information · ${kyc.reference}`,
    title: `Nothing sent: ${waiting.reference} is still open`,
    status: ['Waiting on the client', 'amber'],
    rows: [
      ['Customer', parties.customer.display_name],
      ['Open request', `${waiting.reference} · ${askedFor(waiting.questions)}`],
      ['It asks', waiting.questions],
      ['Answer due', frDate(waiting.due_at)],
    ],
    note: message,
  });

  return { message, html };
}

async function sendForSignoff(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const reason = context.formValues.Reason || 'Medium or high risk: senior sign-off';
  await moveCase(d, kyc, 'PENDING_APPROVAL', reason, {
    escalated_at: now(),
    escalation_reason: reason,
  });

  return resultBuilder.success(
    `${kyc.reference} waits for a senior's sign-off, out of the onboarding queue: ${reason}.`,
  );
}

async function requestIdDocument(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const parties = await caseParties(d, kyc);
  // The reason the ID check gave: a failed ID, or one it could not read (cut off).
  const [failed] = await d.list(
    'documents',
    [
      eq('kyc_case_id', kyc.id),
      eq('document_type', ID_TYPES),
      eq('check_result', ['FAILED', 'MANUAL_REVIEW']),
      new ConditionTreeLeaf('failure_reason', 'Present'),
    ],
    ['failure_reason'],
  );
  const why = failed?.failure_reason ? ` (${failed.failure_reason.toLowerCase()})` : '';
  const questions =
    `Please upload a new photo of your passport or national ID card: the one we received could ` +
    `not be verified${why}. Make sure the whole card is visible, without glare.`;
  const { request, waiting } = await requestInformation(d, kyc, parties, questions);

  if (waiting) {
    const { message, html } = notSent(kyc, parties, waiting, 'ID request');

    return resultBuilder.success(message, { html });
  }

  return resultBuilder.success(
    `${request.reference} sent: new ID document asked, due in 14 days.`,
    { html: requestCard(kyc, parties, request) },
  );
}

async function requestCompanyDocuments(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const parties = await caseParties(d, kyc);
  if (!parties.business) return resultBuilder.error(`${kyc.reference} is not a company case.`);

  // The same checklist the reviewer reads: missing, failed, or a Kbis older than 3 months.
  const missing = (await companyDocuments(d.list, kyc, parties.business)).filter(doc => !doc.ok);

  if (!missing.length) {
    return resultBuilder.error(
      `All company documents of ${parties.business.legal_name} are on file and valid.`,
    );
  }

  const list = missing
    .map(doc =>
      doc.line.includes('older than')
        ? `a Kbis extract less than 3 months old`
        : doc.name.toLowerCase(),
    )
    .join(', ');
  const questions = `To open your business account we still need: ${list}. Please upload them in the app.`;
  const { request, waiting } = await requestInformation(d, kyc, parties, questions);

  // A request still waiting already asks the company: say so, the case waits all the same.
  if (waiting) {
    const { message, html } = notSent(kyc, parties, waiting, 'request for company documents');

    return resultBuilder.success(message, { html });
  }

  return resultBuilder.success(`${request.reference} sent: ${list} asked, due in 14 days.`, {
    html: requestCard(kyc, parties, request),
  });
}

/** The request a retail applicant gets: what Documents · Complete lacks, else a proof of funds. */
async function missingDocumentsQuestions(d, kyc) {
  const found = await applicantRequest(d.list, kyc);
  if (!found?.asks.length) return null;

  return `To open your account we still need: ${found.asks.join('; ')}. Please upload ${
    found.asks.length > 1 ? 'them' : 'it'
  } in the app.`;
}

async function defaultQuestions(context) {
  const d = db(context);

  return (await missingDocumentsQuestions(d, await context.getRecord(KYC_FIELDS))) || '';
}

async function requestMissingDocuments(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const parties = await caseParties(d, kyc);

  if (parties.business) {
    return resultBuilder.error(
      `${kyc.reference} is a company case: run "Request company documents".`,
    );
  }

  const questions = context.formValues.Questions || (await missingDocumentsQuestions(d, kyc));

  if (!questions) {
    return resultBuilder.error(
      `Nothing to ask on ${kyc.reference}: every document is on file and valid.`,
    );
  }

  const { request, waiting } = await requestInformation(d, kyc, parties, questions);

  if (waiting) {
    const { message, html } = notSent(kyc, parties, waiting, 'new request');

    return resultBuilder.success(message, { html });
  }

  return resultBuilder.success(
    `${request.reference} sent in the app, due in 14 days: "${questions}"`,
    { html: requestCard(kyc, parties, request) },
  );
}

/** Checks a reserve: share held 5 to 20%, for 90 to 180 days. Returns an error or null. */
function reserveError(pct, days) {
  if (pct !== undefined && pct !== null && (pct < 5 || pct > 20)) {
    return 'The share held must be between 5 and 20%.';
  }

  if (days !== undefined && days !== null && (days < 90 || days > 180)) {
    return 'The reserve must be held between 90 and 180 days.';
  }

  return null;
}

async function companyOfCase(context) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return { error };

  const { business } = await caseParties(d, kyc);
  if (!business) return { error: `${kyc.reference} is not a company case.` };

  return { d, kyc, business };
}

// ---------------------------------------------------------------------------------------------
// Company register (INPI): the register's answer, compared with our file
// ---------------------------------------------------------------------------------------------

/** The 7 points INPI holds, next to our file: [what, at INPI, in our file]. */
function registerLines(business, register, own) {
  const directors = own.perPerson
    .filter(p => p.rows.some(r => ['DIRECTOR', 'MANAGER'].includes(r.role)))
    .map(p => fullName(p.person))
    .join(', ');
  // With nobody above 25%, the register names the legal representative by default.
  const ubos = own.ubos
    .map(
      u =>
        `${fullName(u.person)} ${
          own.byDefault ? '(legal representative)' : `${Math.round(u.owned)}%`
        }`,
    )
    .join(', ');
  const city = `${business.postal_code} ${business.city}`;
  const same = value => [value, value];

  return [
    ['Legal name', ...same(business.legal_name)],
    ['Legal form', ...same(business.legal_form)],
    ['SIREN', ...same(business.registration_number)],
    ['Created', ...same(frDate(business.incorporation_date))],
    ['Registered office', `${register.office}, ${city}`, `${business.address_line1}, ${city}`],
    ['Directors', ...same(directors || '—')],
    ['Beneficial owners (RBE)', ...same(ubos || '—')],
  ];
}

/** Why the Kbis on file fails the register check, or '' when it passes. */
function kbisFault(kbis, register) {
  const stale = kbis && (Date.now() - new Date(kbis.issued_at).getTime()) / DAY > KBIS_MAX_DAYS;
  const filing =
    register.filing &&
    `${register.filing.what.toLowerCase()} filed on ${frDate(register.filing.filed)}`;

  return [stale && 'older than 3 months', filing].filter(Boolean).join('; ');
}

/** The verdict on each company paper, stamped with the moment of the check. */
function recordVerdicts(d, papers, fault, requestId) {
  return Promise.all(
    papers.map(doc => {
      const failed = doc.document_type === 'COMPANY_REGISTRATION' && fault;

      return d.update('documents', [eq('id', doc.id)], {
        check_result: failed ? 'FAILED' : 'PASSED',
        failure_reason: failed ? `INPI register: ${fault}` : null,
        verified: !failed,
        verified_at: now(),
        verified_by: d.email,
        provider_check_id: requestId,
      });
    }),
  );
}

function registerCard({ business, register, kbis, lines, papers, fault, requestId, finding }) {
  const differs = lines.filter(([, a, b]) => a !== b).length;
  const recorded = papers
    .map(doc => {
      const failed = doc.document_type === 'COMPANY_REGISTRATION' && fault;

      return `${label(doc.document_type)} ${failed ? 'failed' : 'passed'}`;
    })
    .join(', ');

  return card({
    eyebrow: resultsFrom(PROVIDERS.register, 'company register and register of beneficial owners'),
    title: `${business.legal_name} · SIREN ${business.registration_number}`,
    status: differs ? [`${differs} difference(s)`, 'amber'] : ['Matches our file', 'green'],
    rows: [
      ['Request', requestId],
      ['Company status', 'Active (registered, not struck off)'],
      [
        'Last filing',
        register.filing
          ? `${register.filing.what}, ${frDate(register.filing.filed)}`
          : 'None since the Kbis on file',
      ],
      ['Kbis on file', kbis ? `issued ${frDate(kbis.issued_at)}` : 'none received'],
      ['Recorded on the papers', recorded || 'no company paper on file'],
    ],
    list: {
      head: ['', 'At INPI', 'In our file (documents and customer)', ''],
      rows: lines.map(([what, atInpi, ours]) => [
        what,
        atInpi,
        ours,
        { html: atInpi === ours ? badge('✓ Match', 'green') : badge('⚠ Different', 'amber') },
      ]),
    },
    note: finding,
  });
}

/**
 * INPI's answer for a company, compared with our file, and its verdict recorded on the case's
 * company papers now: the Kbis passes when it is fresh and nothing was filed since; the articles
 * and the beneficial owners declaration pass when on file (the register holds the same).
 */
async function registerCheck(d, kyc, found) {
  const business = await d.one('businesses', found.id, [
    'id',
    'legal_name',
    'legal_form',
    'registration_number',
    'incorporation_date',
    'address_line1',
    'postal_code',
    'city',
  ]);
  const papers = await d.list(
    'documents',
    [
      eq('kyc_case_id', kyc.id),
      eq('business_id', business.id),
      eq('document_type', ['COMPANY_REGISTRATION', 'ARTICLES_OF_ASSOCIATION', 'UBO_DECLARATION']),
    ],
    ['id', 'document_type', 'issued_at'],
    { field: 'uploaded_at', ascending: false },
  );
  const kbis = papers.find(doc => doc.document_type === 'COMPANY_REGISTRATION');
  const own = await companyOwners(d.list, business);
  const register = registerOf(business, kbis);
  const lines = registerLines(business, register, own);
  const requestId = `RNE-${hex(business.id, 10)}`;
  const fault = kbisFault(kbis, register);
  await recordVerdicts(d, papers, fault, requestId);
  const finding = register.filing
    ? `${register.filing.what} filed on ${frDate(
        register.filing.filed,
      )}, after the Kbis on file (issued ${frDate(
        kbis.issued_at,
      )}): ask the company for a fresh Kbis.`
    : `The register matches our file on all ${lines.length} points.`;
  const html = registerCard({
    business,
    register,
    kbis,
    lines,
    papers,
    fault,
    requestId,
    finding,
  });

  return { html, message: `INPI register (${requestId}, simulated): ${finding}` };
}

async function checkRegister(context, resultBuilder) {
  const { d, kyc, business, error } = await companyOfCase(context);
  if (error) return resultBuilder.error(error);
  const { message, html } = await registerCheck(d, kyc, business);

  return resultBuilder.success(message, { html });
}

async function approveCardAcceptance(context, resultBuilder) {
  const { d, business, error } = await companyOfCase(context);
  if (error) return resultBuilder.error(error);

  const pct = context.formValues['Reserve (%)'];
  const days = context.formValues['Reserve (days)'];
  const invalid = reserveError(pct, days);
  if (invalid) return resultBuilder.error(invalid);

  const reserve = pct ? { reserve_pct: pct, reserve_days: days || 90 } : {};
  await d.update('businesses', [eq('id', business.id)], {
    accepts_card_payments: true,
    updated_at: now(),
    ...reserve,
  });
  const withReserve = pct ? `, ${pct}% held for ${reserve.reserve_days} days` : '';

  return resultBuilder.success(
    `Card acceptance approved for ${business.legal_name}${withReserve}.`,
  );
}

async function setReserve(context, resultBuilder) {
  const { d, business, error } = await companyOfCase(context);
  if (error) return resultBuilder.error(error);

  const pct = context.formValues['Share held (%)'];
  const days = context.formValues['Days held'];
  const invalid = reserveError(pct, days);
  if (invalid) return resultBuilder.error(invalid);

  await d.update('businesses', [eq('id', business.id)], {
    accepts_card_payments: true,
    reserve_pct: pct,
    reserve_days: days,
    updated_at: now(),
  });

  return resultBuilder.success(
    `Card acceptance approved for ${business.legal_name} with a reserve: ${pct}% of sales held for ${days} days.`,
  );
}

/** An ID not checked yet, or one the provider could not read: no approval before it is settled. */
function idBlocker(docs) {
  const unchecked = docs.find(
    doc =>
      ID_TYPES.includes(doc.document_type) &&
      (waitsForCheck(doc) || doc.check_result === 'MANUAL_REVIEW'),
  );
  if (!unchecked) return null;

  return waitsForCheck(unchecked)
    ? `the ${label(unchecked.document_type)} is not verified yet: run "Verify document".`
    : `the ${label(unchecked.document_type)} needs a closer look (${
        unchecked.failure_reason || 'the provider could not read it'
      }).`;
}

/** Why a case cannot be approved: an open hit, a sanctioned party or a failed document. */
async function approvalBlocker(d, kyc, { people, business }) {
  const subjects = [eq('individual_id', people.length ? people.map(p => p.id) : ['-'])];
  if (business) subjects.push(eq('business_id', business.id));
  const [hit] = await d.list(
    'screening_hits',
    [eq('status', 'OPEN'), ConditionTreeFactory.union(...subjects)],
    ['reference', 'screened_name'],
  );
  if (hit) return `${hit.reference} (${hit.screened_name}) is still open: review it first.`;

  const sanctioned = people.find(p => p.is_sanctioned);
  if (sanctioned) return `${fullName(sanctioned)} is under sanctions.`;
  if (business?.is_sanctioned) return `${business.legal_name} is under sanctions.`;

  if (business) {
    const missing = (await companyDocuments(d.list, kyc, business)).find(doc => !doc.ok);
    if (missing) return `the company file is not complete: ${missing.line.slice(2)}.`;
  } else if (kyc.type === 'ONBOARDING') {
    // The same checklist the reviewer reads: an ID, a selfie, a proof of address under 3 months.
    const missing = (await applicantRequest(d.list, kyc))?.papers.find(paper => !paper.ok);
    if (missing) return `the file is not complete: ${missing.line.slice(2)}.`;
  }

  const docs = await d.list(
    'documents',
    [eq('kyc_case_id', kyc.id)],
    ['document_type', 'individual_id', 'check_result', 'failure_reason'],
    { field: 'uploaded_at', ascending: true },
  );
  const latest = new Map<string, RecordData>(
    docs.map(doc => [`${doc.individual_id}:${doc.document_type}`, doc]),
  );
  const current = [...latest.values()];
  const failed = current.find(doc => doc.check_result === 'FAILED');

  if (failed) {
    return `the ${label(failed.document_type)} failed its check (${failed.failure_reason}).`;
  }

  return idBlocker(current);
}

/** What the case file shows: open hits, sanctions flags and the latest document of each kind. */
async function kycFindings(d, kyc, { people, business }) {
  const subjects = [eq('individual_id', people.length ? people.map(p => p.id) : ['-'])];
  if (business) subjects.push(eq('business_id', business.id));
  const hits = await d.list(
    'screening_hits',
    [ConditionTreeFactory.union(...subjects)],
    ['reference', 'status', 'screened_name', 'hit_type'],
  );
  const docs = await d.list(
    'documents',
    [eq('kyc_case_id', kyc.id)],
    [
      'document_type',
      'individual_id',
      'check_result',
      'failure_reason',
      'verified_by',
      'issued_at',
      'provider_check_id',
    ],
    { field: 'uploaded_at', ascending: true },
  );
  const latest = new Map<string, RecordData>(
    docs.map(doc => [`${doc.individual_id}:${doc.document_type}`, doc]),
  );
  const sanctioned = [
    ...people.filter(p => p.is_sanctioned).map(fullName),
    ...(business?.is_sanctioned ? [business.legal_name] : []),
  ];

  return { hits, docs: [...latest.values()], sanctioned };
}

/** The checks that did not pass, as sentences (the default reason of a rejection). */
function failedChecks({ hits, docs, sanctioned }) {
  return [
    ...sanctioned.map(name => `${name} is under sanctions`),
    ...hits
      .filter(h => ['OPEN', 'TRUE_MATCH'].includes(h.status))
      .map(h => `screening hit ${h.reference} on ${h.screened_name} (${label(h.status)})`),
    ...docs
      .filter(doc => doc.check_result === 'FAILED')
      .map(doc => `${label(doc.document_type)} failed: ${doc.failure_reason || 'no reason given'}`),
    ...docs.filter(waitsForCheck).map(doc => `${label(doc.document_type)} not checked yet`),
    ...docs
      .filter(doc => doc.check_result === 'MANUAL_REVIEW')
      .map(doc => `${label(doc.document_type)} could not be read by the check`),
  ];
}

/** Why the case ends, as a code (refusals.ts): from a failed paper, an unanswered request, or the
 * reviewer's judgement (risk appetite). */
async function defaultCode(d, kyc, findings) {
  const fromPaper = findings.docs
    .filter(doc => doc.check_result === 'FAILED')
    .map(doc => refusalOfPaper(doc.failure_reason))
    .find(Boolean);
  if (fromPaper) return fromPaper;
  const waiting = await d.list(
    'information_requests',
    [eq('kyc_case_id', kyc.id), eq('status', ['SENT', 'OVERDUE'])],
    ['id'],
  );

  return waiting.length ? 'NO_RESPONSE' : 'RISK_APPETITE';
}

async function defaultRejectionCode(context) {
  const d = db(context);
  const kyc = await context.getRecord(KYC_FIELDS);

  return defaultCode(d, kyc, await kycFindings(d, kyc, await caseParties(d, kyc)));
}

async function defaultRejection(context) {
  const d = db(context);
  const kyc = await context.getRecord(KYC_FIELDS);
  const failed = failedChecks(await kycFindings(d, kyc, await caseParties(d, kyc)));

  if (failed.length) return `Rejected after review: ${failed.join('; ')}.`;
  const code = await defaultRejectionCode(context);

  return refusalReason(code, code === 'RISK_APPETITE' ? 'decided after review' : null);
}

const DOC_TONE = { PASSED: 'green', MANUAL_REVIEW: 'amber', FAILED: 'red' };

/** Who checked a document (the provider, or the person who read it) and when it was issued. */
function checkDetail(doc, me) {
  if (doc.failure_reason) return doc.failure_reason;
  const issued = doc.issued_at ? `issued ${dateOnly(String(doc.issued_at))}` : '';
  const service = String(doc.provider_check_id).startsWith('RNE-')
    ? PROVIDERS.register
    : PROVIDERS.idCheck;
  let who = '';
  if (doc.provider_check_id) who = `${service}, check ${doc.provider_check_id}`;
  else if (doc.verified_by) who = `reviewed by ${doc.verified_by === me ? 'you' : doc.verified_by}`;

  return [who, issued].filter(Boolean).join(' · ');
}

function kycDecisionCard(kyc, parties, findings, decision) {
  const { customer, people, business } = parties;
  const reviewed = findings.hits.filter(h => h.status !== 'OPEN').length;
  const docRows = findings.docs.map(doc => [
    label(doc.document_type),
    { html: badge(doc.check_result || 'NOT CHECKED', DOC_TONE[doc.check_result]) },
    checkDetail(doc, decision.by),
  ]);

  return card({
    eyebrow: `KYC decision · ${decision.by}`,
    title: `${kyc.reference} · ${customer.display_name}`,
    status: decision.status,
    rows: [
      ['People screened', people.map(fullName).join(', ') || '—'],
      ['Company screened', business?.legal_name],
      [
        'Screening hits',
        findings.hits.length
          ? `${findings.hits.length} on file, ${reviewed} reviewed`
          : 'None on file',
      ],
      ['Sanctions flags', findings.sanctioned.length ? findings.sanctioned.join(', ') : 'None'],
      ...decision.rows,
    ],
    list: docRows.length ? { head: ['Document', 'Check', 'Detail'], rows: docRows } : undefined,
  });
}

async function parkForScreening(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const parties = await caseParties(d, kyc);
  const { hits } = await kycFindings(d, kyc, parties);
  const open = hits.filter(h => h.status === 'OPEN');

  if (!open.length) {
    return resultBuilder.error(
      `${kyc.reference} has no open screening hit: nothing to park it for.`,
    );
  }

  const reason = 'Screening hit to review';
  await moveCase(d, kyc, 'ESCALATED', reason, { escalated_at: now(), escalation_reason: reason });
  const html = card({
    eyebrow: `KYC · ${kyc.reference}`,
    title: `${kyc.reference} parked for screening`,
    status: ['Parked for screening', 'amber'],
    rows: [
      ['Customer', parties.customer.display_name],
      [
        'Case',
        kyc.status === 'ESCALATED'
          ? 'parked for screening already'
          : `${label(kyc.status)} → parked for screening`,
      ],
    ],
    list: {
      head: ['Open hit', 'Name screened', 'Kind'],
      rows: open.map(h => [h.reference, h.screened_name, codeText(h.hit_type || 'UNKNOWN')]),
    },
    note:
      'The case leaves the onboarding queue for "Parked for screening". When the screening team ' +
      'discards the hit, it goes back to the onboarding queue by itself.',
  });

  return resultBuilder.success(
    `${kyc.reference} is parked until the screening team decides on the hit.`,
    { html },
  );
}

/** Approve the case with `chosen.rating` (else the pre-score) and `chosen.note`. */
async function approveCase(context, resultBuilder, chosen) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const parties = await caseParties(d, kyc);
  const blocker = await approvalBlocker(d, kyc, parties);
  if (blocker) return resultBuilder.error(`Cannot approve ${kyc.reference}: ${blocker}`);

  const rating = chosen.rating || kyc.risk_before || null;
  const note = chosen.note || null;
  // Papers no provider checks (a proof of address, a payslip) are read by a person: approving
  // records that the approver did. IDs cannot get here unchecked (approvalBlocker).
  const read = { check_result: 'PASSED', verified: true, verified_by: d.email, verified_at: now() };
  const otherPapers = [
    eq('kyc_case_id', kyc.id),
    new ConditionTreeLeaf('document_type', 'NotIn', ID_TYPES),
  ];
  await d.update('documents', [...otherPapers, notChecked()], read);
  await d.update('documents', [...otherPapers, eq('check_result', 'MANUAL_REVIEW')], read);
  await d.update('kyc_cases', [eq('id', kyc.id)], {
    status: 'APPROVED',
    decided_by: d.email,
    resolved_at: now(),
    updated_at: now(),
    risk_after: rating,
  });
  await logStatus(d, 'kyc_cases', kyc.id, kyc.status, 'APPROVED', note);

  const { customer } = parties;
  const patch: { risk_rating?; next_review_at?; status?; onboarded_at? } = rating
    ? { risk_rating: rating, next_review_at: inDays(365 * REVIEW_YEARS[rating]) }
    : {};

  if (customer.status === 'ONBOARDING') {
    Object.assign(patch, { status: 'ACTIVE', onboarded_at: now() });
  }

  await d.update('customers', [eq('id', customer.id)], { ...patch, updated_at: now() });

  if (patch.status) {
    await logStatus(
      d,
      'customers',
      customer.id,
      'ONBOARDING',
      'ACTIVE',
      `${kyc.reference} approved`,
    );
  }

  // A new customer's account opens with the approval, after it (no account before approval).
  const opened =
    patch.status && kyc.type === 'ONBOARDING' ? await openFirstAccount(d, customer) : null;
  const accountText = opened && `${opened.account.iban} · balance ${euros(0)}`;
  const onboarded = patch.status ? ` ${customer.display_name} is now an active customer.` : '';
  const findings = await kycFindings(d, kyc, parties);
  const html = kycDecisionCard(kyc, parties, findings, {
    by: d.email,
    status: ['Approved', 'green'],
    rows: [
      ['Risk rating', rating || 'unchanged'],
      ['Next review', frDate(patch.next_review_at)],
      ['Customer', patch.status ? 'Onboarding → Active' : customer.status],
      ['Account opened', accountText],
      ['Card ordered', opened?.cards.length ? `${cardLine(opened.cards)}, on its way` : null],
    ],
  });

  return resultBuilder.success(
    `${kyc.reference} approved.${onboarded}${
      accountText ? ` Account opened: ${accountText}.` : ''
    }`,
    { html },
  );
}

/**
 * The onboarding robot's way to a person: the robot started the review, so the case is assigned to
 * its service account; a person must find it unassigned in the manual review queue. Says why the
 * run paused, from the case file.
 */
async function handToPerson(context, resultBuilder) {
  const d = db(context);
  const kyc = await context.getRecord(['id', 'reference', 'status', 'assigned_to']);

  if (CLOSED_CASE.includes(kyc.status)) {
    return resultBuilder.error(`${kyc.reference} is ${kyc.status.toLowerCase()} already.`);
  }

  const file = await d.one('kyc_cases', kyc.id, [
    'docs_complete',
    'idcheck_result',
    'idcheck_faces',
    'screening_result',
    'risk_rating_suggested',
  ]);
  const why = checkReasons(file);
  await d.update('kyc_cases', [eq('id', kyc.id)], { assigned_to: null, updated_at: now() });
  // Written down, so the desks can tell what the robot handed over, when and why (robot-results.ts).
  await d.create('status_changes', {
    record_type: 'KYC_CASES',
    record_id: kyc.id,
    field: 'assigned_to',
    old_value: kyc.assigned_to || null,
    new_value: null,
    changed_by: d.email,
    changed_at: now(),
    reason: handoverReason(why),
  });

  return resultBuilder.success(
    `${kyc.reference} waits for a person in manual review: ${why.join('; ') || 'see the file'}.`,
  );
}

/** Approve KYC's rating: the case's own (its pre-score, or the rating when it opened). */
const approveKyc = (context, resultBuilder) =>
  approveCase(context, resultBuilder, {
    rating: context.formValues['Risk rating'],
    note: context.formValues.Note,
  });

// ---- Rate the risk, and the two approvals that follow it ----------------------------------------
// The operator rates the risk from the case's risk lines; a LOW risk is theirs to approve, a MEDIUM
// or HIGH one goes to a senior (four eyes: "Send for senior sign-off" first). One person plays both
// in the demo, so the two approvals are separate actions rather than permissions.

const RATINGS = enumOf('customers', 'risk_rating');
const RISK_LINES = ['risk_hits', 'risk_pep', 'risk_residence', 'risk_funds', 'risk_volumes'];
const RATING_TONE = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red' };
const SENIOR_RATINGS = ['MEDIUM', 'HIGH'];

/** The case file's facts for the case an action runs on. */
async function fileOf(context) {
  const kyc = await context.getRecord([
    'id',
    'customer_id',
    'type',
    'channel',
    'status',
    'risk_after',
  ]);

  return { kyc, file: await caseFile(reader(context.dataSource), kyc) };
}

/** LOW, MEDIUM or HIGH, read from the suggested rating's line ("⚠ MEDIUM: …"). */
const levelOf = line => RATINGS.find(r => String(line || '').includes(r)) || null;

/** The dropdown starts on the rating already decided, else on the suggested one. */
async function defaultRiskChoice(context) {
  const { kyc, file } = await fileOf(context);

  return kyc.risk_after || levelOf(file.risk_rating_suggested);
}

function riskCard(kyc, file, rating, note) {
  const suggested = levelOf(file.risk_rating_suggested);
  const low = rating === 'LOW';

  return card({
    eyebrow: "Risk rating · the bank's risk-based approach",
    title: `Risk · ${kyc.reference}`,
    status: [rating, RATING_TONE[rating]],
    rows: [
      ['Suggested', file.risk_rating_suggested],
      [
        'Decided',
        suggested && suggested !== rating ? `${rating} (suggested ${suggested})` : rating,
      ],
      ['Note', note],
    ],
    list: {
      head: ['Risk line', 'Reading'],
      rows: RISK_LINES.filter(f => file[f]).map(f => [
        CASE_LABELS[f].replace('Risk · ', ''),
        file[f],
      ]),
    },
    note: low
      ? 'Low risk: the operator approves it with "Approve KYC - Low risk".'
      : 'Medium or high risk: four eyes. "Send for senior sign-off", then a senior approves it ' +
        'with "Approve KYC - Medium or High".',
  });
}

async function rateRisk(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);
  const rating = context.formValues['Risk rating'];
  if (!RATINGS.includes(rating)) return resultBuilder.error('Pick a risk rating.');
  const note = context.formValues.Note || null;
  const { kyc: rated, file } = await fileOf(context);
  await d.update('kyc_cases', [eq('id', kyc.id)], { risk_after: rating, updated_at: now() });
  await d.create('status_changes', {
    record_type: 'KYC_CASES',
    record_id: kyc.id,
    field: 'risk_after',
    old_value: rated.risk_after || null,
    new_value: rating,
    changed_by: d.email,
    changed_at: now(),
    reason: note || `Risk rated ${rating}`,
  });
  const next =
    rating === 'LOW'
      ? 'approve it with "Approve KYC - Low risk"'
      : 'send it for a senior\'s sign-off; the senior approves with "Approve KYC - Medium or High"';

  return resultBuilder.success(`${kyc.reference} rated ${rating}. Next: ${next}.`, {
    html: riskCard(kyc, file, rating, note),
  });
}

async function approveLowRisk(context, resultBuilder) {
  const kyc = await context.getRecord(['reference', 'status', 'risk_after']);

  if (!kyc.risk_after) {
    return resultBuilder.error(
      `${kyc.reference} has no risk rating yet: run "Rate the risk" first.`,
    );
  }

  if (kyc.risk_after !== 'LOW') {
    return resultBuilder.error(
      `${kyc.reference} is rated ${kyc.risk_after}: a senior approves it ("Send for senior ` +
        'sign-off", then "Approve KYC - Medium or High").',
    );
  }

  if (kyc.status === 'PENDING_APPROVAL') {
    return resultBuilder.error(
      `${kyc.reference} is with a senior for sign-off: the senior decides.`,
    );
  }

  return approveCase(context, resultBuilder, { rating: 'LOW', note: context.formValues.Note });
}

async function approveSeniorRisk(context, resultBuilder) {
  const kyc = await context.getRecord(['reference', 'status', 'risk_after']);

  if (!SENIOR_RATINGS.includes(kyc.risk_after)) {
    return resultBuilder.error(
      `${kyc.reference} is rated ${
        kyc.risk_after || 'nothing yet'
      }: this approval is for a medium ` +
        'or high risk ("Rate the risk" first; a low risk uses "Approve KYC - Low risk").',
    );
  }

  if (kyc.status !== 'PENDING_APPROVAL') {
    return resultBuilder.error(
      `${kyc.reference} has not been sent for a senior's sign-off: run "Send for senior sign-off" ` +
        'first (four eyes on a medium or high risk).',
    );
  }

  return approveCase(context, resultBuilder, {
    rating: kyc.risk_after,
    note: context.formValues["Senior's note"],
  });
}

async function defaultRating(context) {
  return (await context.getRecord(['risk_before'])).risk_before || null;
}

async function rejectKyc(context, resultBuilder) {
  const d = db(context);
  const { kyc, error } = await openCase(context);
  if (error) return resultBuilder.error(error);

  const parties = await caseParties(d, kyc);
  const findings = await kycFindings(d, kyc, parties);
  const { Reason: reason } = context.formValues;
  const code = context.formValues['Reason code'] || (await defaultCode(d, kyc, findings));
  await d.update('kyc_cases', [eq('id', kyc.id)], {
    status: 'REJECTED',
    rejection_reason: reason,
    rejection_code: code,
    decided_by: d.email,
    resolved_at: now(),
    updated_at: now(),
  });
  await logStatus(d, 'kyc_cases', kyc.id, kyc.status, 'REJECTED', reason);
  // A closed case leaves no question out.
  const open = await d.list(
    'information_requests',
    [eq('kyc_case_id', kyc.id), eq('status', OPEN_REQUEST)],
    ['id', 'status'],
  );
  await Promise.all(
    open.map(async request => {
      const why = `Case ${kyc.reference} closed`;
      await d.update('information_requests', [eq('id', request.id)], {
        status: 'CANCELLED',
        cancel_reason: why,
      });
      await logStatus(d, 'information_requests', request.id, request.status, 'CANCELLED', why);
    }),
  );

  // Refused: DECLINED. Stopped answering: a prospect again (refusals.ts).
  const customer = await d.one('customers', kyc.customer_id, ['id', 'status', 'display_name']);
  const after = customerStatusAfter(code);
  const ends = kyc.type === 'ONBOARDING' && customer.status === 'ONBOARDING';

  if (ends) {
    await d.update('customers', [eq('id', customer.id)], { status: after, updated_at: now() });
    await logStatus(d, 'customers', customer.id, 'ONBOARDING', after, reason);
  }

  const html = kycDecisionCard(kyc, parties, findings, {
    by: d.email,
    status: code === 'NO_RESPONSE' ? ['Closed: no answer', 'grey'] : ['Rejected', 'red'],
    rows: [
      ['Reason', reason],
      ['Reason code', label(code)],
      ['Customer', ends ? `Onboarding → ${label(after)}` : customer.status],
    ],
  });

  return resultBuilder.success(
    `${kyc.reference} ${code === 'NO_RESPONSE' ? 'closed' : 'rejected'}.${
      ends ? ` ${customer.display_name} is not onboarded.` : ''
    }`,
    { html },
  );
}

function customizeKycCases(collection) {
  collection.addAction('Check documents', { scope: 'Single', execute: checkDocuments });
  collection.addAction('Screen against sanctions lists', { scope: 'Single', execute: screenCase });
  collection.addAction('Verify document', { scope: 'Single', execute: verifyDocument });
  collection.addAction('Request ID document', { scope: 'Single', execute: requestIdDocument });
  collection.addAction('Request company documents', {
    scope: 'Single',
    execute: requestCompanyDocuments,
  });
  collection.addAction('Request missing documents', {
    scope: 'Single',
    form: [
      {
        label: 'Questions',
        type: 'String',
        widget: 'TextArea',
        isRequired: true,
        description: 'Pre-filled with what the file lacks',
        defaultValue: defaultQuestions,
      },
    ],
    execute: requestMissingDocuments,
  });
  collection.addAction('Check the company register', { scope: 'Single', execute: checkRegister });
  collection.addAction('Send for senior sign-off', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'String',
        defaultValue: 'Medium or high risk: senior sign-off',
      },
    ],
    execute: sendForSignoff,
  });
  collection.addAction('Park for screening', { scope: 'Single', execute: parkForScreening });
  collection.addAction('Hand to a person', { scope: 'Single', execute: handToPerson });
  collection.addAction('Approve card acceptance', {
    scope: 'Single',
    form: [
      {
        label: 'Reserve (%)',
        type: 'Number',
        description: 'Optional: share of sales held, 5 to 20',
      },
      { label: 'Reserve (days)', type: 'Number', description: 'Optional: 90 to 180 days' },
    ],
    execute: approveCardAcceptance,
  });
  collection.addAction('Set a reserve', {
    scope: 'Single',
    form: [
      { label: 'Share held (%)', type: 'Number', isRequired: true, description: '5 to 20' },
      { label: 'Days held', type: 'Number', isRequired: true, description: '90 to 180' },
    ],
    execute: setReserve,
  });
  collection.addAction('Approve KYC', {
    scope: 'Single',
    form: [
      {
        label: 'Risk rating',
        type: 'Enum',
        enumValues: enumOf('customers', 'risk_rating'),
        defaultValue: defaultRating,
      },
      { label: 'Note', type: 'String', widget: 'TextArea' },
    ],
    execute: approveKyc,
  });
  collection.addAction('Rate the risk', {
    scope: 'Single',
    form: [
      {
        label: 'Risk rating',
        type: 'Enum',
        enumValues: RATINGS,
        isRequired: true,
        description: 'Starts on the suggested rating; the risk lines are in the case file',
        defaultValue: defaultRiskChoice,
      },
      {
        label: 'Note',
        type: 'String',
        widget: 'TextArea',
        description: 'Optional: why this rating',
      },
    ],
    execute: rateRisk,
  });
  collection.addAction('Approve KYC - Low risk', {
    scope: 'Single',
    form: [{ label: 'Note', type: 'String', widget: 'TextArea' }],
    execute: approveLowRisk,
  });
  collection.addAction('Approve KYC - Medium or High', {
    scope: 'Single',
    form: [
      {
        label: "Senior's note",
        type: 'String',
        widget: 'TextArea',
        description: 'Why the bank accepts this risk',
      },
    ],
    execute: approveSeniorRisk,
  });
  collection.addAction('Reject KYC', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'String',
        widget: 'TextArea',
        isRequired: true,
        description: 'Pre-filled from the checks that did not pass',
        defaultValue: defaultRejection,
      },
      {
        label: 'Reason code',
        type: 'Enum',
        enumValues: enumOf('kyc_cases', 'rejection_code'),
        description:
          'Refused: the customer becomes Declined. NO_RESPONSE closes the case, the applicant goes back to Prospect.',
        defaultValue: defaultRejectionCode,
      },
    ],
    execute: rejectKyc,
  });
}

// ---------------------------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------------------------

const ALERT_FIELDS = [
  'id',
  'reference',
  'status',
  'customer_id',
  'category',
  'alert_type',
  'score',
  'login_event_id',
  'investigation_id',
  'triggered_at',
  'called_at',
  'call_outcome',
];
const CLOSED_ALERT = ['CLEARED', 'ESCALATED'];

/** The alert, or an error when it is closed already. */
async function liveAlert(context) {
  const alert = await context.getRecord(ALERT_FIELDS);
  const done = CLOSED_ALERT.includes(alert.status);

  return {
    alert,
    error: done ? `${alert.reference} is ${alert.status.toLowerCase()} already.` : null,
  };
}

async function alertTransactions(d, alertId) {
  const links = await d.list('alert_transactions', [eq('alert_id', alertId)], ['transaction_id']);
  if (!links.length) return [];

  return d.list(
    'transactions',
    [
      eq(
        'id',
        links.map(l => l.transaction_id),
      ),
    ],
    TX_FIELDS,
  );
}

async function heldPaymentOf(context) {
  const d = db(context);
  const alert = await context.getRecord(ALERT_FIELDS);
  const txs = await alertTransactions(d, alert.id);
  const tx = txs.find(t => t.status === 'HELD' && t.direction === 'DEBIT');

  return { d, alert, tx, error: tx ? null : `${alert.reference} has no held payment.` };
}

/** Moves an alert to another status, with its line in the history. */
async function moveAlert(d, alert, status, reason, patch = {}) {
  await d.update('alerts', [eq('id', alert.id)], { status, ...patch });
  await logStatus(d, 'alerts', alert.id, alert.status, status, reason);
}

async function startReview(context, resultBuilder) {
  const d = db(context);
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  if (alert.status === 'SECOND_LOOK') {
    return resultBuilder.error(`${alert.reference} waits for a senior's second look.`);
  }

  if (alert.status === 'OPEN') {
    await moveAlert(d, alert, 'IN_REVIEW', null, { assigned_to: d.email });
  } else {
    await d.update('alerts', [eq('id', alert.id)], { assigned_to: d.email });
  }

  return resultBuilder.success(`${alert.reference} is in review, assigned to ${d.email}.`);
}

async function sendForSecondLook(context, resultBuilder) {
  const d = db(context);
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  if (alert.status === 'SECOND_LOOK') {
    return resultBuilder.error(`${alert.reference} already waits for a second look.`);
  }

  const reason = context.formValues.Reason || 'Not sure the profile explains it';
  await moveAlert(d, alert, 'SECOND_LOOK', reason, { assigned_to: null });

  return resultBuilder.success(
    `${alert.reference} waits for a senior's second look, out of the alert queues: ${reason}.`,
  );
}

const DEVICE_ROWS = (v, f) => [
  ['Device', v.device],
  ['IP address', `${f.login.ip_address} · ${v.network}`],
  ['Login', `${f.login.city}, ${f.login.country} · ${frDate(f.login.created_at)}`],
  ['MFA reset', f.reset ? 'Yes, on this device, before the login' : 'No'],
  [
    'Contact changes',
    f.changes.filter(c => ['PHONE', 'EMAIL'].includes(c.field)).length
      ? f.changes.map(c => `${label(c.field)} (${label(c.status)})`).join(', ')
      : 'None in 7 days',
  ],
];

/** The fraud scoring provider's device and IP check on the alert's login, recorded now. */
async function checkDevice(context, resultBuilder) {
  const d = db(context);
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  const facts = await loginFacts(d.list, alert);
  if (!facts) return resultBuilder.error(`${alert.reference} has no login to check.`);
  const verdict = deviceVerdict(alert, facts);
  await d.update('alerts', [eq('id', alert.id)], { device_checked_at: now() });
  const html = card({
    eyebrow: resultsFrom(PROVIDERS.deviceIntel, 'device and IP intelligence'),
    title: `${alert.reference} · risk ${verdict.score}/100`,
    status: verdict.takeover ? ['Takeover signals', 'red'] : ['No takeover signal', 'green'],
    rows: [['Check', verdict.id], ...DEVICE_ROWS(verdict, facts)],
    note: verdict.text,
  });

  return resultBuilder.success(
    `${PROVIDERS.deviceIntel} (${verdict.id}, simulated): ${verdict.text}; risk ${verdict.score}/100.`,
    { html },
  );
}

const CALL_RESULTS = {
  CONFIRMED: ['It was the customer', 'green'],
  DENIED: ['Not the customer', 'red'],
  NOT_REACHED: ['Not reached', 'amber'],
};

/** A call to the customer through the phone provider, on the number on file; the answer is recorded. */
async function callCustomer(context, resultBuilder) {
  const d = db(context);
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  const txs = await evidenceTransactions(d.list, alert.id);
  const [facts, payment] = await Promise.all([
    loginFacts(d.list, alert),
    paymentOf(d.list, alert, txs),
  ]);
  const contactId = facts?.person.id || (await caseParties(d, alert)).contactId;
  const holder = await d.one('individuals', contactId, ['id', 'first_name', 'last_name', 'phone']);
  const phone = await phoneOnFile(d.list, holder);
  if (!phone.number) return resultBuilder.error(`${alert.reference}: no phone number on file.`);
  const answer = callAnswer(facts, payment);
  await d.update('alerts', [eq('id', alert.id)], {
    called_at: now(),
    call_outcome: answer.outcome,
  });
  const callId = `CALL-${hex(`${alert.id}:call`, 8)}`;
  const html = card({
    eyebrow: resultsFrom(PROVIDERS.phone, 'call recorded and summarised'),
    title: `Call to ${holder ? fullName(holder) : 'the customer'}`,
    status: CALL_RESULTS[answer.outcome],
    rows: [
      ['Call', callId],
      ['Number', `${phone.number}${phone.note}`],
      ['About', alert.reference],
    ],
    note: `Summary: ${answer.text}.`,
  });

  return resultBuilder.success(
    `Call ${callId} to ${phone.number} (${PROVIDERS.phone}, simulated): ${CALL_RESULTS[
      answer.outcome
    ][0].toLowerCase()}, ${answer.text}.`,
    { html },
  );
}

const CLEAR_NOTES = {
  STRUCTURING: 'The deposits match the customer’s usual cash activity: no sign of splitting.',
  RAPID_MOVEMENT: 'Money in and out matches a known pattern (salary, then rent and savings).',
  UNUSUAL_VOLUME: 'The higher volume is explained by the customer’s declared profile.',
  HIGH_RISK_COUNTRY: 'The payment to a high-risk country is a known family transfer.',
  SANCTIONS_MATCH: 'Homonym: the name matches, the date of birth and country do not.',
  SUSPICIOUS_PATTERN: 'Reviewed the pattern: consistent with the customer’s declared activity.',
  CARD_TESTING: 'The small card payments were made by the customer (confirmed in the app).',
  UNUSUAL_CARD_SPEND: 'The customer confirmed the card payments (travel abroad).',
  NEW_DEVICE_NEW_PAYEE: 'The customer confirmed the new phone and the new payee.',
  IMPOSSIBLE_TRAVEL: 'The two logins come from a VPN the customer uses: not two places.',
  MULE_PATTERN: 'The incoming transfers are explained (shared flat, refunds from friends).',
  INCOMING_FRAUD_RECALL: 'The sender’s bank withdrew its recall.',
  CUSTOMER_REPORT: 'The customer recognised the payment after all.',
  REPEATED_DISPUTES: 'The disputes were justified: merchant issues, not abuse.',
  INVOICE_IBAN_CHANGE: 'The supplier confirmed its new IBAN by phone, on the number on file.',
};

// The clearance reason that goes with each note above: a note and its reason never contradict.
const CLEAR_REASONS = {
  SANCTIONS_MATCH: 'FALSE_POSITIVE',
  IMPOSSIBLE_TRAVEL: 'FALSE_POSITIVE',
  CARD_TESTING: 'VERIFIED_WITH_COUNTERPARTY',
  UNUSUAL_CARD_SPEND: 'VERIFIED_WITH_COUNTERPARTY',
  NEW_DEVICE_NEW_PAYEE: 'VERIFIED_WITH_COUNTERPARTY',
  INVOICE_IBAN_CHANGE: 'VERIFIED_WITH_COUNTERPARTY',
  CUSTOMER_REPORT: 'VERIFIED_WITH_COUNTERPARTY',
  INCOMING_FRAUD_RECALL: 'ALREADY_INVESTIGATED',
};

// A call where the customer confirmed says it all: the reason and note follow it.
const confirmedByPhone = alert => alert.call_outcome === 'CONFIRMED' && alert.called_at;

async function defaultClearReason(context) {
  const alert = await context.getRecord(['alert_type', 'call_outcome', 'called_at']);
  if (confirmedByPhone(alert)) return 'VERIFIED_WITH_COUNTERPARTY';

  return CLEAR_REASONS[alert.alert_type] || 'EXPLAINED_BY_PROFILE';
}

async function defaultClearNote(context) {
  const alert = await context.getRecord(['alert_type', 'call_outcome', 'called_at']);

  if (confirmedByPhone(alert)) {
    return `The customer confirmed on the phone (${PROVIDERS.phone}, ${frDate(alert.called_at)}).`;
  }

  // A senior clearing after an unanswered call: nothing moved, the device is the customer's.
  if (alert.call_outcome === 'NOT_REACHED' && alert.alert_type === 'IMPOSSIBLE_TRAVEL') {
    return 'Customer abroad, not reached: the login came from their usual phone and no money moved.';
  }

  return CLEAR_NOTES[alert.alert_type] || 'Reviewed: no suspicious activity found.';
}

/** The text "Payment · Status" shows, without its leading mark, worded for a closed alert. */
function paymentLine(alert, payment) {
  const { tx } = payment;

  // Refused by the bank before anyone looked at it: nothing was stopped by the review.
  if (tx.status === 'REJECTED' && /insufficient funds/i.test(tx.status_reason || '')) {
    return `Not sent: ${euros(tx.amount)} to ${
      tx.party?.name || 'the payee'
    } rejected for insufficient funds before the review`;
  }

  const text = paymentStatusText(alert, payment).replace(/^\S+\s/, '');

  // A recall is the fraud team's tool; on an AML case it would tip the customer off.
  return alert.category === 'AML' ? text.replace(/; only a recall can bring it back$/, '') : text;
}

/** Where the alert's payment and the customer's main account stand now, for a result card. */
async function alertOutcomeRows(d, alert) {
  const fresh = await d.one('alerts', alert.id, ALERT_FIELDS);
  const txs = await evidenceTransactions(d.list, alert.id);
  const payment = await paymentOf(d.list, fresh, txs);
  const [customer, account] = await Promise.all([
    d.one('customers', alert.customer_id, ['display_name']),
    mainAccount(d, alert.customer_id),
  ]);
  let accountLine = null;

  if (account) {
    accountLine = `${account.iban} ${label(account.status)}${
      account.freeze_reason ? ` (${label(account.freeze_reason)})` : ''
    }`;
  }

  return [
    ['Customer', customer?.display_name],
    ['Payment', payment ? paymentLine(fresh, payment) : null],
    ['Account', accountLine],
  ];
}

async function clearAlert(context, resultBuilder) {
  const d = db(context);
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  const { 'Clearance reason': reason, Note: note } = context.formValues;
  const txs = await alertTransactions(d, alert.id);
  const held = txs.find(t => t.status === 'HELD' && t.direction === 'DEBIT');

  if (held) {
    return resultBuilder.error(
      `${alert.reference} still holds a payment of ${euros(
        held.amount,
      )}: approve or reject it first.`,
    );
  }

  await moveAlert(d, alert, 'CLEARED', note || reason, {
    resolved_at: now(),
    clearance_reason: reason,
    resolution_notes: note || null,
    reviewed_by: d.email,
  });
  const html = card({
    eyebrow: `Alert decision · ${d.email}`,
    title: `${alert.reference} cleared`,
    status: ['Cleared', 'green'],
    rows: [
      ['Alert', `${codeText(alert.alert_type)} · score ${alert.score}`],
      ['Reason', label(reason)],
      ['Note', note],
      ...(await alertOutcomeRows(d, alert)),
    ],
    note: 'The alert is closed as CLEARED and leaves the alert queues: nothing else to do.',
  });

  return resultBuilder.success(
    `${alert.reference} cleared (${label(reason)}): it leaves the alert queues.`,
    { html },
  );
}

/** The customer's open investigation, or a new one for this alert. */
async function investigationFor(d, alert, txs, form) {
  const [open] = await d.list(
    'investigations',
    [eq('customer_id', alert.customer_id), not('status', 'CLOSED')],
    ['id', 'reference'],
    { field: 'opened_at', ascending: false },
  );
  if (open) return { investigation: open, joined: true };

  const investigation = await d.create('investigations', {
    customer_id: alert.customer_id,
    type: INVESTIGATION_TYPE[alert.category] || 'AML',
    origin: 'ALERTS',
    status: 'OPEN',
    opened_at: now(),
    due_at: inDays(30),
    summary: form.Summary || `Opened from alert ${alert.reference}.`,
    priority: form.Priority || null,
    reference: await nextReference(d, 'investigations', 'INV'),
    amount_involved: money(txs.reduce((sum, t) => sum + Number(t.amount), 0)),
  });
  await logStatus(d, 'investigations', investigation.id, null, 'OPEN', `From ${alert.reference}`);

  return { investigation, joined: false };
}

async function copyTransactions(d, alert, investigationId, txs) {
  const known = await d.list(
    'investigation_transactions',
    [eq('investigation_id', investigationId)],
    ['transaction_id'],
  );
  const missing = txs.filter(t => !known.some(k => k.transaction_id === t.id));
  await Promise.all(
    missing.map(t =>
      d.create('investigation_transactions', {
        investigation_id: investigationId,
        transaction_id: t.id,
        included_in_sar: false,
        note: `From alert ${alert.reference}`,
        added_by: d.email,
        added_at: now(),
      }),
    ),
  );
}

async function escalateAlert(context, resultBuilder) {
  const d = db(context);
  const { alert, error } = await liveAlert(context);
  if (error) return resultBuilder.error(error);

  const txs = await alertTransactions(d, alert.id);
  const { investigation, joined } = await investigationFor(d, alert, txs, context.formValues);
  await copyTransactions(d, alert, investigation.id, txs);
  await moveAlert(d, alert, 'ESCALATED', `To ${investigation.reference}`, {
    investigation_id: investigation.id,
    escalated_at: now(),
    reviewed_by: d.email,
  });
  const how = joined ? 'added to the open investigation' : 'escalated to new investigation';
  const amount = money(txs.reduce((sum, t) => sum + Number(t.amount), 0));
  const html = card({
    eyebrow: 'Escalated to the investigations desk',
    title: `Investigation ${investigation.reference}`,
    status: joined ? ['Joined open case', 'amber'] : ['New investigation opened', 'green'],
    rows: [
      ['From alert', `${alert.reference} (${codeText(alert.category || 'AML')})`],
      ...(await alertOutcomeRows(d, alert)),
      ['Type', joined ? null : codeText(investigation.type)],
      ['Priority', codeText(context.formValues.Priority) || (joined ? null : 'not set')],
      ['Transactions attached', `${txs.length} · ${euros(amount)}`],
      ['Due', joined ? null : frDate(investigation.due_at)],
      ['Escalated by', d.email],
    ],
    note: joined
      ? 'The alert is closed as ESCALATED; its transactions join the case already open.'
      : 'The alert is closed as ESCALATED; the case waits in "Open investigations".',
  });

  return resultBuilder.success(`${alert.reference} ${how} ${investigation.reference}.`, { html });
}

// Who decides first how urgent an escalation is: a takeover now, fraud soon, AML by its score.
async function defaultPriority(context) {
  const alert = await context.getRecord(['category', 'score']);
  if (alert.category === 'ACCOUNT_TAKEOVER') return 'URGENT';
  if (alert.category === 'FRAUD') return 'HIGH';

  return Number(alert.score) >= 85 ? 'HIGH' : 'MEDIUM';
}

async function defaultSummary(context) {
  const alert = await context.getRecord([
    'reference',
    'alert_type',
    'rule:name',
    'customer:display_name',
  ]);
  const what = alert.rule?.name || label(alert.alert_type).replace(/^./, c => c.toUpperCase());

  return `${what} on ${alert.customer?.display_name}: opened from alert ${alert.reference}.`;
}

async function revokeDevice(context, resultBuilder) {
  const d = db(context);
  const alert = await context.getRecord(ALERT_FIELDS);
  const login = await d.one('login_events', alert.login_event_id, ['device_id']);
  const device = await d.one('devices', login?.device_id, ['id', 'device_name', 'revoked_at']);
  if (!device) return resultBuilder.error(`${alert.reference} has no login device to revoke.`);

  // A second run of the workflow on the same alert goes on: nothing left to revoke.
  if (device.revoked_at) {
    return resultBuilder.success(
      `${device.device_name} was revoked already on ${frDate(device.revoked_at)}: nothing to do.`,
    );
  }

  await d.update('devices', [eq('id', device.id)], { revoked_at: now(), is_trusted: false });

  return resultBuilder.success(
    `${device.device_name} revoked: it is signed out and no longer trusted.`,
  );
}

async function accountOfAlert(context) {
  const d = db(context);
  const alert = await context.getRecord(ALERT_FIELDS);
  const account = await mainAccount(d, alert.customer_id);

  return {
    d,
    alert,
    account,
    error: account ? null : `${alert.reference}: the customer has no open account.`,
  };
}

async function freezeFromAlert(context, resultBuilder) {
  const { d, account, error } = await accountOfAlert(context);
  if (error) return resultBuilder.error(error);

  const { Reason: reason, Note: note } = context.formValues;

  // Frozen already (a second run, or another reason): the freeze stays as it is, the workflow goes on.
  if (account.status === 'FROZEN') {
    return resultBuilder.success(
      `Account ${account.iban} is frozen already (${label(
        account.freeze_reason || 'no reason given',
      )}): it stays frozen.`,
    );
  }

  const refused = await freeze(d, account, reason, note);
  if (refused) return resultBuilder.error(refused);

  return resultBuilder.success(
    `Account ${account.iban} frozen (${label(reason)}): no payment leaves it.`,
  );
}

/**
 * Lifts the fraud freeze this alert put on the account. A freeze for another reason (sanctions, an
 * AML case, a seizure) is not the alert's to lift: it stays, and the workflow goes on.
 */
async function unfreezeFromAlert(context, resultBuilder) {
  const { d, account, error } = await accountOfAlert(context);
  if (error) return resultBuilder.error(error);

  if (account.status !== 'FROZEN') {
    return resultBuilder.success(`Account ${account.iban} was not frozen: nothing to undo.`);
  }

  if (account.freeze_reason !== 'FRAUD_SUSPICION') {
    return resultBuilder.success(
      `Account ${account.iban} is frozen for ${label(
        account.freeze_reason || 'another reason',
      )}, not this alert's to lift: it stays frozen.`,
    );
  }

  const refused = await unfreeze(d, account);
  if (refused) return resultBuilder.error(refused);

  return resultBuilder.success(`Account ${account.iban} is active again.`);
}

/** A fraud recall through the SEPA network: the other bank has 15 business days to answer. */
async function recallTransfer(context, resultBuilder) {
  const d = db(context);
  const alert = await context.getRecord(ALERT_FIELDS);
  const txs = await alertTransactions(d, alert.id);
  const tx = txs.find(
    t => t.rail === 'TRANSFER' && t.direction === 'DEBIT' && t.status === 'BOOKED',
  );
  if (!tx) return resultBuilder.error(`${alert.reference} has no transfer sent to recall.`);

  const [asked] = await d.list(
    'sepa_disputes',
    [eq('transaction_id', tx.id), eq('type', 'RECALL')],
    ['reference'],
  );

  if (asked) {
    return resultBuilder.error(`Recall ${asked.reference} is already open on this transfer.`);
  }

  const [transfer] = await d.list(
    'outgoing_transfers',
    [eq('transaction_id', tx.id)],
    ['id', 'scheme', 'beneficiary_id', 'end_to_end_id'],
  );
  const payee = await d.one('sct_beneficiaries', transfer?.beneficiary_id, [
    'bic',
    'iban',
    'bank_name',
  ]);
  const dispute = await d.create('sepa_disputes', {
    customer_id: alert.customer_id,
    transaction_id: tx.id,
    outgoing_transfer_id: transfer?.id || null,
    alert_id: alert.id,
    scheme: transfer?.scheme === 'SEPA_INSTANT' ? 'SCT_INST' : 'SCT',
    type: 'RECALL',
    side: 'WE_ASKED',
    reason: 'FRAUD',
    reason_code: 'FRAD',
    amount: money(tx.amount),
    requested_at: now(),
    response_due: dateOnly(businessDays(new Date(), 15).toISOString()),
    status: 'WAITING_OTHER_BANK',
    assigned_to: d.email,
    reference: await nextReference(d, 'sepa_disputes', 'SEP'),
    other_bank_bic: payee?.bic || null,
  });
  await logStatus(
    d,
    'sepa_disputes',
    dispute.id,
    null,
    'WAITING_OTHER_BANK',
    `Fraud, ${alert.reference}`,
  );
  const html = card({
    eyebrow: resultsFrom(PROVIDERS.sepa, 'recall sent'),
    title: `Recall ${dispute.reference} · ${euros(tx.amount)}`,
    status: ['Waiting for the other bank', 'amber'],
    rows: [
      ['Reason', 'FRAD (fraud)'],
      ['Scheme', dispute.scheme],
      ['Transfer', transfer?.end_to_end_id],
      ['Beneficiary bank', [payee?.bank_name, payee?.bic].filter(Boolean).join(' · ')],
      ['Answer due', dispute.response_due],
    ],
    note: 'The beneficiary bank returns the money if it is still on the account, or answers why not.',
  });

  return resultBuilder.success(
    `Recall ${dispute.reference} sent for ${euros(tx.amount)} through the ${
      PROVIDERS.sepa
    } (simulated): the other bank has 15 business days to answer.`,
    { html },
  );
}

/** The refund of an unauthorised transfer, listed on its recall: [recall, refund row or null]. */
async function refundOfRecall(d, txId) {
  const [recall] = await d.list(
    'sepa_disputes',
    [eq('transaction_id', txId), eq('type', 'RECALL'), eq('side', 'WE_ASKED')],
    ['id', 'reference'],
  );
  if (!recall) return [null, null];
  const [refund] = await d.list(
    'dispute_transactions',
    [eq('sepa_dispute_id', recall.id), eq('role', 'REFUND')],
    ['transaction_id'],
  );

  return [recall, refund || null];
}

/**
 * PSD2 (L133-18): a transfer the customer did not make is refunded by the end of the next
 * business day, whatever the recall brings back; what comes back then goes to the bank.
 */
async function refundCustomer(context, resultBuilder) {
  const d = db(context);
  const alert = await context.getRecord(ALERT_FIELDS);
  const txs = await alertTransactions(d, alert.id);
  const tx = txs.find(
    t => t.rail === 'TRANSFER' && t.direction === 'DEBIT' && t.status === 'BOOKED',
  );
  if (!tx) return resultBuilder.error(`${alert.reference} has no transfer sent to refund.`);
  const [recall, refunded] = await refundOfRecall(d, tx.id);

  if (!recall) {
    return resultBuilder.error('Recall the transfer first: the refund is listed on the recall.');
  }

  if (refunded) {
    return resultBuilder.error(`The customer was refunded already (${recall.reference}).`);
  }

  const [line] = await d.list('transactions', [eq('id', tx.id)], ['counterparty:name']);
  const payee = (line?.counterparty?.name || 'BENEFICIAIRE').toUpperCase();
  const account = await d.one('accounts', tx.account_id, ['id', 'balance', 'available_balance']);
  const amount = money(tx.amount);
  const balance = money(Number(account.balance) + amount);
  const refund = await d.create('transactions', {
    account_id: account.id,
    rail: 'INTERNAL',
    direction: 'CREDIT',
    amount,
    currency: 'EUR',
    status: 'BOOKED',
    booked_at: now(),
    created_at: now(),
    value_date: dateOnly(now()),
    balance_after: balance,
    description: `REMBOURSEMENT OPERATION NON AUTORISEE ${payee}`,
    category: 'REFUNDS',
  });
  await d.update('accounts', [eq('id', account.id)], {
    balance,
    available_balance: money(Number(account.available_balance) + amount),
    last_activity_at: now(),
  });
  await d.create('dispute_transactions', {
    transaction_id: refund.id,
    role: 'REFUND',
    dispute_request_id: null,
    chargeback_id: null,
    sepa_dispute_id: recall.id,
  });
  const html = card({
    eyebrow: `Unauthorised transfer · ${alert.reference}`,
    title: `${euros(amount)} refunded to the customer`,
    status: ['Refunded', 'green'],
    rows: [
      ['Booked', `${refund.description} · ${refund.value_date}`],
      ['Rule', 'PSD2 (L133-18): refunded by the end of the next business day'],
      ['Recall', `${recall.reference}: what it brings back goes to the bank`],
    ],
  });

  return resultBuilder.success(
    `${euros(amount)} refunded to the customer (unauthorised transfer, PSD2); recall ${
      recall.reference
    } goes on for the bank.`,
    { html },
  );
}

async function approveTransfer(context, resultBuilder) {
  const { d, tx, error } = await heldPaymentOf(context);
  if (error) return resultBuilder.error(error);

  await bookHeld(d, tx);

  return resultBuilder.success(`Transfer of ${euros(tx.amount)} approved and sent.`);
}

async function rejectTransfer(context, resultBuilder) {
  const { d, tx, error } = await heldPaymentOf(context);
  if (error) return resultBuilder.error(error);

  await rejectHeld(d, tx, context.formValues.Reason);

  return resultBuilder.success(
    `Transfer of ${euros(tx.amount)} rejected: the money stays on the account.`,
  );
}

async function defaultRejectReason(context) {
  const alert = await context.getRecord(['call_outcome']);

  return alert.call_outcome === 'DENIED'
    ? 'Account takeover: the customer did not make this payment'
    : 'Suspected scam';
}

function customizeAlerts(collection) {
  collection.addAction('Start review', { scope: 'Single', execute: startReview });
  collection.addAction('Check device and IP', { scope: 'Single', execute: checkDevice });
  collection.addAction('Call the customer', { scope: 'Single', execute: callCustomer });
  collection.addAction('Send for a second look', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'String',
        widget: 'TextArea',
        description: 'What you are not sure about: the senior reads it first',
      },
    ],
    execute: sendForSecondLook,
  });
  collection.addAction('Clear alert', {
    scope: 'Single',
    form: [
      {
        label: 'Clearance reason',
        type: 'Enum',
        enumValues: enumOf('alerts', 'clearance_reason'),
        isRequired: true,
        defaultValue: defaultClearReason,
      },
      {
        label: 'Note',
        type: 'String',
        widget: 'TextArea',
        description: 'Pre-filled from the alert type or the call: adjust it to what you checked',
        defaultValue: defaultClearNote,
      },
    ],
    execute: clearAlert,
  });
  collection.addAction('Escalate', {
    scope: 'Single',
    form: [
      {
        label: 'Priority',
        type: 'Enum',
        enumValues: enumOf('investigations', 'priority'),
        defaultValue: defaultPriority,
      },
      { label: 'Summary', type: 'String', widget: 'TextArea', defaultValue: defaultSummary },
    ],
    execute: escalateAlert,
  });
  collection.addAction('Revoke device', { scope: 'Single', execute: revokeDevice });
  collection.addAction('Freeze account', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'Enum',
        enumValues: enumOf('accounts', 'freeze_reason'),
        isRequired: true,
        defaultValue: 'FRAUD_SUSPICION',
      },
      { label: 'Note', type: 'String' },
    ],
    execute: freezeFromAlert,
  });
  collection.addAction('Unfreeze account', { scope: 'Single', execute: unfreezeFromAlert });
  collection.addAction('Recall transfer', { scope: 'Single', execute: recallTransfer });
  collection.addAction('Refund the customer (PSD2)', { scope: 'Single', execute: refundCustomer });
  collection.addAction('Approve transfer', { scope: 'Single', execute: approveTransfer });
  collection.addAction('Reject transfer', {
    scope: 'Single',
    form: [
      { label: 'Reason', type: 'String', isRequired: true, defaultValue: defaultRejectReason },
    ],
    execute: rejectTransfer,
  });
}

// ---------------------------------------------------------------------------------------------
// Screening hits
// ---------------------------------------------------------------------------------------------

const HIT_FIELDS = [
  'id',
  'reference',
  'status',
  'hit_type',
  'individual_id',
  'business_id',
  'counterparty_id',
  'transaction_id',
  'investigation_id',
  'screened_name',
  'watchlist_entry_id',
];

async function openHit(context) {
  const hit = await context.getRecord(HIT_FIELDS);
  const error =
    hit.status === 'OPEN' ? null : `${hit.reference} is decided already (${hit.status}).`;

  return { hit, error };
}

/** The customers behind a hit: the person's accounts, the company's, or the payer's. */
async function customersOfHit(d, hit) {
  if (hit.individual_id) {
    const members = await d.list(
      'customer_members',
      [eq('individual_id', hit.individual_id)],
      ['customer_id'],
    );

    return members.map(m => m.customer_id);
  }

  if (hit.business_id) {
    const customers = await d.list('customers', [eq('business_id', hit.business_id)], ['id']);

    return customers.map(c => c.id);
  }

  const tx = await d.one('transactions', hit.transaction_id, ['account_id']);
  const account = await d.one('accounts', tx?.account_id, ['customer_id']);

  return account ? [account.customer_id] : [];
}

/** The reason the comparison gives: another birth date, another country, or another kind. */
async function defaultDiscardReason(context) {
  const d = db(context);
  const hit = await context.getRecord(['individual_id', 'watchlist_entry_id']);
  const entry = await d.one('watchlist_entries', hit.watchlist_entry_id, [
    'date_of_birth',
    'entity_type',
  ]);
  const person = await d.one('individuals', hit.individual_id, ['date_of_birth']);
  if (person && entry?.entity_type !== 'PERSON') return DISCARD_REASONS[2];

  if (person && entry?.date_of_birth && entry.date_of_birth !== person.date_of_birth) {
    return DISCARD_REASONS[0];
  }

  return DISCARD_REASONS[1];
}

/** The customers a hit's person or company stands behind: holder, company, or its director. */
async function customersOfSubject(d, hit) {
  if (hit.business_id) {
    return (await d.list('customers', [eq('business_id', hit.business_id)], ['id'])).map(c => c.id);
  }

  if (!hit.individual_id) return [];
  const holders = await d.list(
    'customer_members',
    [eq('individual_id', hit.individual_id)],
    ['customer_id'],
  );
  const roles = await d.list(
    'business_members',
    [eq('individual_id', hit.individual_id)],
    ['business_id'],
  );
  const companies = roles.length
    ? await d.list(
        'customers',
        [
          eq(
            'business_id',
            roles.map(r => r.business_id),
          ),
        ],
        ['id'],
      )
    : [];

  return [...holders.map(h => h.customer_id), ...companies.map(c => c.id)];
}

/** KYC cases parked for screening on the hit's person or company, the case's other hits cleared. */
async function casesToRelease(d, hit) {
  const customers = await customersOfSubject(d, hit);
  if (!customers.length) return [];
  const parked = await d.list(
    'kyc_cases',
    [
      eq('customer_id', customers),
      eq('status', 'ESCALATED'),
      eq('escalation_reason', 'Screening hit to review'),
    ],
    KYC_FIELDS,
  );
  const free = await Promise.all(
    parked.map(async kyc => {
      const { people, business } = await caseParties(d, kyc);
      const subjects = [
        people.length &&
          eq(
            'individual_id',
            people.map(p => p.id),
          ),
        business && eq('business_id', business.id),
      ].filter(Boolean);
      const open = await d.list(
        'screening_hits',
        [ConditionTreeFactory.union(...subjects), eq('status', 'OPEN')],
        ['id'],
      );

      return open.length ? null : kyc;
    }),
  );

  return free.filter(Boolean);
}

/** Who the hit is about on our side, as its evidence says it (evidence/screening.ts). */
async function hitParty(context) {
  const side = await context.getRecord(['customer_name', 'customer_relationship']);

  return [
    ['Customer', side.customer_name],
    ['Relationship', side.customer_relationship],
  ];
}

/** "sanctions" or "PEP", inside a sentence. */
const hitKind = hit => (hit.hit_type === 'PEP' ? 'PEP' : label(hit.hit_type));

/** The list entry a hit matched, with its regime and kind (sanctions or PEP). */
const entryLine = (hit, entry) =>
  entry &&
  `${entry.name} · ${entry.list}${entry.regime ? ` · ${entry.regime}` : ''} · ${codeText(
    hit.hit_type,
  )}`;

async function discardHit(context, resultBuilder) {
  const d = db(context);
  const { hit, error } = await openHit(context);
  if (error) return resultBuilder.error(error);

  const { Reason: reason, Note: note } = context.formValues;
  const decision = note ? `${reason}: ${note}` : reason;
  await d.update('screening_hits', [eq('id', hit.id)], {
    status: 'FALSE_POSITIVE',
    reviewed_by: d.email,
    reviewed_at: now(),
    decision_reason: decision,
  });
  await logStatus(d, 'screening_hits', hit.id, 'OPEN', 'FALSE_POSITIVE', decision);
  // An onboarding parked for this hit goes back to its queue once nothing is left to decide.
  const released = await casesToRelease(d, hit);
  await Promise.all(
    released.map(kyc => moveCase(d, kyc, 'IN_REVIEW', `Screening hit ${hit.reference} cleared`)),
  );
  const back = released.length
    ? ` ${released.map(k => k.reference).join(', ')} back in the onboarding queue.`
    : '';
  const [entry, tx] = await Promise.all([
    d.one('watchlist_entries', hit.watchlist_entry_id, ['list', 'name', 'regime']),
    d.one('transactions', hit.transaction_id, [...TX_FIELDS, 'counterparty:name']),
  ]);
  const stillHeld = tx?.status === 'HELD';
  const held = stillHeld ? ' The held payment can be released now.' : '';
  const html = card({
    eyebrow: `Screening decision · ${d.email}`,
    title: `${hit.reference} discarded: false positive`,
    status: ['False positive', 'green'],
    rows: [
      ['Name screened', hit.screened_name],
      ...(await hitParty(context)),
      ['List entry', entryLine(hit, entry)],
      ['Reason', decision],
      [
        'Onboarding',
        released.length
          ? `${released.map(k => k.reference).join(', ')} back in the onboarding queue`
          : null,
      ],
      [
        'Held payment',
        stillHeld
          ? `${euros(tx.amount)} to ${tx.counterparty?.name || 'the payee'}, still held`
          : 'None held',
      ],
    ],
    note: stillHeld
      ? 'The hit is closed. The payment stays held until it is released: release it next.'
      : 'The hit is closed and leaves "Screening hits": nothing else to do.',
  });

  return resultBuilder.success(`${hit.reference} discarded as a false positive.${back}${held}`, {
    html,
  });
}

/** Marks the subject: sanctioned person or company, blocked counterparty, or PEP. */
function flagSubject(d, hit) {
  if (hit.hit_type === 'PEP') {
    return hit.individual_id
      ? d.update('individuals', [eq('id', hit.individual_id)], { is_pep: true, updated_at: now() })
      : null;
  }

  if (hit.individual_id) {
    return d.update('individuals', [eq('id', hit.individual_id)], {
      is_sanctioned: true,
      updated_at: now(),
    });
  }

  if (hit.business_id) {
    return d.update('businesses', [eq('id', hit.business_id)], {
      is_sanctioned: true,
      updated_at: now(),
    });
  }

  return d.update('counterparties', [eq('id', hit.counterparty_id)], {
    is_blocked: true,
    blocked_at: now(),
    block_reason: `Sanctions list match (${hit.reference})`,
  });
}

/** The money left on a frozen account is held for the DG Trésor: nothing can be paid out of it. */
async function holdFrozenMoney(d, hit, accounts) {
  const nextHold = await referenceMaker(d, 'holds', 'HLD');
  await accounts
    .filter(a => money(a.available_balance) > 0)
    .reduce(async (previous, a) => {
      await previous;
      const hold = await d.create('holds', {
        reference: nextHold(),
        account_id: a.id,
        screening_hit_id: hit.id,
        reason: 'SANCTIONS',
        amount: money(a.available_balance),
        status: 'ACTIVE',
        placed_by: d.email,
        placed_at: now(),
      });
      await d.update('accounts', [eq('id', a.id)], { available_balance: 0 });
      await logStatus(d, 'holds', hold.id, null, 'ACTIVE', `Asset freeze ${hit.reference}`);
    }, Promise.resolve());
}

/**
 * An asset freeze: every open account of the subject's customers is frozen, their cards blocked
 * and the money held, until the DG Trésor says otherwise.
 */
async function freezeSubjectAccounts(d, hit) {
  if (hit.hit_type !== 'SANCTIONS' || hit.counterparty_id) return { ibans: [], cards: 0 };

  const customers = await customersOfHit(d, hit);
  if (!customers.length) return { ibans: [], cards: 0 };

  const accounts = await d.list(
    'accounts',
    [eq('customer_id', customers), eq('status', ['ACTIVE', 'DORMANT'])],
    ['id', 'iban', 'status', 'available_balance'],
  );
  const note = `Asset freeze: confirmed sanctions match ${hit.reference}. Reported to the DG Trésor.`;
  await Promise.all(accounts.map(a => freeze(d, a, 'SANCTIONS', note)));
  const cards = accounts.length
    ? await d.list(
        'cards',
        [
          eq(
            'account_id',
            accounts.map(a => a.id),
          ),
          eq('status', ['ACTIVE', 'PENDING']),
        ],
        ['id'],
      )
    : [];

  if (cards.length) {
    await d.update(
      'cards',
      [
        eq(
          'id',
          cards.map(c => c.id),
        ),
      ],
      { status: 'BLOCKED', blocked_reason: 'AML_FREEZE', blocked_at: now() },
    );
  }

  await holdFrozenMoney(d, hit, accounts);

  return { ibans: accounts.map(a => a.iban), cards: cards.length };
}

async function confirmHit(context, resultBuilder) {
  const d = db(context);
  const { hit, error } = await openHit(context);
  if (error) return resultBuilder.error(error);

  // A sanctions match is reported to the DG Trésor at once, whether we froze accounts or a payment.
  const report =
    hit.hit_type === 'SANCTIONS' ? freezeReport(hit.id, new Date().getUTCFullYear()) : null;
  const reported = report ? ` Reported to ${PROVIDERS.dgTresor} (simulated): ${report}.` : '';
  const note = context.formValues.Note || `Confirmed ${hit.hit_type} match`;
  await d.update('screening_hits', [eq('id', hit.id)], {
    status: 'TRUE_MATCH',
    reviewed_by: d.email,
    reviewed_at: now(),
    decision_reason: `${note}${reported}`,
  });
  await logStatus(d, 'screening_hits', hit.id, 'OPEN', 'TRUE_MATCH', note);
  await flagSubject(d, hit);
  const frozen = await freezeSubjectAccounts(d, hit);
  const cards = frozen.cards ? ` ${frozen.cards} card(s) blocked.` : '';
  const freezeNote = frozen.ibans.length
    ? ` Accounts frozen: ${frozen.ibans.join(', ')}.${cards}`
    : '';
  // A payment to a listed party is never sent: the payer gets the money set aside back.
  const tx = await d.one('transactions', hit.transaction_id, TX_FIELDS);
  let paymentNote = '';

  if (tx?.status === 'HELD') {
    await rejectHeld(d, tx, `Not sent: payee on a sanctions list (${hit.reference})`);
    paymentNote = ` Payment of ${euros(tx.amount)} not sent.`;
  }

  const entry = await d.one('watchlist_entries', hit.watchlist_entry_id, [
    'list',
    'name',
    'regime',
  ]);
  const html = card({
    eyebrow: `Screening decision · ${d.email}`,
    title: `${hit.reference} confirmed: true ${hitKind(hit)} match`,
    status: ['True match', 'red'],
    rows: [
      ['Name screened', hit.screened_name],
      ...(await hitParty(context)),
      ['List entry', entryLine(hit, entry)],
      ['Analyst', d.email],
      ['Second analyst', 'Approves the match before it runs (four eyes, role setting)'],
      ['Accounts frozen', frozen.ibans.length ? frozen.ibans.join(', ') : 'None'],
      ['Cards blocked', frozen.cards ? String(frozen.cards) : null],
      ['Payment', tx?.status === 'HELD' ? `${euros(tx.amount)} not sent` : null],
      ['DG Trésor report', report ? `${report} (simulated)` : null],
    ],
    note: 'The match goes to the MLRO next, as an urgent sanctions investigation due today.',
  });

  return resultBuilder.success(
    `${hit.reference} confirmed as a ${hitKind(hit)} match.${freezeNote}${paymentNote}${reported}`,
    { html },
  );
}

/** Holds placed for this hit are released: the money set aside is available again; the total. */
async function releaseHolds(d, hit) {
  const holds = await d.list(
    'holds',
    [eq('screening_hit_id', hit.id), eq('status', 'ACTIVE')],
    ['id', 'account_id', 'amount'],
  );
  await holds.reduce(async (previous, hold) => {
    await previous;
    const account = await d.one('accounts', hold.account_id, ['id', 'available_balance']);
    await d.update('accounts', [eq('id', account.id)], {
      available_balance: money(account.available_balance + money(hold.amount)),
    });
    await d.update('holds', [eq('id', hold.id)], {
      status: 'RELEASED',
      released_at: now(),
      released_by: d.email,
      release_reason: `False positive ${hit.reference}`,
    });
    await logStatus(d, 'holds', hold.id, 'ACTIVE', 'RELEASED', `False positive ${hit.reference}`);
  }, Promise.resolve());

  return money(holds.reduce((sum, hold) => sum + money(hold.amount), 0));
}

async function releaseHeldPayment(context, resultBuilder) {
  const d = db(context);
  const hit = await context.getRecord(HIT_FIELDS);

  if (hit.status !== 'FALSE_POSITIVE') {
    return resultBuilder.error(
      `${hit.reference} is ${hit.status}: only a false positive releases the payment.`,
    );
  }

  const tx = await d.one('transactions', hit.transaction_id, [
    ...TX_FIELDS,
    'counterparty:name',
    'account:iban',
  ]);

  if (!tx || tx.status !== 'HELD') {
    return resultBuilder.error(`${hit.reference} has no held payment to release.`);
  }

  await bookHeld(d, tx);
  const freed = await releaseHolds(d, hit);
  const sent = await d.one('transactions', tx.id, ['booked_at', 'balance_after']);
  const html = card({
    eyebrow: resultsFrom(PROVIDERS.sepa, 'payment released'),
    title: `${euros(tx.amount)} released and sent`,
    status: ['Sent', 'green'],
    rows: [
      ['Screening hit', `${hit.reference} · false positive`],
      ...(await hitParty(context)),
      ['Payee', tx.counterparty?.name],
      ['From', tx.account?.iban],
      ['Payment reference', tx.reference],
      ['Sent at', frStamp(sent.booked_at)],
      ['Balance after', euros(sent.balance_after)],
      ['Money set aside', freed > 0 ? `${euros(freed)} released` : null],
    ],
    note: 'The payment left through the SEPA network; the hit is closed. Nothing else to do.',
  });

  return resultBuilder.success(
    `Payment "${tx.reference || ''}" of ${euros(tx.amount)} released and sent (${
      PROVIDERS.sepa
    }, simulated).`,
    { html },
  );
}

/** What the true match did (Confirm true match), read back for the MLRO: the case file. */
async function mlroCard(d, hit, { customers, entry, tx, investigation, party }) {
  const frozen = customers.length
    ? await d.list(
        'accounts',
        [eq('customer_id', customers), eq('freeze_reason', 'SANCTIONS')],
        ['id', 'iban'],
      )
    : [];
  const [cards, holds] = await Promise.all([
    frozen.length
      ? d.list(
          'cards',
          [
            eq(
              'account_id',
              frozen.map(a => a.id),
            ),
            eq('status', 'BLOCKED'),
          ],
          ['id'],
        )
      : [],
    d.list('holds', [eq('screening_hit_id', hit.id), eq('status', 'ACTIVE')], ['amount']),
  ]);
  const held = money(holds.reduce((sum, h) => sum + money(h.amount), 0));

  return card({
    eyebrow: `Sent to the MLRO · ${d.email}`,
    title: `Investigation ${investigation.reference}`,
    status: ['Waiting for the MLRO', 'red'],
    rows: [
      ['Screening hit', `${hit.reference} · true ${hitKind(hit)} match`],
      ['Name screened', hit.screened_name],
      ...party,
      ['List entry', entryLine(hit, entry)],
      ['Decided by', `${hit.reviewed_by}, ${frStamp(hit.reviewed_at)}`],
      [
        'DG Trésor report',
        hit.hit_type === 'SANCTIONS'
          ? `${freezeReport(hit.id, new Date(hit.reviewed_at).getUTCFullYear())} (simulated)`
          : null,
      ],
      ['Accounts frozen', frozen.length ? frozen.map(a => a.iban).join(', ') : 'None'],
      ['Cards blocked', cards.length ? String(cards.length) : null],
      ['Money held', held > 0 ? euros(held) : null],
      [
        'Payment stopped',
        tx
          ? `${euros(tx.amount)} ${tx.status === 'REJECTED' ? 'not sent' : label(tx.status)}`
          : null,
      ],
      ['Case', 'Sanctions · priority urgent · due today'],
    ],
    note: 'The MLRO finds the case in "Waiting for MLRO" on the MLRO desk. The hit leaves "Screening hits".',
  });
}

async function escalateToMlro(context, resultBuilder) {
  const d = db(context);
  const hit = await context.getRecord([...HIT_FIELDS, 'reviewed_by', 'reviewed_at']);

  if (hit.investigation_id) {
    const linked = await d.one('investigations', hit.investigation_id, ['reference']);

    return resultBuilder.error(
      `${hit.reference} is already with investigation ${linked?.reference}.`,
    );
  }

  if (hit.status !== 'TRUE_MATCH') {
    return resultBuilder.error(
      `${hit.reference} is ${hit.status}: run "Confirm true match" before sending it to the MLRO.`,
    );
  }

  const customers = await customersOfHit(d, hit);
  const [customerId] = customers;
  const entry = await d.one('watchlist_entries', hit.watchlist_entry_id, [
    'list',
    'name',
    'regime',
  ]);
  const tx = await d.one('transactions', hit.transaction_id, ['id', 'amount', 'status']);
  const note = context.formValues.Note;
  const investigation = await d.create('investigations', {
    customer_id: customerId || null,
    type: 'SANCTIONS',
    origin: 'SCREENING_HIT',
    status: 'PENDING_MLRO',
    opened_at: now(),
    sent_to_mlro_at: now(),
    // An asset freeze is checked and reported without delay: due today, not in 30 days.
    due_at: now(),
    // The rule: a confirmed sanctions match is the MLRO's most urgent case.
    priority: 'URGENT',
    amount_involved: tx ? money(tx.amount) : null,
    summary: `Confirmed ${hit.hit_type.toLowerCase()} match ${hit.reference}: ${
      hit.screened_name
    } is on the ${entry?.list} list (${entry?.regime || 'no regime stated'}).${
      tx ? ` A payment of ${euros(tx.amount)} to them was stopped.` : ''
    }${note ? ` ${note}` : ''}`,
    reference: await nextReference(d, 'investigations', 'INV'),
  });
  await logStatus(
    d,
    'investigations',
    investigation.id,
    null,
    'PENDING_MLRO',
    `From ${hit.reference}`,
  );
  await d.update('screening_hits', [eq('id', hit.id)], { investigation_id: investigation.id });

  // The stopped payment is the case's evidence; it goes to the DG Trésor, not into a SAR.
  if (tx) {
    await d.create('investigation_transactions', {
      investigation_id: investigation.id,
      transaction_id: tx.id,
      included_in_sar: false,
      note: `Payment stopped by screening (${hit.reference}), reported to the DG Trésor`,
      added_by: d.email,
      added_at: now(),
    });
  }

  const html = await mlroCard(d, hit, {
    customers,
    entry,
    tx,
    investigation,
    party: await hitParty(context),
  });

  return resultBuilder.success(
    `${hit.reference} sent to the MLRO in ${investigation.reference}, out of the screening queue.`,
    { html },
  );
}

function customizeScreeningHits(collection) {
  collection.addAction('Discard as false positive', {
    scope: 'Single',
    form: [
      {
        label: 'Reason',
        type: 'Enum',
        enumValues: DISCARD_REASONS,
        isRequired: true,
        defaultValue: defaultDiscardReason,
      },
      { label: 'Note', type: 'String' },
    ],
    execute: discardHit,
  });
  collection.addAction('Confirm true match', {
    scope: 'Single',
    form: [{ label: 'Note', type: 'String', widget: 'TextArea' }],
    execute: confirmHit,
  });
  collection.addAction('Release held payment', { scope: 'Single', execute: releaseHeldPayment });
  collection.addAction('Escalate to MLRO', {
    scope: 'Single',
    form: [{ label: 'Note', type: 'String', widget: 'TextArea' }],
    execute: escalateToMlro,
  });
}

// ---------------------------------------------------------------------------------------------
// One document: the same checks as the case actions, run from the document itself
// ---------------------------------------------------------------------------------------------

const COMPANY_PAPERS = ['COMPANY_REGISTRATION', 'ARTICLES_OF_ASSOCIATION', 'UBO_DECLARATION'];
const REJECTIONS = [
  'Expired',
  'Unreadable or blurry',
  'Document cut off',
  'Name does not match the application',
  'Older than 3 months',
  'Not the document asked for',
  'Suspected forgery',
];

async function verifyOneDocument(context, resultBuilder) {
  const d = db(context);
  const doc = await context.getRecord(ID_DOC_FIELDS);
  // A selfie is checked with its person's ID: the provider matches the face to the photo.
  const target =
    doc.document_type === 'SELFIE'
      ? (
          await d.list(
            'documents',
            [
              eq('kyc_case_id', doc.kyc_case_id),
              eq('individual_id', doc.individual_id),
              eq('document_type', ID_TYPES),
            ],
            ID_DOC_FIELDS,
            { field: 'uploaded_at', ascending: false },
          )
        )[0]
      : doc;

  if (!target || !ID_TYPES.includes(target.document_type)) {
    return resultBuilder.error(
      `The ${PROVIDERS.idCheck.toLowerCase()} checks IDs and selfies. For company papers run "Check against the register"; for other papers, "Accept" or "Reject with a reason".`,
    );
  }

  const { message, html } = idCheckResult(await runIdChecks(d, [target]));

  return resultBuilder.success(message, { html });
}

async function registerOneDocument(context, resultBuilder) {
  const d = db(context);
  const doc = await context.getRecord(['document_type', 'kyc_case_id', 'business_id']);

  if (!COMPANY_PAPERS.includes(doc.document_type) || !doc.business_id || !doc.kyc_case_id) {
    return resultBuilder.error(
      'The company register only checks company papers on a KYC case (Kbis extract, articles of association, beneficial owners declaration).',
    );
  }

  const kyc = await d.one('kyc_cases', doc.kyc_case_id, KYC_FIELDS);
  const { message, html } = await registerCheck(d, kyc, { id: doc.business_id });

  return resultBuilder.success(message, { html });
}

async function acceptDocument(context, resultBuilder) {
  const d = db(context);
  const doc = await context.getRecord(['id', 'document_type', 'check_result']);

  if (doc.check_result === 'PASSED') {
    return resultBuilder.error(`This ${label(doc.document_type)} has passed its check already.`);
  }

  await d.update('documents', [eq('id', doc.id)], {
    check_result: 'PASSED',
    failure_reason: null,
    verified: true,
    verified_at: now(),
    verified_by: d.email,
  });
  const note = context.formValues.Note ? ` (${context.formValues.Note})` : '';

  return resultBuilder.success(`${label(doc.document_type)} accepted, reviewed by you${note}.`);
}

async function rejectDocument(context, resultBuilder) {
  const d = db(context);
  const doc = await context.getRecord(['id', 'document_type']);
  const { Reason: reason, Note: note } = context.formValues;
  const why = note ? `${reason}: ${note}` : reason;
  await d.update('documents', [eq('id', doc.id)], {
    check_result: 'FAILED',
    failure_reason: why,
    verified: false,
    verified_at: now(),
    verified_by: d.email,
  });

  return resultBuilder.success(
    `${label(
      doc.document_type,
    )} rejected: ${why}. Ask for a new one with "Request ID document" or "Request company documents" on the case.`,
  );
}

function customizeDocuments(collection) {
  collection.addAction('Verify document', { scope: 'Single', execute: verifyOneDocument });
  collection.addAction('Check against the register', {
    scope: 'Single',
    execute: registerOneDocument,
  });
  collection.addAction('Accept', {
    scope: 'Single',
    form: [{ label: 'Note', type: 'String', description: 'Optional: what you checked' }],
    execute: acceptDocument,
  });
  collection.addAction('Reject with a reason', {
    scope: 'Single',
    form: [
      { label: 'Reason', type: 'Enum', enumValues: REJECTIONS, isRequired: true },
      { label: 'Note', type: 'String', description: 'Optional: details for the file' },
    ],
    execute: rejectDocument,
  });
}

// ---- Change preferred language: an action whose effect shows on the data at once -------------

const LANGUAGE_NAMES = {
  FR: 'French',
  EN: 'English',
  DE: 'German',
  ES: 'Spanish',
  IT: 'Italian',
  NL: 'Dutch',
};
const languageLabel = code => (code ? `${LANGUAGE_NAMES[code] || code} (${code})` : null);
const LANGUAGES = enumOf('customers', 'preferred_language').map(languageLabel);
const languageCode = text => /\((\w+)\)$/.exec(text || '')?.[1] || null;
const CUSTOMER_LANGUAGE_FIELDS = ['id', 'reference', 'display_name', 'preferred_language'];

/**
 * "Change preferred language" on a table whose record leads to a customer (`customerIdOf`): a
 * dropdown of the languages, the customer's own first; the customer row changes and its history
 * gets the line.
 */
function languageAction(customerIdOf) {
  const customerOf = async context => {
    const d = db(context);

    return {
      d,
      customer: await d.one('customers', await customerIdOf(context), CUSTOMER_LANGUAGE_FIELDS),
    };
  };

  return {
    scope: 'Single',
    form: [
      {
        label: 'Language',
        type: 'Enum',
        enumValues: LANGUAGES,
        isRequired: true,
        description: 'Letters, emails and calls to the customer use it',
        defaultValue: async context =>
          languageLabel((await customerOf(context)).customer?.preferred_language),
      },
    ],
    execute: async (context, resultBuilder) => {
      const { d, customer } = await customerOf(context);
      if (!customer) return resultBuilder.error('No customer on this record.');
      const to = languageCode(context.formValues.Language);
      if (!to) return resultBuilder.error('Pick a language.');
      const from = customer.preferred_language || null;

      if (to === from) {
        return resultBuilder.success(
          `${customer.display_name} already speaks ${languageLabel(to)} with us: nothing changed.`,
        );
      }

      await d.update('customers', [eq('id', customer.id)], {
        preferred_language: to,
        updated_at: now(),
      });
      await d.create('status_changes', {
        record_type: 'CUSTOMERS',
        record_id: customer.id,
        field: 'preferred_language',
        old_value: from,
        new_value: to,
        changed_by: d.email,
        changed_at: now(),
        reason: 'Preferred language changed',
      });

      return resultBuilder.success(
        `${customer.display_name}: preferred language ${
          languageLabel(from) || 'none'
        } → ${languageLabel(to)}.`,
      );
    },
  };
}

/** "Change preferred language" on a KYC case: the language of its customer. */
function addLanguageOnCase(collection) {
  collection.addAction(
    'Change preferred language',
    languageAction(async context => (await context.getRecord(['customer_id'])).customer_id),
  );
}

/** "Change preferred language" on a customer. */
function addLanguageOnCustomer(collection) {
  collection.addAction(
    'Change preferred language',
    languageAction(async context => (await context.getRecord(['id'])).id),
  );
}

export {
  addLanguageOnCase,
  addLanguageOnCustomer,
  customizeAlerts,
  customizeDocuments,
  customizeKycCases,
  customizeScreeningHits,
};
