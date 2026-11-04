/**
 * The network graph of a record's Analytics tab: one collection chart `network` on customers,
 * accounts, alerts, investigations and kyc_cases, read by the Smart Chart in network-chart/ with
 * `GET /forest/_charts/<collection>/network?record_id=<id>`.
 *
 * It starts from the record's customer and goes two hops out: customer → something shared →
 * other customer → something shared → other customer. What can be shared:
 * - a device (devices.fingerprint, used by people who are members of different customers);
 * - a phone series (the phone number without its last 3 digits, shared by SERIES_MIN people or
 *   more: two random numbers often share one, a wave of forged applications shares one);
 * - a counterparty IBAN the customers paid or received money from. Grouped by IBAN: every customer
 *   has its own counterparty row for the same payee, so `counterparty_id` never links two
 *   customers; sct_beneficiaries.iban (money out) and sct_emitters.iban (money in) do. An IBAN
 *   links customers only when it is unusual: abroad, blocked, or shared by SMALL_SHARED customers
 *   or fewer and not a salary. An employer or a big supplier paid by many is a common payee, shown
 *   for the record's own customer but not followed (HUB).
 * - The postal area is shown, never followed (a city has hundreds of customers): another customer
 *   is drawn living in it only when it is the record's customer's own.
 *
 * Returns { record, center, nodes, edges, stories, counts, layout }: at most MAX_NODES nodes, the
 * linked customers ranked by how strongly they are linked (device, phone, unusual IBAN, their
 * flags), nearer first. Nodes carry flags (frozen, declined, under investigation, SAR filed,
 * sanctions, blocked, revoked), hover details and where to draw them (x, y and a label spot from
 * network-layout.ts, in the `layout` width x height); money edges carry total, count and dates.
 *
 * One read interface, `list(table, conditions, fields)`, read through the agent (agentList).
 */
import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';

import { layoutNetwork } from './network-layout';

/** Reads a table through the data source: leaves and And/Or branches, a sort. */
function agentList(dataSource) {
  return (table, conditions, fields, sort) =>
    dataSource.getCollection(table).list(
      new PaginatedFilter({
        conditionTree: conditions.length ? ConditionTreeFactory.intersect(...conditions) : null,
        sort: sort ? new Sort(...[].concat(sort)) : undefined,
      }),
      fields,
    );
}

const COLLECTIONS = ['customers', 'accounts', 'alerts', 'investigations', 'kyc_cases'];
const MAX_NODES = 60;
const DEPTH = 2;
// Customers found at one hop that are followed for the second hop, strongest first.
const FOLLOW = 20;
const HUB = 8;
const SMALL_SHARED = 3;
const SERIES_MIN = 3;
// The record's own payees and payers shown when nobody else shares them, by amount.
const OWN_IBANS = 3;
const OWN_ACCOUNTS = 6;
const SAR_FILED = ['SUBMITTED', 'ACKNOWLEDGED', 'ANSWERED'];
const WEIGHT = { device: 6, phone: 4, iban: 5 };

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const uniq = values => [...new Set(values.filter(v => v !== null && v !== undefined))];
const euros = n =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const day = v => {
  if (!v) return null;
  const t = v instanceof Date ? v : new Date(String(v).replace(' ', 'T').replace(' +00:00', 'Z'));

  return Number.isNaN(t.getTime()) ? String(v).slice(0, 10) : t.toISOString().slice(0, 10);
};

const word = code =>
  code
    ? String(code)
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/^./, c => c.toUpperCase())
    : '';
const flag = (key, label, level, detail?) => ({ key, label, level, ...(detail ? { detail } : {}) });

const pushTo = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

/** Rows of `table` whose `field` is in `values` (none asked: none read). */
const rowsIn = (list, table, field, values, fields, more = []) => {
  const wanted = uniq(values);

  return wanted.length ? list(table, [eq(field, wanted), ...more], fields) : Promise.resolve([]);
};

// ---- phone series ---------------------------------------------------------------------------

/** The number without its last 3 digits: '33756412' for '+33 7 56 41 20 10'. */
const seriesKey = phone => {
  const digits = String(phone || '').replace(/\D/g, '');

  return digits.length > 6 ? digits.slice(0, -3) : null;
};

/** How people read a series: '+33 7 56 41 2x'. */
function seriesLabel(phone) {
  const text = String(phone);
  const keep = String(phone).replace(/\D/g, '').length - 3;
  let seen = 0;

  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i])) seen += 1;
    if (seen === keep) return `${text.slice(0, i + 1)}x`;
  }

  return text;
}

