/**
 * A day in the life of the bank: new cases arrive while the demo runs, so the inboxes fill up live.
 * An inbox is a segment (a filter on a collection): a new row that matches it shows up in it.
 *
 * What arrives, and the demo inbox it lands in:
 * - retail and business applicants: a new person or company, the customer in ONBOARDING, an OPEN
 *   onboarding KYC case and the documents sent from the app (Retail / Business onboarding);
 * - AML and fraud alerts, OPEN and unassigned, on real customers and their recent transactions
 *   (AML alerts / Fraud and takeover alerts);
 * - screening hits: a real customer against a homonym just put on a list (Screening hits);
 * - transfers above the 10,000 EUR validation threshold, PENDING (Transfers to validate);
 * - dispute requests on recent card payments, NEW (New disputes);
 * - recalls other banks send us, OPEN (Recalls we received); a fraud recall also raises its
 *   INCOMING_FRAUD_RECALL alert (Fraud and takeover alerts) and holds what is left of the money.
 * Every case gets the next reference of its series and its status history (status_changes).
 *
 * Cases that match no inbox, on purpose: an adverse-media KYC review (type EVENT_REVIEW). No demo
 * inbox takes it: a catch-all inbox would need the segment "kyc_cases: status is OPEN and
 * type is not ONBOARDING". Unusual ones that still land in their inbox: a fraud alert raised by
 * hand after a customer's call (no rule), a dispute about a Wero payment to a scammer, a recall for
 * a technical error.
 *
 * The way in: the global Smart Action "Start the day" on customers (n cases per inbox, at most 5),
 * written through Forest's collections so the agent sees them at once (customizations/customers.js).
 */
const { randomUUID } = require('crypto');

const { siren, vatNumber } = require('./business');
const { COUNTRIES, LANGUAGE, MONTHLY_NET } = require('./reference');
const { homeAddress, person } = require('./retail');

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const MAX_PER_KIND = 5;
const BANK = 'forest-lab-bank.fr';