// ---- the record and the bank-wide people tables -----------------------------------------------

/** The customer(s) a record is about, and the node it centers on. */
async function resolveRecord(list, collection, id) {
  if (!id || !COLLECTIONS.includes(collection)) return null;

  if (collection === 'customers') {
    const [row] = await list('customers', [eq('id', id)], ['id']);

    return row ? { customers: [row.id], center: `customer:${row.id}` } : null;
  }

  const [row] = await list(collection, [eq('id', id)], ['id', 'customer_id']);
  if (!row?.customer_id) return null;
  const center = collection === 'accounts' ? `account:${row.id}` : `customer:${row.customer_id}`;

  return { customers: [row.customer_id], center };
}

/** Members, people and devices of the whole bank (a few thousand rows), indexed both ways. */
async function loadPeople(list) {
  const [members, people, devices] = await Promise.all([
    list('customer_members', [], ['customer_id', 'individual_id']),
    list('individuals', [], ['id', 'phone', 'postal_code', 'city', 'is_sanctioned']),
    list(
      'devices',
      [],
      [
        'id',
        'individual_id',
        'fingerprint',
        'platform',
        'device_name',
        'first_seen_at',
        'last_seen_at',
        'revoked_at',
      ],
    ),
  ]);
  const peopleOf = new Map();
  const customersOf = new Map();
  members.forEach(m => {
    pushTo(peopleOf, m.customer_id, m.individual_id);
    pushTo(customersOf, m.individual_id, m.customer_id);
  });
  const person = new Map<any, any>(people.map(p => [p.id, p]));
  const bySeries = new Map();
  people.forEach(p => {
    const key = seriesKey(p.phone);
    if (key) pushTo(bySeries, key, p.id);
  });
  const devicesOf = new Map();
  const byFingerprint = new Map();
  devices.forEach(d => {
    pushTo(devicesOf, d.individual_id, d);
    if (d.fingerprint) pushTo(byFingerprint, d.fingerprint, d);
  });

  return { peopleOf, customersOf, person, bySeries, devicesOf, byFingerprint };
}

/** Customers reached from one shared thing, without `self`. */
const customersOfPeople = (people, ids, self) =>
  uniq(ids.flatMap(i => people.customersOf.get(i) || [])).filter(c => c !== self);

/** The fingerprints and phone series a customer's people use (series shared by SERIES_MIN+). */
function identityOf(people, customer) {
  const ids = people.peopleOf.get(customer) || [];
  const fingerprints = uniq(
    ids.flatMap(i => (people.devicesOf.get(i) || []).map(d => d.fingerprint)),
  );
  const series = uniq(ids.map(i => seriesKey(people.person.get(i)?.phone))).filter(
    k => (people.bySeries.get(k) || []).length >= SERIES_MIN,
  );

  return { fingerprints, series };
}

// ---- money: IBANs ---------------------------------------------------------------------------

/** Every payee (out) and payer (in) row of some customers, with the IBAN it stands for. */
async function ibanRows(list, field, values) {
  const [out, inn] = await Promise.all([
    rowsIn(list, 'sct_beneficiaries', field, values, [
      'customer_id',
      'counterparty_id',
      'iban',
      'bank_name',
    ]),
    rowsIn(list, 'sct_emitters', field, values, [
      'customer_id',
      'counterparty_id',
      'iban',
      'bank_name',
    ]),
  ]);

  return [...out.map(r => ({ ...r, side: 'out' })), ...inn.map(r => ({ ...r, side: 'in' }))].filter(
    r => r.iban,
  );
}