// ---- randomness (not the seeded stream: every live day is different) ---------------------------

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const oneOf = list => list[Math.floor(Math.random() * list.length)];
const hex = n => Array.from({ length: n }, () => rnd(0, 15).toString(16)).join('');
const round2 = n => Math.round(Number(n) * 100) / 100;
const shuffle = list =>
  list
    .map(item => [Math.random(), item])
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
const isoDay = d => d.toISOString().slice(0, 10);
const toDate = v => new Date(v);
const upper = s => String(s || '').toUpperCase();
const euros = n => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`;
const mail = name => `${name}@${BANK}`;
const title = code => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ');

/** Run fn on each item, one after the other. */
const sequence = (items, fn) =>
  items.reduce(
    (done, item, k) => done.then(async acc => [...acc, await fn(item, k)]),
    Promise.resolve([]),
  );

/** The first candidate fn turns into something (not null), trying them in order. */
async function firstOf(candidates, fn) {
  if (!candidates.length) return null;
  const found = await fn(candidates[0]);

  return found || firstOf(candidates.slice(1), fn);
}

/** 15 business days ahead: the deadline the SEPA rulebook gives to answer a recall. */
function businessDays(from, n) {
  const d = new Date(from);
  let left = n;

  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1;
  }

  return d;
}

// ---- stores: one API over Forest's collections (the action) or knex (the timer) ----------------
// where: [[field, op, value]], op in = in !in > < like null !null. Dates are Date objects.

const FOREST_OPS = {
  '=': 'Equal',
  in: 'In',
  '!in': 'NotIn',
  '>': 'GreaterThan',
  '<': 'LessThan',
  like: 'StartsWith',
  null: 'Missing',
  '!null': 'Present',
};
const emptyIn = where => where.some(([, op, v]) => op === 'in' && !v.length);

function forestStore(dataSource) {
  const coll = table => dataSource.getCollection(table);
  const value = v => (v instanceof Date ? v.toISOString() : v);
  const leaf = ([field, op, v]) => ({
    field,
    operator: FOREST_OPS[op],
    ...(op === 'null' || op === '!null' ? {} : { value: value(v) }),
  });

  return {
    stamp: d => d.toISOString(),
    async list(table, where, fields, { sort, limit } = {}) {
      if (emptyIn(where)) return [];
      const filter = {};
      if (where.length) filter.conditionTree = { aggregator: 'And', conditions: where.map(leaf) };
      if (sort) filter.sort = [{ field: sort[0], ascending: sort[1] !== 'desc' }];
      if (limit) filter.page = { skip: 0, limit };

      return coll(table).list(filter, fields);
    },
    insert: (table, row) => coll(table).create([row]),
    patch: (table, id, values) =>
      coll(table).update({ conditionTree: { field: 'id', operator: 'Equal', value: id } }, values),
  };
}

// The seed's format: 2026-10-22 22:23:31.952 +00:00.
const dbStamp = d => d.toISOString().replace('T', ' ').replace('Z', ' +00:00');
const sqlRow = row =>
  Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, typeof v === 'boolean' ? Number(v) : v]),
  );

function knexWhere(query, [field, op, v]) {
  const value = v instanceof Date ? dbStamp(v) : v;
  if (op === 'in') return query.whereIn(field, value);
  if (op === '!in') return query.whereNotIn(field, value);
  if (op === 'like') return query.where(field, 'like', `${value}%`);
  if (op === 'null') return query.whereNull(field);
  if (op === '!null') return query.whereNotNull(field);

  return query.where(field, op, value);
}

function knexStore(db) {
  return {
    stamp: dbStamp,
    async list(table, where, fields, { sort, limit } = {}) {
      if (emptyIn(where)) return [];
      const query = db(table).select(fields);
      where.forEach(condition => knexWhere(query, condition));
      if (sort) query.orderBy(sort[0], sort[1] === 'desc' ? 'desc' : 'asc');
      if (limit) query.limit(limit);

      return query;
    },
    insert: (table, row) => db(table).insert(sqlRow(row)),
    patch: (table, id, values) => db(table).where({ id }).update(sqlRow(values)),
  };
}

// ---- shared writing helpers --------------------------------------------------------------------

/** One run: the store, the moment, and what was already picked (never twice the same). */
function newRun(store) {
  const now = new Date(Date.now() - 1000);

  return {
    store,
    now,
    used: new Set(),
    at: minutesAgo => store.stamp(new Date(now.getTime() - minutesAgo * MINUTE)),
    stamp: d => store.stamp(d),
  };
}

const list = (run, ...args) => run.store.list(...args);
const insert = (run, table, row) => run.store.insert(table, row);
const patch = (run, table, id, values) => run.store.patch(table, id, values);

async function byIds(run, table, ids, fields) {
  const rows = await list(run, table, [['id', 'in', [...new Set(ids)]]], ['id', ...fields]);

  return new Map(rows.map(r => [r.id, r]));
}

/** PREFIX-YEAR-NUMBER, the next number of the series this year. */
async function nextReference(run, table, prefix) {
  const start = `${prefix}-${run.now.getUTCFullYear()}-`;
  const [last] = await list(run, table, [['reference', 'like', start]], ['reference'], {
    sort: ['reference', 'desc'],
    limit: 1,
  });
  const next = last ? Number(last.reference.slice(start.length)) + 1 : 1;

  return `${start}${String(next).padStart(6, '0')}`;
}

/** Status history: steps [status, minutesAgo, by, reason], oldest first. */
function history(run, type, id, steps) {
  return sequence(steps, ([status, minutesAgo, by, reason], k) =>
    insert(run, 'status_changes', {
      id: randomUUID(),
      record_type: type,
      record_id: id,
      field: 'status',
      old_value: k ? steps[k - 1][0] : null,
      new_value: status,
      changed_by: by || 'system',
      changed_at: run.at(minutesAgo),
      reason: reason || null,
    }),
  );
}

/** A case row with its reference, then its history. */
async function openCase(run, table, prefix, row, steps) {
  const created = { id: randomUUID(), reference: await nextReference(run, table, prefix), ...row };
  await insert(run, table, created);
  await history(run, table.toUpperCase(), created.id, steps);

  return created;
}

const listMove = (run, transactionId, links) =>
  insert(run, 'dispute_transactions', {
    id: randomUUID(),
    transaction_id: transactionId,
    role: 'DISPUTED',
    dispute_request_id: null,
    chargeback_id: null,
    sepa_dispute_id: null,
    ...links,
  });

// ---- picking real records ----------------------------------------------------------------------

const TX_FIELDS = ['id', 'account_id', 'amount', 'created_at', 'rail', 'direction', 'description'];

/** Booked movements of the last days, newest first, never one already used in this run. */
async function recentTx(run, where, days, limit = 300) {
  const rows = await list(
    run,
    'transactions',
    [
      ...where,
      ['status', '=', 'BOOKED'],
      ['created_at', '>', new Date(run.now.getTime() - days * DAY)],
    ],
    TX_FIELDS,
    { sort: ['created_at', 'desc'], limit },
  );

  return shuffle(rows.filter(t => !run.used.has(t.id)));
}

/** Keep movements on an active account of an active customer; adds account and customer. */
async function owned(run, txs, customerType) {
  const accounts = await byIds(
    run,
    'accounts',
    txs.map(t => t.account_id),
    ['customer_id', 'status', 'balance', 'available_balance'],
  );
  const customers = await byIds(
    run,
    'customers',
    [...accounts.values()].map(a => a.customer_id),
    ['status', 'customer_type', 'display_name', 'risk_rating'],
  );

  return txs
    .map(t => {
      const account = accounts.get(t.account_id);
      const customer = account && customers.get(account.customer_id);

      return { ...t, account, customer };
    })
    .filter(t => t.account?.status === 'ACTIVE' && t.customer?.status === 'ACTIVE')
    .filter(t => !customerType || t.customer.customer_type === customerType)
    .filter(t => !run.used.has(t.customer.id));
}

/** Drop customers who already have an alert waiting: one new alert per customer is enough. */
async function withoutOpenAlert(run, txs) {
  const busy = await list(
    run,
    'alerts',
    [
      ['customer_id', 'in', [...new Set(txs.map(t => t.customer.id))]],
      ['status', 'in', ['OPEN', 'IN_REVIEW']],
    ],
    ['customer_id'],
  );
  const taken = new Set(busy.map(a => a.customer_id));

  return txs.filter(t => !taken.has(t.customer.id));
}

/** The person who acts for the customer: the holder, or the company's signatory. */
async function holderOf(run, customerId) {
  const [member] = await list(
    run,
    'customer_members',
    [
      ['customer_id', '=', customerId],
      ['role', 'in', ['HOLDER', 'SIGNATORY']],
    ],
    ['individual_id', 'can_initiate_payments'],
  );

  return member || null;
}

async function counterpartyName(run, id) {
  if (!id) return null;
  const [row] = await list(run, 'counterparties', [['id', '=', id]], ['name']);

  return row?.name || null;
}

// ---- alerts ------------------------------------------------------------------------------------

async function ruleFor(run, type) {
  const [rule] = await list(
    run,
    'rules',
    [['name', '=', title(type)]],
    ['id', 'code', 'category', 'default_severity'],
  );

  return rule;
}

/** An OPEN alert, unassigned, its transactions (trigger first) and its first history line. */
async function openAlert(run, { type, customerId, lines, score, loginEventId, manual }) {
  const rule = manual ? null : await ruleFor(run, type);
  const by = manual ? manual.by : 'system';
  const alert = await openCase(
    run,
    'alerts',
    'ALR',
    {
      alert_type: type,
      category: manual ? manual.category : rule.category,
      rule_id: rule?.id || null,
      source: manual ? 'MANUAL' : 'RULE',
      created_by: by,
      customer_id: customerId,
      login_event_id: loginEventId || null,
      investigation_id: null,
      severity: score >= 90 ? 'CRITICAL' : rule?.default_severity || 'HIGH',
      score: score ?? null,
      status: 'OPEN',
      triggered_at: run.at(1),
      assigned_to: null,
      reviewed_by: null,
    },
    [['OPEN', 1, by, manual ? manual.why : rule.code]],
  );
  await sequence(lines, (tx, k) => {
    let role = k === 0 ? 'TRIGGER' : 'CONTEXT';
    if (manual) role = 'REPORTED';

    return insert(run, 'alert_transactions', { alert_id: alert.id, transaction_id: tx.id, role });
  });
  lines.forEach(tx => run.used.add(tx.id));
  run.used.add(customerId);

  return alert;
}

/** Other movements of the account: the context an analyst reads next to the trigger. */
async function accountLines(run, accountId, days) {
  return list(
    run,
    'transactions',
    [
      ['account_id', '=', accountId],
      ['status', '=', 'BOOKED'],
      ['created_at', '>', new Date(run.now.getTime() - days * DAY)],
    ],
    TX_FIELDS,
    { sort: ['created_at', 'desc'], limit: 60 },
  );
}

async function newAmlAlert(run) {
  const txs = await withoutOpenAlert(
    run,
    await owned(
      run,
      await recentTx(
        run,
        [
          ['rail', '=', 'TRANSFER'],
          ['direction', '=', 'DEBIT'],
          ['amount', '>', 1500],
        ],
        14,
      ),
    ),
  );
  const [trigger] = txs;
  if (!trigger) return null;
  const lines = (await accountLines(run, trigger.account_id, 30)).filter(t => t.id !== trigger.id);
  const before = toDate(trigger.created_at).getTime();
  const credit = lines.find(
    t =>
      t.direction === 'CREDIT' &&
      Number(t.amount) >= 0.8 * Number(trigger.amount) &&
      toDate(t.created_at).getTime() <= before &&
      before - toDate(t.created_at).getTime() < 3 * DAY,
  );
  const type = credit ? 'RAPID_MOVEMENT' : 'UNUSUAL_VOLUME';
  const context = credit
    ? [credit]
    : lines
        .filter(t => t.direction === 'DEBIT')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 2);
  const alert = await openAlert(run, {
    type,
    customerId: trigger.customer.id,
    lines: [trigger, ...context],
    score: round2(rnd(5500, 9400) / 100),
  });
  const why = credit
    ? `${euros(credit.amount)} in, ${euros(trigger.amount)} out within days`
    : `${euros(trigger.amount)} out, above the usual volume`;

  return {
    reference: alert.reference,
    text: `${title(type)}: ${trigger.customer.display_name}, ${why}`,
  };
}

const TRAVEL = [
  ['NG', 'Lagos', '102.89'],
  ['RO', 'Bucharest', '86.120'],
  ['BR', 'São Paulo', '177.92'],
  ['TH', 'Bangkok', '49.228'],
  ['MA', 'Casablanca', '105.66'],
];

/** A login from far away, minutes after a card payment in France: someone else has the access. */
async function impossibleTravel(run, payment) {
  const holder = await holderOf(run, payment.customer.id);
  if (!holder) return null;
  const [country, city, ip] = oneOf(TRAVEL);
  const device = {
    id: randomUUID(),
    individual_id: holder.individual_id,
    fingerprint: hex(32),
    platform: 'ANDROID',
    first_seen_at: run.at(13),
    is_trusted: false,
    device_name: oneOf(['Samsung Galaxy A14', 'Xiaomi Redmi Note 12', 'Google Pixel 6a']),
    last_seen_at: run.at(12),
    revoked_at: null,
    app_version: '7.14.5',
  };
  await insert(run, 'devices', device);
  const login = {
    id: randomUUID(),
    individual_id: holder.individual_id,
    device_id: device.id,
    ip_address: `${ip}.${rnd(1, 254)}.${rnd(1, 254)}`,
    country,
    city,
    success: true,
    risk_score: round2(rnd(7800, 9600) / 100),
    created_at: run.at(12),
    event_type: 'LOGIN',
    auth_method: 'PASSWORD',
    failure_reason: null,
  };
  await insert(run, 'login_events', login);
  const alert = await openAlert(run, {
    type: 'IMPOSSIBLE_TRAVEL',
    customerId: payment.customer.id,
    lines: [payment],
    score: login.risk_score,
    loginEventId: login.id,
  });

  return {
    reference: alert.reference,
    text: `Impossible travel: ${payment.customer.display_name}, login from ${city} on a new phone`,
  };
}

async function unusualCardSpend(run, payment) {
  const others = (await accountLines(run, payment.account_id, 7))
    .filter(t => t.rail === 'CARD' && t.direction === 'DEBIT' && t.id !== payment.id)
    .slice(0, 2);
  const alert = await openAlert(run, {
    type: 'UNUSUAL_CARD_SPEND',
    customerId: payment.customer.id,
    lines: [payment, ...others],
    score: round2(rnd(5000, 8500) / 100),
  });

  return {
    reference: alert.reference,
    text: `Unusual card spend: ${payment.customer.display_name}, ${euros(payment.amount)}`,
  };
}

/** Raised by hand: the customer called support about a payment they don't recognise (no rule). */
async function customerReport(run, payment) {
  const by = mail(oneOf(['yanis.mercier', 'chloe.lefevre', 'manon.dubois']));
  const alert = await openAlert(run, {
    type: 'CUSTOMER_REPORT',
    customerId: payment.customer.id,
    lines: [payment],
    manual: {
      by,
      category: 'FRAUD',
      why: 'Customer called: does not recognise this card payment',
    },
  });

  return {
    reference: alert.reference,
    text: `Customer report (raised by hand, no rule): ${payment.customer.display_name}, ${euros(
      payment.amount,
    )}`,
    odd: true,
  };
}

const FRAUD_ALERTS = [unusualCardSpend, impossibleTravel, customerReport];

async function newFraudAlert(run, k) {
  const payments = await withoutOpenAlert(
    run,
    await owned(
      run,
      await recentTx(
        run,
        [
          ['rail', '=', 'CARD'],
          ['direction', '=', 'DEBIT'],
          ['amount', '>', 60],
        ],
        3,
      ),
      'RETAIL',
    ),
  );
  if (!payments.length) return null;

  return FRAUD_ALERTS[k % FRAUD_ALERTS.length](run, payments[0]);
}

// ---- screening hits ----------------------------------------------------------------------------

const LISTS = [
  ['EU', 'Counter-terrorism (CP 931)', ['BE', 'TN', 'DZ']],
  ['UN', 'ISIL and Al-Qaida (Resolution 1267)', ['TN', 'IQ', 'SY']],
  ['OFAC', 'Counter-terrorism (SDGT)', ['TN', 'LB', 'YE']],
  ['PEP', 'Domestic PEP: mayor', ['FR']],
];

/** Active retail customers' holders who were never screened as a hit, nor are PEP. */
async function screenable(run) {
  const customers = await list(
    run,
    'customers',
    [
      ['status', '=', 'ACTIVE'],
      ['customer_type', '=', 'RETAIL'],
    ],
    ['id'],
  );
  const members = await list(
    run,
    'customer_members',
    [
      ['customer_id', 'in', shuffle(customers.map(c => c.id)).slice(0, 80)],
      ['role', '=', 'HOLDER'],
    ],
    ['individual_id'],
  );
  const ids = members.map(m => m.individual_id).filter(id => !run.used.has(id));
  const hits = await list(run, 'screening_hits', [['individual_id', 'in', ids]], ['individual_id']);
  const hit = new Set(hits.map(h => h.individual_id));
  const people = await byIds(
    run,
    'individuals',
    ids.filter(id => !hit.has(id)),
    ['first_name', 'last_name', 'date_of_birth', 'nationality', 'is_pep', 'is_sanctioned'],
  );

  return shuffle([...people.values()].filter(p => !p.is_pep && !p.is_sanctioned));
}

/** Today's list update brought a homonym of one of our customers: same name, another person. */
async function newScreeningHit(run, k) {
  const [subject] = await screenable(run);
  if (!subject) return null;
  const [listName, regime, countries] = LISTS[k % LISTS.length];
  const name = `${subject.first_name} ${subject.last_name}`;
  const born = new Date(subject.date_of_birth);
  born.setUTCFullYear(born.getUTCFullYear() + oneOf([-1, 1]) * rnd(4, 15));
  const fresh = k % 2 === 0;
  const listed = new Date(run.now.getTime() - (fresh ? rnd(4, 20) * 3600000 : rnd(20, 200) * DAY));
  const entry = {
    id: randomUUID(),
    list: listName,
    name,
    aliases: null,
    country: oneOf(countries),
    date_of_birth: isoDay(born),
    listed_at: run.stamp(listed),
    source_entry_id:
      listName === 'PEP' ? `PEP-${rnd(100000, 999999)}` : `${listName}-${rnd(10000, 99999)}`,
    entity_type: 'PERSON',
    regime,
    delisted_at: null,
    updated_at: run.stamp(listed),
  };
  await insert(run, 'watchlist_entries', entry);
  const trigger = fresh ? 'LIST_UPDATE' : 'DAILY_RESCREENING';
  const hit = await openCase(
    run,
    'screening_hits',
    'HIT',
    {
      individual_id: subject.id,
      business_id: null,
      counterparty_id: null,
      transaction_id: null,
      watchlist_entry_id: entry.id,
      investigation_id: null,
      match_score: round2(rnd(8600, 9700) / 100),
      status: 'OPEN',
      created_at: run.at(1),
      screened_name: name,
      trigger,
      matched_on: 'Full name',
      hit_type: listName === 'PEP' ? 'PEP' : 'SANCTIONS',
      entity_type: 'PERSON',
    },
    [['OPEN', 1, 'system', `Screening ${title(trigger).toLowerCase()}`]],
  );
  run.used.add(subject.id);

  return { reference: hit.reference, text: `${name} vs ${listName} list (${regime})` };
}

// ---- high-value transfers ----------------------------------------------------------------------

/** What the statement says: an invoice for a company, savings to one's own account, or a big buy. */
function transferWording(customer, payeeName) {
  const name = upper(payeeName);
  const words = payeeName.split(' ');
  const own =
    words.length > 1 &&
    customer.display_name.startsWith(words[0]) &&
    customer.display_name.endsWith(words[words.length - 1]);

  if (own) {
    return { description: `VIR SEPA VERS MON COMPTE ${name}`, reference: 'EPARGNE', purpose: null };
  }

  if (customer.customer_type === 'BUSINESS') {
    const invoice = rnd(10000, 99999);

    return {
      description: `VIR SEPA ${name} FACT ${invoice} ${name}`,
      reference: `FACTURE ${invoice}`,
      purpose: 'SUPP',
    };
  }

  const why = oneOf(['APPORT ACHAT IMMOBILIER', 'TRAVAUX RENOVATION', 'ACHAT VEHICULE']);

  return { description: `VIR SEPA ${name} ${why}`, reference: why, purpose: null };
}

/** Who sends it, from which phone, to which of the customer's payees: null if anything is missing. */
async function transferParties(run, account) {
  const holder = await holderOf(run, account.customer_id);
  if (!holder?.can_initiate_payments) return null;
  const payees = await list(
    run,
    'sct_beneficiaries',
    [
      ['customer_id', '=', account.customer_id],
      ['removed_at', 'null'],
    ],
    ['id', 'counterparty_id', 'payee_check'],
  );
  const [device] = await list(
    run,
    'devices',
    [
      ['individual_id', '=', holder.individual_id],
      ['revoked_at', 'null'],
    ],
    ['id', 'first_seen_at'],
  );
  const payee = oneOf(payees.filter(p => p.payee_check === 'MATCH'));
  if (!payee || !device) return null;

  return { holder, payee, device, name: await counterpartyName(run, payee.counterparty_id) };
}

async function pendingTransfer(run, account) {
  const customer = (
    await byIds(
      run,
      'customers',
      [account.customer_id],
      ['status', 'display_name', 'customer_type'],
    )
  ).get(account.customer_id);
  const top = Math.min(Number(account.available_balance) * 0.7, 48000);
  if (customer?.status !== 'ACTIVE' || top < 10500) return null;
  const parties = await transferParties(run, account);
  if (!parties) return null;
  const amount = rnd(1050, Math.floor(top / 10)) * 10;
  const wording = transferWording(customer, parties.name || '');
  const tx = {
    id: randomUUID(),
    account_id: account.id,
    counterparty_id: parties.payee.counterparty_id,
    initiated_by_id: parties.holder.individual_id,
    device_id: parties.device.id,
    rail: 'TRANSFER',
    direction: 'DEBIT',
    amount,
    currency: 'EUR',
    status: 'PENDING',
    booked_at: null,
    value_date: null,
    balance_after: null,
    description: wording.description,
    reference: wording.reference,
    created_at: run.at(2),
    category: 'TRANSFERS',
  };
  await insert(run, 'transactions', tx);
  await insert(run, 'outgoing_transfers', {
    id: randomUUID(),
    transaction_id: tx.id,
    beneficiary_id: parties.payee.id,
    scheme: 'SEPA',
    initiated_via: 'BANKING_APP',
    end_to_end_id: `E2E${hex(13).toUpperCase()}`,
    payee_check: 'MATCH',
    validation_status: 'PENDING',
    requested_execution_date: isoDay(run.now),
    sca_method: oneOf(['BIOMETRIC', 'APP_CONFIRMATION']),
    purpose_code: wording.purpose,
    is_standing_order: false,
  });
  // A pending debit is not booked yet: only the available balance goes down.
  await patch(run, 'accounts', account.id, {
    available_balance: round2(Number(account.available_balance) - amount),
  });
  run.used.add(account.customer_id);

  return {
    reference: tx.reference,
    text: `${euros(amount)} from ${customer.display_name} to ${parties.name}`,
  };
}

async function newHighValueTransfer(run) {
  const accounts = await list(
    run,
    'accounts',
    [
      ['status', '=', 'ACTIVE'],
      ['type', 'in', ['CURRENT', 'BUSINESS']],
      ['available_balance', '>', 15000],
    ],
    ['id', 'customer_id', 'balance', 'available_balance'],
    { limit: 300 },
  );
  const fresh = shuffle(accounts.filter(a => !run.used.has(a.customer_id))).slice(0, 25);

  return firstOf(fresh, account => pendingTransfer(run, account));
}

// ---- dispute requests --------------------------------------------------------------------------

const DISPUTE_REASONS = [
  [
    'ITEM_NOT_RECEIVED',
    true,
    m => `Ordered from ${m}, never delivered, and they no longer answer.`,
  ],
  ['DUPLICATE_CHARGE', false, m => `${m} charged me twice for the same purchase.`],
  ['CANCELLED_ORDER', true, m => `I cancelled my order at ${m} but was still charged.`],
  ['WRONG_AMOUNT', false, m => `The amount charged by ${m} is higher than my receipt.`],
  ['SERVICE_NOT_RENDERED', true, m => `${m} never provided the service I paid for.`],
];

/** Customers who may file one more card dispute without making it three in six months. */
async function canDispute(run, customerIds) {
  const since = new Date(run.now.getTime() - 190 * DAY);
  const recent = await list(
    run,
    'dispute_requests',
    [
      ['customer_id', 'in', customerIds],
      ['payment_type', 'in', ['CARD', 'DIRECT_DEBIT']],
      ['requested_at', '>', since],
    ],
    ['customer_id'],
  );
  const flagged = await list(
    run,
    'alerts',
    [
      ['customer_id', 'in', customerIds],
      ['alert_type', '=', 'REPEATED_DISPUTES'],
    ],
    ['customer_id'],
  );
  const out = new Set([...recent, ...flagged].map(r => r.customer_id));

  return new Set(customerIds.filter(id => !out.has(id)));
}

async function undisputed(run, txs) {
  const disputed = await list(
    run,
    'dispute_requests',
    [['transaction_id', 'in', txs.map(t => t.id)]],
    ['transaction_id'],
  );
  const taken = new Set(disputed.map(d => d.transaction_id));

  return txs.filter(t => !taken.has(t.id));
}

async function disputeRow(run, payment, fields, text) {
  const dispute = await openCase(
    run,
    'dispute_requests',
    'DSP',
    {
      customer_id: payment.customer.id,
      transaction_id: payment.id,
      amount: Number(payment.amount),
      currency: 'EUR',
      status: 'NEW',
      channel: 'APP',
      created_by: 'customer',
      requested_at: run.at(1),
      created_at: run.at(1),
      card_transaction_id: null,
      direct_debit_id: null,
      outgoing_transfer_id: null,
      assigned_to: null,
      ...fields,
    },
    [['NEW', 1, 'customer', 'Filed in the app']],
  );
  await listMove(run, payment.id, { dispute_request_id: dispute.id });
  run.used.add(payment.id);
  run.used.add(payment.customer.id);

  return { reference: dispute.reference, text };
}

async function cardDispute(run, k) {
  const txs = await undisputed(
    run,
    await owned(
      run,
      await recentTx(
        run,
        [
          ['rail', '=', 'CARD'],
          ['direction', '=', 'DEBIT'],
          ['amount', '>', 20],
          ['amount', '<', 900],
        ],
        25,
        400,
      ),
    ),
  );
  const allowed = await canDispute(run, [...new Set(txs.map(t => t.customer.id))]);
  const cards = await list(
    run,
    'card_transactions',
    [
      ['transaction_id', 'in', txs.map(t => t.id)],
      ['type', '=', 'PURCHASE'],
      ['status', 'in', ['CLEARED', 'SETTLED']],
    ],
    ['id', 'transaction_id', 'merchant_id'],
  );
  const cardOf = new Map(cards.map(c => [c.transaction_id, c]));
  const payment = txs.find(t => allowed.has(t.customer.id) && cardOf.has(t.id));
  if (!payment) return null;
  const card = cardOf.get(payment.id);
  const [merchant] = await list(
    run,
    'card_merchants',
    [['id', '=', card.merchant_id]],
    ['counterparty_id'],
  );
  const name = (await counterpartyName(run, merchant?.counterparty_id)) || 'the merchant';
  const [reason, contactFirst, detail] = DISPUTE_REASONS[k % DISPUTE_REASONS.length];
  const contacted = new Date(run.now.getTime() - rnd(2, 5) * DAY);
  const fields = {
    reason,
    reason_detail: detail(name),
    payment_type: 'CARD',
    card_transaction_id: card.id,
    merchant_contacted_at:
      contactFirst && contacted > toDate(payment.created_at) ? run.stamp(contacted) : null,
  };

  return disputeRow(
    run,
    payment,
    fields,
    `${title(reason)}: ${payment.customer.display_name}, ${euros(payment.amount)} at ${name}`,
  );
}

/** Paid a stranger by Wero for something that never came: no chargeback exists for that. */
async function weroScam(run) {
  const txs = await undisputed(
    run,
    await owned(
      run,
      await recentTx(
        run,
        [
          ['rail', '=', 'WERO'],
          ['direction', '=', 'DEBIT'],
          ['amount', '>', 30],
        ],
        20,
      ),
    ),
  );
  const [payment] = txs;
  if (!payment) return null;
  const fields = {
    reason: 'SCAM',
    reason_detail:
      'Paid a seller from a classifieds site by Wero; the item never came and the seller is gone.',
    payment_type: 'WERO',
  };
  const done = await disputeRow(
    run,
    payment,
    fields,
    `Scam on a Wero payment: ${payment.customer.display_name}, ${euros(payment.amount)}`,
  );

  return { ...done, odd: true };
}

async function newDispute(run, k) {
  if (k % 3 === 2) {
    const odd = await weroScam(run);
    if (odd) return odd;
  }

  return cardDispute(run, k);
}

// ---- recalls other banks send us ---------------------------------------------------------------

const SEPA_CODES = { FRAUD: 'FRAD', DUPLICATE: 'DUPL', TECHNICAL: 'TECH' };
const RECALL_REASONS = ['FRAUD', 'DUPLICATE', 'FRAUD', 'TECHNICAL', 'FRAUD'];
const RECALL_WHY = {
  FRAUD: 'Fraud recall (FRAD) from the payer’s bank',
  DUPLICATE: 'The payer’s bank sent this transfer twice (DUPL)',
  TECHNICAL: 'Technical problem at the payer’s bank (TECH)',
};

async function activeHolds(run, accountId) {
  const holds = await list(
    run,
    'holds',
    [
      ['account_id', '=', accountId],
      ['status', '=', 'ACTIVE'],
    ],
    ['amount'],
  );

  return holds.reduce((sum, h) => sum + Number(h.amount), 0);
}

/** A fraud recall raises its alert, and holds what is still on the account until we answer. */
async function fraudSignal(run, recall, credit, due) {
  const alert = await openAlert(run, {
    type: 'INCOMING_FRAUD_RECALL',
    customerId: credit.customer.id,
    lines: [credit],
    score: 88,
  });
  await patch(run, 'sepa_disputes', recall.id, { alert_id: alert.id });
  const { account } = credit;
  const room = Math.min(
    Number(account.available_balance),
    Number(account.balance) - (await activeHolds(run, account.id)),
  );
  const amount = round2(Math.max(0, Math.min(Number(credit.amount), room)));
  if (amount <= 0) return alert;
  await openCase(
    run,
    'holds',
    'HLD',
    {
      account_id: account.id,
      amount,
      reason: 'FRAUD',
      alert_id: alert.id,
      sepa_dispute_id: recall.id,
      placed_by: 'system',
      placed_at: run.at(0.5),
      status: 'ACTIVE',
      expires_at: run.stamp(new Date(`${due}T21:59:59.000Z`)),
    },
    [['ACTIVE', 0.5, 'system', 'Funds held while the fraud recall is answered']],
  );
  await patch(run, 'accounts', account.id, {
    available_balance: round2(Number(account.available_balance) - amount),
  });

  return alert;
}

async function newRecall(run, k) {
  const credits = await owned(
    run,
    await recentTx(
      run,
      [
        ['rail', '=', 'TRANSFER'],
        ['direction', '=', 'CREDIT'],
        ['amount', '>', 300],
      ],
      // A FRAD, DUPL or TECH recall must arrive within 10 business days: about 12 calendar days.
      12,
    ),
  );
  const ids = credits.map(t => t.id);
  const disputed = new Set(
    (await list(run, 'sepa_disputes', [['transaction_id', 'in', ids]], ['transaction_id'])).map(
      s => s.transaction_id,
    ),
  );
  const incoming = await list(
    run,
    'incoming_transfers',
    [['transaction_id', 'in', ids]],
    ['id', 'transaction_id', 'emitter_id', 'scheme'],
  );
  const inOf = new Map(incoming.map(i => [i.transaction_id, i]));
  const credit = credits.find(t => inOf.has(t.id) && !disputed.has(t.id));
  if (!credit) return null;
  const transfer = inOf.get(credit.id);
  const [emitter] = await list(run, 'sct_emitters', [['id', '=', transfer.emitter_id]], ['bic']);
  const reason = RECALL_REASONS[k % RECALL_REASONS.length];
  const due = isoDay(businessDays(run.now, 15));
  const recall = await openCase(
    run,
    'sepa_disputes',
    'SEP',
    {
      customer_id: credit.customer.id,
      transaction_id: credit.id,
      incoming_transfer_id: transfer.id,
      scheme: transfer.scheme === 'SEPA_INSTANT' ? 'SCT_INST' : 'SCT',
      type: 'RECALL',
      side: 'WE_ARE_ASKED',
      reason,
      reason_code: SEPA_CODES[reason],
      amount: Number(credit.amount),
      requested_at: run.at(2),
      response_due: due,
      status: 'OPEN',
      assigned_to: null,
      other_bank_bic: emitter?.bic || null,
    },
    [['OPEN', 2, 'other bank', RECALL_WHY[reason]]],
  );
  await listMove(run, credit.id, { sepa_dispute_id: recall.id });
  run.used.add(credit.id);
  const alert = reason === 'FRAUD' ? await fraudSignal(run, recall, credit, due) : null;
  const also = alert ? ` (alert ${alert.reference} raised)` : '';

  return {
    reference: recall.reference,
    text: `${title(reason)} recall: ${euros(credit.amount)} received by ${
      credit.customer.display_name
    }${also}`,
    odd: reason === 'TECHNICAL',
  };
}

// ---- onboarding applicants ---------------------------------------------------------------------

const ID_FILES = { PASSPORT: 'passport', NATIONAL_ID: 'national_id' };
const ADDRESS_FILES = ['quittance_loyer.pdf', 'facture_edf.pdf', 'facture_orange.pdf'];
const L = () => String.fromCharCode(65 + rnd(0, 25));
const idNumber = type =>
  type === 'PASSPORT'
    ? `${rnd(10, 26)}${L()}${L()}${rnd(10000, 99999)}`
    : Array.from({ length: 9 }, () => (Math.random() < 0.5 ? L() : rnd(0, 9))).join('');

/**
 * A new person, nobody else's name (the data never has two people with the same name). `accept`:
 * who may apply (the presenter's button wants a file with nothing to flag, demo-feed.js).
 */
async function newPerson(run, country, adultAge = 18, accept = () => true) {
  const draw = () => {
    const p = person(
      country,
      Math.random() < 0.5 ? 'M' : 'F',
      oneOf(COUNTRIES[country].last),
      homeAddress(country),
    );
    const age = (run.now - new Date(p.date_of_birth)) / (365.25 * DAY);

    return age >= adultAge && accept(p) ? p : draw();
  };

  const p = draw();
  const twins = await list(
    run,
    'individuals',
    [
      ['first_name', '=', p.first_name],
      ['last_name', '=', p.last_name],
    ],
    ['id'],
  );
  if (twins.length) return newPerson(run, country, adultAge, accept);
  const row = {
    id: randomUUID(),
    ...p,
    is_pep: false,
    created_at: run.at(9),
    updated_at: run.at(9),
    birth_name: null,
    address_line2: null,
    is_us_person: false,
  };
  await insert(run, 'individuals', row);

  return row;
}

async function customerReference(run) {
  const ref = `CUS-${run.now.getUTCFullYear()}-${String(rnd(1, 999999)).padStart(6, '0')}`;
  const [taken] = await list(run, 'customers', [['reference', '=', ref]], ['id']);

  return taken ? customerReference(run) : ref;
}

/**
 * The customer, PROSPECT then ONBOARDING as the app sends the application. `device` false: the
 * application came through a partner's app, so the bank never saw the phone it was sent from.
 */
async function applicant(run, fields, memberOf, { device = true } = {}) {
  const customer = {
    id: randomUUID(),
    reference: await customerReference(run),
    status: 'ONBOARDING',
    onboarded_at: null,
    relationship_manager: null,
    created_at: run.at(9),
    updated_at: run.at(7),
    ...fields,
  };
  await insert(run, 'customers', customer);
  await history(run, 'CUSTOMERS', customer.id, [
    ['PROSPECT', 9, 'customer'],
    ['ONBOARDING', 7, 'customer'],
  ]);
  await insert(run, 'customer_members', {
    id: randomUUID(),
    customer_id: customer.id,
    can_initiate_payments: true,
    since: isoDay(run.now),
    until: null,
    is_primary_contact: true,
    proof_document_id: null,
    ...memberOf,
  });
  if (!device) return customer;
  // The phone the application was sent from.
  await insert(run, 'devices', {
    id: randomUUID(),
    individual_id: memberOf.individual_id,
    fingerprint: hex(32),
    platform: oneOf(['IOS', 'ANDROID']),
    first_seen_at: run.at(10),
    is_trusted: true,
    device_name: oneOf(['iPhone 15', 'iPhone 14', 'Samsung Galaxy S23', 'Google Pixel 8']),
    last_seen_at: run.at(3),
    revoked_at: null,
    app_version: '7.14.5',
  });

  return customer;
}

/** The onboarding case, opened when the application arrives. */
const onboardingCase = (run, customer, extra = {}, reason = 'Application sent') =>
  openCase(
    run,
    'kyc_cases',
    'KYC',
    {
      customer_id: customer.id,
      type: 'ONBOARDING',
      trigger: null,
      channel: customer.onboarding_channel,
      status: 'OPEN',
      opened_at: run.at(7),
      due_at: run.stamp(new Date(run.now.getTime() + 5 * DAY)),
      assigned_to: null,
      updated_at: run.at(2),
      ...extra,
    },
    [['OPEN', 7, 'system', reason]],
  );

/** One file the customer sent from the app, waiting for its check. */
function documentRow(run, kyc, minutesAgo, fields) {
  const id = fields.id || randomUUID();

  return insert(run, 'documents', {
    id,
    customer_id: kyc.customer_id,
    kyc_case_id: kyc.id,
    individual_id: null,
    business_id: null,
    information_request_id: null,
    document_number: null,
    issued_at: null,
    expires_at: null,
    issuing_country: null,
    uploaded_at: run.at(minutesAgo),
    verified: false,
    verified_at: null,
    // Not checked yet: the workflow's checks give the result.
    check_result: null,
    source: 'CUSTOMER_APP',
    file_url: `https://files.${BANK}/kyc/${kyc.customer_id}/${id}/${fields.file_name}`,
    ...fields,
  });
}

/** The applicant's ID. `extra.id` picks its scan (random.js scanFlaw reads it from the id). */
function idDocument(run, kyc, who, minutesAgo, extra = {}) {
  const type = who.nationality === 'FR' ? 'NATIONAL_ID' : 'PASSPORT';
  const issued = new Date(run.now.getTime() - rnd(200, 3000) * DAY);
  const expires = new Date(issued.getTime() + 3652 * DAY);

  return documentRow(run, kyc, minutesAgo, {
    document_type: type,
    individual_id: who.id,
    document_number: idNumber(type),
    issued_at: run.stamp(issued),
    expires_at: run.stamp(expires),
    issuing_country: who.nationality,
    provider_check_id: `IDV-${hex(12).toUpperCase()}`,
    file_name: `${ID_FILES[type]}_${upper(who.last_name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z]/g, '')}.jpg`,
    ...extra,
  });
}

/**
 * A retail application from the app: the person, the customer, the case, an ID, a selfie and a
 * proof of address. `shape` fixes what is drawn at random otherwise (the presenter's button,
 * demo-feed.js): `country`, `accept` (who applies), `channel`, `risk` (the customer's rating),
 * `monthlyIn` (who => money expected in a month), `idDocumentId` and `intake`: the app's
 * pre-score, written to the case's risk_before last, once every paper is there (an automated
 * inbox takes the case on that score, and must not find it half sent).
 */