/** What the bank knows of some IBANs: who else uses them, names, blocks, salary or not. */
async function ibanFacts(list, ibans, known) {
  const fresh = uniq(ibans).filter(i => !known.has(i));
  if (!fresh.length) return;
  const rows = await ibanRows(list, 'iban', fresh);
  const parties = new Map(
    (
      await rowsIn(
        list,
        'counterparties',
        'id',
        rows.map(r => r.counterparty_id),
        ['id', 'name', 'country', 'is_blocked', 'block_reason', 'risk_level'],
      )
    ).map(p => [p.id, p]),
  );
  const byIban = new Map();
  rows.forEach(r => pushTo(byIban, r.iban, r));
  // Salaries: an employer paying several staff links nobody. Read only for small shared IBANs.
  const small = [...byIban.entries()].filter(([, rs]) => {
    const n = uniq(rs.map(r => r.customer_id)).length;

    return n >= 2 && n <= SMALL_SHARED;
  });
  const categories = new Map();
  (
    await rowsIn(
      list,
      'transactions',
      'counterparty_id',
      small.flatMap(([, rs]) => rs.map(r => r.counterparty_id)),
      ['counterparty_id', 'category'],
    )
  ).forEach(t => pushTo(categories, t.counterparty_id, t.category));
  byIban.forEach((rs, iban) => {
    const customers = uniq(rs.map(r => r.customer_id));
    const cps = rs.map(r => parties.get(r.counterparty_id)).filter(Boolean);
    const blocked = cps.find(p => p.is_blocked);
    const cats = rs.flatMap(r => categories.get(r.counterparty_id) || []);
    const salary = cats.length > 0 && cats.every(c => c === 'SALARY');
    const abroad = iban.slice(0, 2) !== 'FR';
    const shared = customers.length >= 2 && customers.length <= HUB;
    known.set(iban, {
      iban,
      name: cps[0]?.name || rs[0].bank_name || 'Unknown',
      bank: rs[0].bank_name || null,
      country: iban.slice(0, 2),
      customers,
      rows: rs,
      blocked: Boolean(blocked),
      blockReason: blocked?.block_reason || null,
      risk: cps.some(p => p.risk_level === 'HIGH') ? 'HIGH' : cps[0]?.risk_level || null,
      salary,
      abroad,
      links:
        shared && (abroad || Boolean(blocked) || (customers.length <= SMALL_SHARED && !salary)),
    });
  });
}

// ---- the search: two hops of customers ---------------------------------------------------------

/** One hop from `frontier`: the customers each one shares a device, a series or an IBAN with. */
async function hop(list, people, ibans, frontier, found, depth) {
  const reached = new Map();

  const reach = (customer, link) => {
    if (found.has(customer)) return;
    if (!reached.has(customer)) reached.set(customer, { id: customer, depth, links: [] });
    const entry = reached.get(customer);
    if (!entry.links.some(l => l.key === link.key)) entry.links.push(link);
  };

  frontier.forEach(c => {
    const { fingerprints, series } = identityOf(people, c);
    fingerprints.forEach(fp => {
      const users = (people.byFingerprint.get(fp) || []).map(d => d.individual_id);
      customersOfPeople(people, users, c).forEach(o => reach(o, { kind: 'device', key: fp }));
    });
    series.forEach(s =>
      customersOfPeople(people, people.bySeries.get(s), c).forEach(o =>
        reach(o, { kind: 'phone', key: s }),
      ),
    );
  });
  const own = await ibanRows(list, 'customer_id', frontier);
  await ibanFacts(
    list,
    own.map(r => r.iban),
    ibans,
  );
  own.forEach(r => {
    const facts = ibans.get(r.iban);
    if (!facts?.links) return;
    facts.customers
      .filter(o => o !== r.customer_id)
      .forEach(o => reach(o, { kind: 'iban', key: r.iban, strong: facts.blocked || facts.abroad }));
  });

  return [...reached.values()];
}

const linkScore = l => WEIGHT[l.kind] + (l.strong ? 3 : 0);

/** Customers within DEPTH hops, with their links and a first score (flags are added later). */
async function search(list, people, ibans, centers) {
  const found = new Map<any, any>(
    centers.map(c => [c, { id: c, depth: 0, links: [], score: Infinity }]),
  );
  let frontier = centers;

  for (let depth = 1; depth <= DEPTH && frontier.length; depth += 1) {
    // eslint-disable-next-line no-await-in-loop -- each hop starts from the previous one
    const reached = await hop(list, people, ibans, frontier, found, depth);
    reached.forEach(r => {
      r.score = r.links.reduce((s, l) => s + linkScore(l), 0) / depth;
      found.set(r.id, r);
    });
    frontier = reached
      .sort((a, b) => b.score - a.score)
      .slice(0, FOLLOW)
      .map(r => r.id);
  }

  return found;
}

// ---- flags and facts of the customers found -------------------------------------------------

async function customerFacts(list, people, ids) {
  const personIds = ids.flatMap(c => people.peopleOf.get(c) || []);
  const [customers, investigations, sars, hits, accounts] = await Promise.all([
    rowsIn(list, 'customers', 'id', ids, [
      'id',
      'display_name',
      'reference',
      'customer_type',
      'status',
      'risk_rating',
      'business_id',
      'created_at',
    ]),
    rowsIn(list, 'investigations', 'customer_id', ids, [
      'customer_id',
      'reference',
      'status',
      'type',
      'decision',
    ]),
    rowsIn(list, 'sar_reports', 'customer_id', ids, ['customer_id', 'reference', 'status']),
    rowsIn(
      list,
      'screening_hits',
      'individual_id',
      personIds,
      ['individual_id', 'hit_type', 'status'],
      [eq('status', 'TRUE_MATCH')],
    ),
    rowsIn(list, 'accounts', 'customer_id', ids, [
      'id',
      'customer_id',
      'iban',
      'type',
      'name',
      'status',
      'balance',
      'opened_at',
      'freeze_reason',
    ]),
  ]);
  const businesses = new Map<any, any>(
    (
      await rowsIn(
        list,
        'businesses',
        'id',
        customers.map(c => c.business_id),
        ['id', 'is_sanctioned'],
      )
    ).map(b => [b.id, b]),
  );
  const sanctionedPeople = new Set([
    ...personIds.filter(i => people.person.get(i)?.is_sanctioned),
    ...hits.filter(h => h.hit_type === 'SANCTIONS').map(h => h.individual_id),
  ]);

  const byCustomer = (rows, field = 'customer_id') => {
    const map = new Map();
    rows.forEach(r => pushTo(map, r[field], r));

    return map;
  };

  return {
    customers: new Map(customers.map(c => [c.id, c])),
    investigations: byCustomer(investigations),
    sars: byCustomer(sars),
    accounts: byCustomer(accounts),
    sanctioned: c =>
      Boolean(businesses.get(c.business_id)?.is_sanctioned) ||
      (people.peopleOf.get(c.id) || []).some(i => sanctionedPeople.has(i)),
  };
}

function customerFlags(facts, c) {
  const flags = [];
  const open = (facts.investigations.get(c.id) || []).filter(i => i.status !== 'CLOSED');
  const filed = (facts.sars.get(c.id) || []).filter(s => SAR_FILED.includes(s.status));
  const decidedSar = (facts.investigations.get(c.id) || []).some(i => i.decision === 'SAR_FILED');
  if (facts.sanctioned(c)) flags.push(flag('sanctions', 'Sanctions', 'red'));

  if (filed.length || decidedSar) {
    flags.push(flag('sar', 'SAR filed', 'red', filed.map(s => s.reference).join(', ')));
  }

  if (open.length) {
    flags.push(
      flag('investigation', 'Under investigation', 'amber', open.map(i => i.reference).join(', ')),
    );
  }

  if (c.status === 'DECLINED') flags.push(flag('declined', 'Declined', 'amber'));

  return flags;
}

const flagScore = flags => flags.reduce((s, f) => s + (f.level === 'red' ? 2 : 1), 0);

// ---- money edges ----------------------------------------------------------------------------

/** Totals per (account, IBAN, direction) from the transactions on some counterparty rows. */
async function moneyBetween(list, rows, accountIds) {
  const ibanOf = new Map<any, any>(rows.map(r => [r.counterparty_id, r]));
  const lines = await rowsIn(
    list,
    'transactions',
    'counterparty_id',
    [...ibanOf.keys()],
    ['account_id', 'counterparty_id', 'direction', 'amount', 'status', 'booked_at', 'created_at'],
    [eq('account_id', uniq(accountIds))],
  );
  const flows = new Map();
  lines
    .filter(t => t.status !== 'REJECTED')
    .forEach(t => {
      const row = ibanOf.get(t.counterparty_id);
      const side = t.direction === 'DEBIT' ? 'out' : 'in';
      const key = `${t.account_id}|${row.iban}|${side}`;

      if (!flows.has(key)) {
        flows.set(key, {
          account: t.account_id,
          iban: row.iban,
          side,
          total: 0,
          count: 0,
          first: null,
          last: null,
        });
      }

      const f = flows.get(key);
      const when = day(t.booked_at || t.created_at);
      f.total += Math.abs(Number(t.amount) || 0);
      f.count += 1;
      if (when && (!f.first || when < f.first)) f.first = when;
      if (when && (!f.last || when > f.last)) f.last = when;
    });

  return [...flows.values()];
}