async function newRetailApplicant(run, shape) {
  const opts = shape && typeof shape === 'object' ? shape : {};
  const country = opts.country || (Math.random() < 0.75 ? 'FR' : oneOf(Object.keys(COUNTRIES)));
  const who = await newPerson(run, country, 18, opts.accept);
  const monthlyIn = opts.monthlyIn
    ? round2(opts.monthlyIn(who))
    : round2(MONTHLY_NET[who.income_band] * (0.9 + Math.random() * 0.2));
  const risk = opts.risk || (Math.random() < 0.8 ? 'LOW' : 'MEDIUM');
  const customer = await applicant(
    run,
    {
      display_name: `${who.first_name} ${who.last_name}`,
      customer_type: 'RETAIL',
      risk_rating: risk,
      referral_code: `${upper(who.last_name)
        .normalize('NFD')
        .replace(/[^A-Z]/g, '')
        .slice(0, 4)}${rnd(1000, 9999)}`,
      expected_monthly_in: monthlyIn,
      expected_monthly_out: round2(monthlyIn * (0.8 + Math.random() * 0.2)),
      next_review_at: run.stamp(
        new Date(isoDay(new Date(run.now.getTime() + (risk === 'LOW' ? 3 : 2) * 365 * DAY))),
      ),
      preferred_language: LANGUAGE[country] || 'EN',
      onboarding_channel: opts.channel || oneOf(['APP', 'APP', 'APP', 'WEB']),
    },
    { individual_id: who.id, role: 'HOLDER' },
  );
  const kyc = await onboardingCase(run, customer);
  await idDocument(run, kyc, who, 6, opts.idDocumentId ? { id: opts.idDocumentId } : {});
  await documentRow(run, kyc, 5, {
    document_type: 'SELFIE',
    individual_id: who.id,
    provider_check_id: `IDV-${hex(12).toUpperCase()}`,
    file_name: 'selfie.jpg',
  });
  await documentRow(run, kyc, 3, {
    document_type: 'PROOF_OF_ADDRESS',
    individual_id: who.id,
    issued_at: run.stamp(new Date(run.now.getTime() - rnd(5, 60) * DAY)),
    file_name: oneOf(ADDRESS_FILES),
  });
  if (opts.intake) await patch(run, 'kyc_cases', kyc.id, { risk_before: opts.intake });

  return {
    reference: kyc.reference,
    text: `${customer.display_name} (${customer.reference}), 3 documents`,
    kycId: kyc.id,
    name: customer.display_name,
  };
}