// ---- building the graph ---------------------------------------------------------------------

function deviceNode(fp, people) {
  const rows = people.byFingerprint.get(fp) || [];
  const d = rows[0] || {};
  const revoked = rows.find(r => r.revoked_at);
  const seen = rows
    .map(r => day(r.first_seen_at))
    .filter(Boolean)
    .sort();
  const last = rows
    .map(r => day(r.last_seen_at))
    .filter(Boolean)
    .sort();

  return {
    id: `device:${fp}`,
    kind: 'device',
    label: d.device_name || word(d.platform) || 'Device',
    sub: `${fp.slice(0, 6)}…`,
    flags: revoked ? [flag('revoked', 'Revoked', 'amber', day(revoked.revoked_at))] : [],
    details: [
      ['Fingerprint', `${fp.slice(0, 12)}…`],
      ['Platform', word(d.platform)],
      ['People using it', String(uniq(rows.map(r => r.individual_id)).length)],
      ['First seen', seen[0] || '—'],
      ['Last seen', last[last.length - 1] || '—'],
    ],
  };
}

function ibanNode(f) {
  const short = f.iban.replace(/ /g, '');

  return {
    id: `iban:${short}`,
    kind: 'iban',
    iban: f.iban,
    label: f.name,
    sub: `${f.iban.slice(0, 9)}… ${f.country}`,
    flags: f.blocked
      ? [flag('blocked', 'Blocked', 'red', f.blockReason && word(f.blockReason))]
      : [],
    details: [
      ['IBAN', f.iban],
      ['Bank', f.bank || '—'],
      ['Country', f.country],
      ['Customers using it', String(f.customers.length)],
      ...(f.risk ? [['Risk', word(f.risk)]] : []),
      ...(f.customers.length > HUB ? [['Note', 'Common payee or payer: not followed']] : []),
      ...(f.salary ? [['Note', 'Salary payer: not followed']] : []),
    ],
  };
}

function customerNode(c, entry, facts) {
  const flags = customerFlags(facts, c);

  return {
    id: `customer:${c.id}`,
    kind: 'customer',
    label: c.display_name,
    sub: `${word(c.customer_type)} · ${word(c.status)}`,
    flags,
    depth: entry.depth,
    record: { collection: 'customers', id: c.id },
    details: [
      ['Reference', c.reference || '—'],
      ['Type', word(c.customer_type)],
      ['Status', word(c.status)],
      ['Risk rating', word(c.risk_rating) || '—'],
      ['Customer since', day(c.created_at) || '—'],
      ...(entry.depth ? [['Hops from the record', String(entry.depth)]] : []),
    ],
  };
}

function accountNode(a) {
  const frozen = a.status === 'FROZEN';

  return {
    id: `account:${a.id}`,
    kind: 'account',
    label: `${word(a.type)} ··${String(a.iban || '').slice(-4)}`,
    sub: word(a.status),
    flags: frozen ? [flag('frozen', 'Frozen', 'red', word(a.freeze_reason))] : [],
    record: { collection: 'accounts', id: a.id },
    details: [
      ['IBAN', a.iban || '—'],
      ['Status', word(a.status)],
      ...(frozen ? [['Freeze reason', word(a.freeze_reason) || '—']] : []),
      ['Balance', euros(Number(a.balance) || 0)],
      ['Opened', day(a.opened_at) || '—'],
    ],
  };
}

/** Everything the graph needs, in one place, so selection can count nodes before drawing. */
class Graph {
  nodes;

  edges;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  node(n) {
    if (!this.nodes.has(n.id)) this.nodes.set(n.id, n);

    return this.nodes.get(n.id);
  }

  edge(from, to, kind, extra = {}) {
    const id = `${from}>${to}:${kind}`;
    if (!this.edges.has(id)) this.edges.set(id, { id, from, to, kind, ...extra });
  }
}

const EDGE_LABEL = {
  owns: 'owns',
  device: 'used device',
  phone: 'phone series',
  lives: 'lives in',
};

/**
 * What one customer brings to the graph: its node, the shared things it links to, its accounts
 * with money on the graph's IBANs. `shared` = the things to show for non-center customers.
 */
function plan(ctx, customerId, shared) {
  const { people, facts, flows, center } = ctx;
  const isCenter = center.has(customerId);
  const items = [];
  const ids = people.peopleOf.get(customerId) || [];
  const { fingerprints, series } = identityOf(people, customerId);
  const allSeries = isCenter ? uniq(ids.map(i => seriesKey(people.person.get(i)?.phone))) : series;
  fingerprints
    .filter(fp => isCenter || shared.device.has(fp))
    .forEach(fp => items.push({ kind: 'device', key: fp }));
  allSeries
    .filter(s => isCenter || shared.phone.has(s))
    .forEach(s => items.push({ kind: 'phone', key: s }));
  uniq(ids.map(i => people.person.get(i)?.postal_code))
    .filter(p => isCenter || (shared.postal.has(p) && ctx.centerPostal.has(p)))
    .forEach(p => items.push({ kind: 'postal', key: p }));
  const accounts = facts.accounts.get(customerId) || [];
  const money = flows.filter(
    f =>
      accounts.some(a => a.id === f.account) && (isCenter ? ctx.ownIbans : shared.iban).has(f.iban),
  );
  const shownAccounts = isCenter
    ? accounts.slice(0, OWN_ACCOUNTS)
    : accounts.filter(a => money.some(f => f.account === a.id));

  return { items, accounts: shownAccounts, money };
}

/** The node of a shared thing: a device, a phone series, a postal area. */
function entityNode(kind, key, people, customerId) {
  if (kind === 'device') return deviceNode(key, people);

  if (kind === 'phone') {
    const members = people.bySeries.get(key) || [];
    const sample = people.person.get(members[0])?.phone;

    return {
      id: `phone:${key}`,
      kind: 'phone',
      label: seriesLabel(sample || key),
      sub: 'Phone series',
      flags: [],
      details: [['People with a number in it', String(members.length)]],
    };
  }

  const one = (people.peopleOf.get(customerId) || [])
    .map(i => people.person.get(i))
    .find(x => x?.postal_code === key);

  return {
    id: `postal:${key}`,
    kind: 'postal',
    label: `${key} ${one?.city || ''}`.trim(),
    sub: 'Postal area',
    flags: [],
    details: [['Postal code', key]],
  };
}

function addPlan(graph, ctx, customerId, p) {
  const { people, facts, ibans } = ctx;
  const c = facts.customers.get(customerId);
  if (!c) return;
  const cid = `customer:${customerId}`;
  graph.node(customerNode(c, ctx.found.get(customerId), facts));
  p.items.forEach(({ kind, key }) => {
    const node = entityNode(kind, key, people, customerId);
    graph.node(node);
    graph.edge(cid, node.id, kind === 'postal' ? 'lives' : kind, {
      label: EDGE_LABEL[kind === 'postal' ? 'lives' : kind],
    });
  });
  p.accounts.forEach(a => {
    graph.node(accountNode(a));
    graph.edge(cid, `account:${a.id}`, 'owns', { label: EDGE_LABEL.owns });
  });
  p.money.forEach(f => {
    const node = graph.node(ibanNode(ibans.get(f.iban)));
    const [from, to] =
      f.side === 'out' ? [`account:${f.account}`, node.id] : [node.id, `account:${f.account}`];
    graph.edge(from, to, f.side === 'out' ? 'paid' : 'received', {
      label: `${euros(f.total)} · ${f.count}`,
      amount: Math.round(f.total * 100) / 100,
      count: f.count,
      first: f.first,
      last: f.last,
    });
  });
}

/** The shared things between the chosen customers: kept when 2 or more of them use one. */
function sharedAmong(ctx, chosen) {
  const count = new Map();
  const bump = key => count.set(key, (count.get(key) || 0) + 1);
  chosen.forEach(c => {
    const { fingerprints, series } = identityOf(ctx.people, c);
    fingerprints.forEach(fp => bump(`device|${fp}`));
    series.forEach(s => bump(`phone|${s}`));
    uniq(
      (ctx.people.peopleOf.get(c) || []).map(i => ctx.people.person.get(i)?.postal_code),
    ).forEach(p => bump(`postal|${p}`));
    uniq(
      ctx.flows
        .filter(f => (ctx.facts.accounts.get(c) || []).some(a => a.id === f.account))
        .map(f => f.iban),
    )
      .filter(i => ctx.ibans.get(i)?.links)
      .forEach(i => bump(`iban|${i}`));
  });
  const set = kind =>
    new Set(
      [...count.entries()]
        .filter(([k, n]) => n >= 2 && k.startsWith(`${kind}|`))
        .map(([k]) => k.slice(kind.length + 1)),
    );

  return { device: set('device'), phone: set('phone'), postal: set('postal'), iban: set('iban') };
}