// NAF code, label, legal form, sells by card, monthly revenue, name: as business.js draws them.
const INDUSTRIES = [
  ['10.71C', 'Bakery', 'SARL', true, [25000, 70000], n => `Boulangerie ${n}`],
  ['56.10A', 'Restaurant', 'SAS', true, [40000, 120000], n => `Le Bistrot ${n}`],
  ['47.91B', 'E-commerce', 'SAS', true, [50000, 400000], n => `${n} Shop`],
  ['62.01Z', 'Software development', 'SAS', false, [40000, 250000], n => `${n} Digital`],
  ['70.22Z', 'Business consulting', 'SASU', false, [15000, 90000], n => `${n} Conseil`],
  ['49.41A', 'Road freight', 'SARL', false, [50000, 200000], n => `Transports ${n}`],
  ['74.10Z', 'Design', 'SASU', false, [10000, 50000], n => `Atelier ${n}`],
];
const PRODUCTS = { Bakery: 'Bread and pastries', Restaurant: 'Meals and drinks' };

function cardFields(label, monthly, sellsByCard) {
  if (!sellsByCard) return { accepts_card_payments: false };
  const online = label === 'E-commerce';

  return {
    accepts_card_payments: true,
    products_sold: PRODUCTS[label] || 'Home goods sold online',
    expected_monthly_volume: round2(monthly * (0.5 + Math.random() * 0.4)),
    average_basket: round2(8 + Math.random() * 60),
    online_share_pct: online ? 100 : rnd(0, 30),
    delivery_delay_days: online ? rnd(2, 10) : 0,
    chargeback_ratio: round2(Math.random() * (online ? 1.4 : 0.4)),
    reserve_pct: online ? rnd(5, 10) : null,
    reserve_days: online ? 90 : null,
  };
}

/** A company as in the register: valid SIREN and VAT number, a name nobody else has. */
async function newCompany(run, lastName) {
  const [nace, label, form, sellsByCard, [low, high], base] = oneOf(INDUSTRIES);
  const trading = `${base(lastName)}${oneOf(['', '', '', ' & Fils', ' & Cie'])}`;
  const [twin] = await list(run, 'businesses', [['legal_name', '=', `${trading} ${form}`]], ['id']);
  if (twin) return newCompany(run, oneOf(COUNTRIES.FR.last));
  const number = siren();
  const monthly = rnd(low, high);
  const company = {
    id: randomUUID(),
    legal_name: `${trading} ${form}`,
    trading_name: trading,
    registration_number: number,
    legal_form: form,
    ...homeAddress('FR'),
    country: 'FR',
    incorporation_date: isoDay(new Date(run.now.getTime() - rnd(60, 3000) * DAY)),
    industry: label,
    nace_code: nace,
    vat_number: vatNumber(number),
    lei: null,
    source_of_funds: oneOf(['REVENUE', 'REVENUE', 'SHAREHOLDER_FUNDS', 'LOAN']),
    website: `https://www.${trading
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z]/g, '')}.fr`,
    ...cardFields(label, monthly, sellsByCard),
    is_sanctioned: false,
    created_at: run.at(10),
    updated_at: run.at(10),
  };
  await insert(run, 'businesses', company);

  return { company, monthly };
}