function build(ctx, chosen) {
  const graph = new Graph();
  const shared = sharedAmong(ctx, chosen);
  chosen.forEach(c => addPlan(graph, ctx, c, plan(ctx, c, shared)));

  return graph;
}

/** The record's own payees and payers worth showing: unusual or shared first, then by amount. */
function pickOwnIbans(ctx) {
  const own = ctx.flows.filter(f =>
    [...ctx.center].some(c => (ctx.facts.accounts.get(c) || []).some(a => a.id === f.account)),
  );
  const byIban = new Map();
  own.forEach(f => byIban.set(f.iban, (byIban.get(f.iban) || 0) + f.total));

  const rank = iban => {
    const f = ctx.ibans.get(iban);

    return (f.links ? 1e9 : 0) + (f.blocked ? 1e8 : 0) + (f.abroad ? 1e7 : 0) + byIban.get(iban);
  };

  const ordered = [...byIban.keys()].sort((a, b) => rank(b) - rank(a));
  const linked = ordered.filter(i => ctx.ibans.get(i).links);
  const sides = side =>
    ordered
      .filter(i => !ctx.ibans.get(i).links && own.some(f => f.iban === i && f.side === side))
      .slice(0, OWN_IBANS);

  return new Set([...linked, ...sides('out'), ...sides('in')]);
}

// ---- stories --------------------------------------------------------------------------------

const ORDER = ['device', 'phone', 'postal'];

function sharedThing(node) {
  if (node.kind === 'device') {
    return `device ${node.id.slice(7, 13)}… (${node.label}${node.flags.length ? ', revoked' : ''})`;
  }

  return node.kind === 'phone' ? `phone series ${node.label}` : `postal area ${node.label}`;
}

/** "10 customers share device …, phone series … and postal area …": one line per group. */
function identityStories(graph) {
  const customersOn = new Map();
  graph.edges.forEach(e => {
    if (['device', 'phone', 'lives'].includes(e.kind)) pushTo(customersOn, e.to, e.from);
  });
  const groups = new Map();
  customersOn.forEach((cs, nodeId) => {
    const set = uniq(cs).sort();
    if (set.length >= 2) pushTo(groups, set.join(','), nodeId);
  });

  return [...groups.entries()].map(([key, nodeIds]) => {
    const n = key.split(',').length;
    const order = id => ORDER.indexOf(id.split(':')[0]);
    const parts = nodeIds
      .sort((a, b) => order(a) - order(b))
      .map(id => sharedThing(graph.nodes.get(id)));
    const said =
      parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.pop()}` : parts[0];
    const weight = nodeIds.some(id => id.startsWith('device:')) ? 300 : 200;

    return { weight: weight + n, text: `${n} customers share ${said}` };
  });
}

/** "4 customers paid Konstantinou Trading Ltd (CY): €25,249 in 12 transfers". */
function moneyStories(graph, ctx) {
  const ownerOf = new Map();
  graph.edges.forEach(e => {
    if (e.kind === 'owns') ownerOf.set(e.to, e.from);
  });
  const money = new Map();
  graph.edges.forEach(e => {
    if (e.kind !== 'paid' && e.kind !== 'received') return;
    const [iban, account] = e.kind === 'paid' ? [e.to, e.from] : [e.from, e.to];

    if (!money.has(iban)) {
      money.set(iban, { customers: new Set(), total: 0, count: 0, kind: e.kind });
    }

    const m = money.get(iban);
    m.customers.add(ownerOf.get(account));
    m.total += e.amount;
    m.count += e.count;
  });

  return [...money.entries()]
    .filter(([, m]) => m.customers.size >= 2)
    .map(([nodeId, m]) => {
      const node = graph.nodes.get(nodeId);
      const f = ctx.ibans.get(node.iban);
      const who = `${node.label} (${f.country}${f.blocked ? ', blocked' : ''})`;
      const sum = `${euros(m.total)} in ${m.count} transfers`;
      const n = m.customers.size;
      const text =
        m.kind === 'paid'
          ? `${n} customers paid ${who}: ${sum}`
          : `${who} paid ${n} customers: ${sum}`;

      return { weight: (f.blocked || f.abroad ? 400 : 250) + n, text };
    });
}

function stories(graph, ctx) {
  const lines = [...moneyStories(graph, ctx), ...identityStories(graph)];

  if (!lines.length) {
    return ['No device, phone series or unusual payee shared with another customer.'];
  }

  return lines
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(l => l.text);
}

// ---- the chart ------------------------------------------------------------------------------

const empty = (collection, id, reason) => ({
  record: { collection, id: id ?? null },
  center: null,
  nodes: [],
  edges: [],
  stories: [reason],
  counts: { customers: 0, linked: 0, hidden: 0 },
  layout: layoutNetwork({ nodes: [] }).layout,
});

/** The network of one record: `collection` is the chart's collection, `id` the record id. */
async function network(list, collection, id) {
  const record = await resolveRecord(list, collection, id);
  if (!record) return empty(collection, id, 'No customer on this record.');
  const people = await loadPeople(list);
  const ibans = new Map();
  const found = await search(list, people, ibans, record.customers);
  const ids = [...found.keys()];
  const facts = await customerFacts(list, people, ids);
  const center = new Set(record.customers);
  // Money on the IBANs that can show: every IBAN of the record's customer, the linking ones of
  // the others.
  const centerRows = (await ibanRows(list, 'customer_id', record.customers)).filter(r =>
    ibans.has(r.iban),
  );
  const linkRows = [...ibans.values()]
    .filter(f => f.links)
    .flatMap(f => f.rows.filter(r => found.has(r.customer_id)));
  const accountIds = ids.flatMap(c => (facts.accounts.get(c) || []).map(a => a.id));
  const flows = await moneyBetween(list, [...centerRows, ...linkRows], accountIds);
  const ctx: Record<string, any> = { people, facts, ibans, flows, center, found };
  ctx.ownIbans = pickOwnIbans(ctx);
  // A postal area joins others only where the record's customer lives (a city alone links nobody).
  ctx.centerPostal = new Set(
    record.customers.flatMap(c =>
      (people.peopleOf.get(c) || []).map(i => people.person.get(i)?.postal_code),
    ),
  );
  // Rank the others: links, then flags; keep adding while the graph stays within MAX_NODES.
  const others = ids
    .filter(c => !center.has(c) && facts.customers.has(c))
    .map(c => {
      const entry = found.get(c);
      const flags = customerFlags(facts, facts.customers.get(c));

      return { id: c, rank: entry.score + flagScore(flags) / entry.depth, depth: entry.depth };
    })
    .sort((a, b) => a.depth - b.depth || b.rank - a.rank);
  let chosen = [...center];
  let graph = build(ctx, chosen);
  let hidden = 0;
  others.forEach(o => {
    if (hidden) {
      hidden += 1;

      return;
    }

    const next = build(ctx, [...chosen, o.id]);

    if (next.nodes.size > MAX_NODES) {
      hidden += 1;

      return;
    }

    chosen = [...chosen, o.id];
    graph = next;
  });
  // A customer whose only link fell out with the cut is dropped (no floating customers).
  const linkedIds = new Set();
  graph.edges.forEach(e => {
    linkedIds.add(e.from);
    linkedIds.add(e.to);
  });
  const nodes = [...graph.nodes.values()];
  const anchors = nodes.filter(n => n.kind !== 'customer' && n.kind !== 'account');
  const reachedBy = new Map();
  graph.edges.forEach(e => {
    pushTo(reachedBy, e.from, e.to);
    pushTo(reachedBy, e.to, e.from);
  });

  return layoutNetwork({
    record: { collection, id },
    center: record.center,
    nodes: nodes.map(n => ({ ...n, links: uniq(reachedBy.get(n.id) || []).length })),
    edges: [...graph.edges.values()],
    stories: stories(graph, ctx),
    counts: {
      customers: nodes.filter(n => n.kind === 'customer').length,
      linked: others.length,
      hidden,
      shared: anchors.filter(n => (reachedBy.get(n.id) || []).length >= 2).length,
    },
  });
}

/** The chart on each collection a record page can show it on. */
function addNetworkCharts(customizer) {
  COLLECTIONS.forEach(collection =>
    customizer.customizeCollection(collection, c =>
      c.addChart('network', async (context, resultBuilder) => {
        let id = null;

        try {
          id = context.recordId;
        } catch (error) {
          id = null;
        }

        return resultBuilder.smart(await network(agentList(context.dataSource), collection, id));
      }),
    ),
  );
}

export { COLLECTIONS, MAX_NODES, addNetworkCharts, network, seriesLabel };