const memberRow = (run, company, fields) =>
  insert(run, 'business_members', {
    id: randomUUID(),
    business_id: company.id,
    owner_business_id: null,
    ownership_pct: null,
    since: company.incorporation_date,
    until: null,
    verified: false,
    verified_by: null,
    verified_at: null,
    source: 'CLIENT_DECLARATION',
    ...fields,
  });

const COMPANY_FILES = [
  ['COMPANY_REGISTRATION', 'kbis.pdf', 30],
  ['ARTICLES_OF_ASSOCIATION', 'statuts.pdf', 400],
  ['UBO_DECLARATION', 'declaration_beneficiaires_effectifs.pdf', 20],
];

async function newBusinessApplicant(run) {
  const boss = await newPerson(run, 'FR', 21);
  const { company, monthly } = await newCompany(run, boss.last_name);
  await memberRow(run, company, { individual_id: boss.id, role: 'OWNER', ownership_pct: 100 });
  await memberRow(run, company, { individual_id: boss.id, role: 'DIRECTOR' });
  const customer = await applicant(
    run,
    {
      display_name: company.trading_name,
      customer_type: 'BUSINESS',
      business_id: company.id,
      risk_rating: Math.random() < 0.7 ? 'LOW' : 'MEDIUM',
      referral_code: `${upper(boss.last_name)
        .normalize('NFD')
        .replace(/[^A-Z]/g, '')
        .slice(0, 4)}${rnd(1000, 9999)}`,
      expected_monthly_in: monthly,
      expected_monthly_out: round2(monthly * (0.75 + Math.random() * 0.2)),
      next_review_at: run.stamp(new Date(isoDay(new Date(run.now.getTime() + 2 * 365 * DAY)))),
      preferred_language: 'FR',
      onboarding_channel: oneOf(['WEB', 'WEB', 'APP']),
    },
    { individual_id: boss.id, role: 'SIGNATORY' },
  );
  const kyc = await onboardingCase(run, customer);
  await idDocument(run, kyc, boss, 6);
  await sequence(COMPANY_FILES, ([type, file, age], k) =>
    documentRow(run, kyc, 5 - k, {
      document_type: type,
      business_id: company.id,
      document_number: type === 'COMPANY_REGISTRATION' ? company.registration_number : null,
      issued_at: run.stamp(new Date(run.now.getTime() - rnd(5, age) * DAY)),
      file_name: file,
    }),
  );

  return {
    reference: kyc.reference,
    text: `${company.legal_name} (${company.industry}), ${boss.first_name} ${boss.last_name} signs, 4 documents`,
  };
}

/** The odd one: a press article names a customer. No inbox takes a KYC review that is not onboarding. */
async function newAdverseMediaReview(run) {
  const customers = await list(
    run,
    'customers',
    [
      ['status', '=', 'ACTIVE'],
      ['customer_type', '=', 'RETAIL'],
    ],
    ['id', 'display_name', 'risk_rating'],
  );
  const busy = await list(
    run,
    'kyc_cases',
    [['status', 'in', ['OPEN', 'IN_REVIEW', 'PENDING_APPROVAL', 'ESCALATED']]],
    ['customer_id'],
  );
  const taken = new Set(busy.map(k => k.customer_id));
  const customer = shuffle(customers).find(c => !taken.has(c.id) && !run.used.has(c.id));
  if (!customer) return null;
  const paper = oneOf(['Le Parisien', 'Ouest-France', 'La Dépêche', 'Le Progrès']);
  const kyc = await openCase(
    run,
    'kyc_cases',
    'KYC',
    {
      customer_id: customer.id,
      type: 'EVENT_REVIEW',
      trigger: 'ADVERSE_MEDIA',
      channel: null,
      status: 'OPEN',
      opened_at: run.at(1),
      due_at: run.stamp(new Date(run.now.getTime() + 30 * DAY)),
      assigned_to: null,
      risk_before: customer.risk_rating,
      notes: `${paper}: an article on a VAT fraud case names a ${customer.display_name}. Check whether it is our customer.`,
      updated_at: run.at(1),
    },
    [['OPEN', 1, 'system', 'Adverse media screening: press article']],
  );
  run.used.add(customer.id);

  return {
    reference: kyc.reference,
    text: `Adverse media review: ${customer.display_name} (matches no inbox segment)`,
    odd: true,
  };
}

// ---- the kinds, in the order the timer takes them -----------------------------------------------

const KINDS = [
  ['kyc_retail', 'Retail onboarding', newRetailApplicant],
  ['alerts_aml', 'AML alerts', newAmlAlert],
  ['transfers_validate', 'Transfers to validate', newHighValueTransfer],
  ['disputes_new', 'New disputes', newDispute],
  ['kyc_business', 'Business onboarding', newBusinessApplicant],
  ['alerts_fraud', 'Fraud and takeover alerts', newFraudAlert],
  ['hits_open', 'Screening hits', newScreeningHit],
  ['recalls_in', 'Recalls we received', newRecall],
  ['kyc_review', 'No inbox (KYC review, not onboarding)', newAdverseMediaReview],
];

/** One case of a kind; k is its rank in the run (varies the story). Null when nothing fits. */
async function createOne(run, kind, k) {
  const [key, inbox, create] = KINDS.find(([name]) => name === kind);
  const created = await create(run, k);

  return created && { kind: key, inbox, ...created };
}

/** n cases per inbox, and one case for no inbox. */
async function startTheDay(store, n) {
  const run = newRun(store);
  const plan = KINDS.flatMap(([kind]) =>
    Array.from({ length: kind === 'kyc_review' ? 1 : n }, (_, k) => [kind, k]),
  );
  const created = await sequence(plan, ([kind, k]) => createOne(run, kind, k));

  return created.filter(Boolean);
}

const escape = s =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function summaryHtml(created) {
  const byInbox = new Map();
  created.forEach(c => byInbox.set(c.inbox, [...(byInbox.get(c.inbox) || []), c]));
  const sections = [...byInbox.entries()].map(
    ([inbox, rows]) =>
      `<p><strong>${escape(inbox)}</strong> (${rows.length})</p><ul>${rows
        .map(
          r =>
            `<li>${escape(r.reference)}: ${escape(r.text)}${
              r.odd ? ' <em>(unusual)</em>' : ''
            }</li>`,
        )
        .join('')}</ul>`,
  );

  return sections.join('');
}

function addLiveDay(collection) {
  collection.addAction('Start the day', {
    scope: 'Global',
    form: [
      {
        label: 'Cases per inbox',
        type: 'Number',
        defaultValue: 3,
        isRequired: true,
        description: 'New cases in each inbox, at most 5.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const asked = Number(context.formValues['Cases per inbox']) || 3;
      const n = Math.max(1, Math.min(MAX_PER_KIND, Math.round(asked)));
      const created = await startTheDay(forestStore(context.dataSource), n);
      if (!created.length) return resultBuilder.error('Nothing new could be created.');

      return resultBuilder.success(`The day starts: ${created.length} new cases.`, {
        html: summaryHtml(created),
      });
    },
  });
}

// ---- the timer ---------------------------------------------------------------------------------

module.exports = {
  ID_FILES,
  KINDS,
  addLiveDay,
  // For the partner portal's actions (actions-partner.js): an application, its case, its papers.
  applicant,
  documentRow,
  onboardingCase,
  createOne,
  forestStore,
  knexStore,
  newRetailApplicant,
  newRun,
  startTheDay,
  summaryHtml,
};
