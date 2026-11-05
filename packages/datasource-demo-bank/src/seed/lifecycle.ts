/**
 * Wave D, part 2: lifecycle. What happens to a relationship besides payments and credit.
 *
 * - Closures: customers who asked to leave (the remaining balance sent to their own account
 *   elsewhere), bank exits after an investigation (two months' notice for a person, none for
 *   fraud), dormant accounts given notice, a deceased customer's estate, a liquidated company.
 * - Authority requests: tax garnishments (SATD) from the DGFiP, bailiff seizures
 *   (saisie-attribution, saisie conservatoire) by a commissaire de justice, police and Tracfin
 *   information requests (no money; one opens an investigation). Seized money is a hold; a person
 *   always keeps the solde bancaire insaisissable.
 * - Business events from the company register (BODACC): ownership changes open a KYB review,
 *   other changes wait for triage or are dismissed; insolvencies are followed by the legal team.
 * - Insolvency proceedings: a liquidation closed, one just opened (balance held), a
 *   receivership where the bank filed its claim, a personal debt restructuring (surendettement)
 *   pausing a collection case.
 * - Deceased customers: notified by the family or found by the yearly RNIPP check (loi Eckert),
 *   accounts frozen, funds released to the notary; a joint account carries on with the survivor.
 * - QA reviews: a reviewer re-checks past decisions on KYC cases, alerts, investigations,
 *   chargebacks and complaints.
 */
import { toDate } from './banking';
import {
  NOW,
  at,
  informationRequest,
  investigation,
  mail,
  numberReferences,
  op,
  past,
  trail,
} from './crime';
import { ledger, post, rebalance, spendable } from './ledger';
import { DAY, between, iso, isoDate, round2, uuid, withTime } from './random';
import { frenchIban } from './reference';

const WAVE_D_LIFECYCLE = [
  'closures',
  'authority_requests',
  'business_events',
  'insolvency_proceedings',
  'deceased_cases',
  'qa_reviews',
];

// Solde bancaire insaisissable: what a seized person always keeps, the RSA for one person.
const SBI = 646.52;
const MLRO = mail('anne.delorme');

const ago = date => (NOW.getTime() - date) / DAY;
const daysAfter = (date, n) => new Date(date.getTime() + n * DAY);

const addMonths = (date, n) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + n);

  return d;
};

const fullName = p => `${p.first_name} ${p.last_name}`;
const sumBalances = list => round2(list.reduce((s, a) => s + Number(a.balance), 0));

// ---- shared helpers -----------------------------------------------------------------------------

/** One more line in a record's history, after its last one. */
function addStatus(ctx, type, record, status, when, by, reason) {
  const lines = ctx.rows.status_changes.filter(s => s.record_id === record.id);
  const last = lines.reduce((a, s) => (!a || s.changed_at > a.changed_at ? s : a), null);
  const floor = last ? toDate(last.changed_at).getTime() + 1000 : 0;
  const date = new Date(Math.max(floor, past(when).getTime()));
  ctx.rows.status_changes.push({
    id: uuid(),
    record_type: type,
    record_id: record.id,
    field: 'status',
    old_value: last ? last.new_value : null,
    new_value: status,
    changed_by: by || 'system',
    changed_at: iso(date),
    reason: reason || null,
  });
}

/** Customers already in a story or a case: lifecycle events go to others. */
function busyCustomers(ctx) {
  const used = new Set();
  ctx.stories.forEach(s => used.add(s.customer?.id));
  [
    'alerts',
    'dispute_requests',
    'complaints',
    'loan_applications',
    'collection_cases',
    'limit_requests',
    'investigations',
    'chargebacks',
    'sepa_disputes',
    'customer_change_requests',
  ].forEach(t => ctx.rows[t].forEach(r => used.add(r.customer_id)));
  ctx.rows.kyc_cases
    .filter(k => !['APPROVED', 'REJECTED'].includes(k.status))
    .forEach(k => used.add(k.customer_id));

  return used;
}

/** A free customer that fits, taken so nobody else uses it. */
function draw(ctx, fits) {
  const free = ctx.rows.customers.filter(c => !ctx.used.has(c.id) && fits(c));
  if (!free.length) return null;
  const customer = free[between(0, free.length - 1)];
  ctx.used.add(customer.id);

  return customer;
}

const accountsOf = (ctx, customer) => ctx.accountsOf.get(customer.id) || [];
const mainAccount = (ctx, customer) =>
  accountsOf(ctx, customer).find(a => a.type !== 'SAVINGS' && a.status === 'ACTIVE');
const singleHolder = (ctx, customer) => (ctx.membersOf.get(customer.id) || []).length === 1;
const activeRetail = ctx => c =>
  c.customer_type === 'RETAIL' && c.status === 'ACTIVE' && mainAccount(ctx, c);
const activeBusiness = ctx => c =>
  c.customer_type === 'BUSINESS' && c.status === 'ACTIVE' && mainAccount(ctx, c);

/** The last payment a person made themselves (cards, transfers, Wero...). */
function lastOwnPayment(ctx) {
  const last = new Map();
  ctx.rows.transactions.forEach(t => {
    const id = t.initiated_by_id;
    if (id && (!last.has(id) || t.created_at > last.get(id))) last.set(id, t.created_at);
  });

  return id => (last.has(id) ? toDate(last.get(id)) : new Date(0));
}

/** Nobody logs in after their death: later logins go, devices were last seen before. */
function bury(ctx, person, death) {
  const when = iso(death);
  ctx.rows.login_events = ctx.rows.login_events.filter(
    l => l.individual_id !== person.id || l.created_at < when,
  );
  ctx.rows.devices
    .filter(d => d.individual_id === person.id && d.last_seen_at > when && d.first_seen_at < when)
    .forEach(d => {
      const seen = ctx.rows.login_events
        .filter(l => l.device_id === d.id)
        .reduce((a, l) => (l.created_at > a ? l.created_at : a), d.first_seen_at);
      d.last_seen_at = seen;
    });
}

/** Money on an account that cannot be spent, with its history; the balances follow. */
function holdRow(ctx, account, fields) {
  const row = {
    id: uuid(),
    reference: null,
    account_id: account.id,
    authority_request_id: null,
    investigation_id: null,
    alert_id: null,
    insolvency_proceeding_id: null,
    screening_hit_id: null,
    chargeback_id: null,
    sepa_dispute_id: null,
    status: 'ACTIVE',
    released_at: null,
    released_by: null,
    release_reason: null,
    expires_at: null,
    ...fields,
  };
  ctx.rows.holds.push(row);
  const steps = [['ACTIVE', toDate(row.placed_at), row.placed_by]];

  if (row.status !== 'ACTIVE') {
    steps.push([row.status, toDate(row.released_at), row.released_by, row.release_reason]);
  }

  trail(ctx.rows, 'HOLDS', row, steps);
  rebalance(ctx, account);

  return row;
}

/** A frozen account opens again; its customer is active again once nothing is frozen. */
function unfreeze(ctx, account, when, reason) {
  Object.assign(account, { status: 'ACTIVE', frozen_at: null, freeze_reason: null });
  account.freeze_note = null;
  const customer = ctx.customers.get(account.customer_id);
  if (customer.status !== 'SUSPENDED') return;
  if (accountsOf(ctx, customer).some(a => a.status === 'FROZEN')) return;
  customer.status = 'ACTIVE';
  customer.updated_at = iso(past(when));
  addStatus(ctx, 'CUSTOMERS', customer, 'ACTIVE', when, op('legal'), reason);
}

// ---- closures -----------------------------------------------------------------------------------

/** The transfer that sent a closed account's balance away, when its payee got nothing else. */
function closingPayout(ctx, customer) {
  const ids = new Set(accountsOf(ctx, customer).map(a => a.id));
  const tx = ctx.rows.transactions.find(
    t => ids.has(t.account_id) && t.description === 'VIR SEPA CLOTURE DE COMPTE',
  );
  if (!tx) return null;
  const out = ctx.rows.outgoing_transfers.find(o => o.transaction_id === tx.id);
  const beneficiary = out && ctx.rows.sct_beneficiaries.find(b => b.id === out.beneficiary_id);
  const party = ctx.rows.counterparties.find(c => c.id === tx.counterparty_id);

  const once = ctx.partyUse.get(tx.counterparty_id) === 1;

  return beneficiary && party ? { tx, out, beneficiary, party, once } : null;
}

/** The payee of a closing transfer is who really got the money: an own account, a notary... */
function relabel(ctx, payout, name, nickname, byBank) {
  if (!payout.once) return false;
  // The same person may already be a Wero or wallet contact; never another payee of that name.
  const taken = ctx.rows.counterparties.some(
    c => c.name === name && c.id !== payout.party.id && c.counterparty_type === 'SCT_BENEFICIARY',
  );
  if (taken) return false;
  payout.party.name = name;
  payout.beneficiary.nickname = nickname;

  if (byBank) {
    // Notaries and liquidators hold client money at the Caisse des Dépôts.
    Object.assign(payout.beneficiary, {
      bank_name: 'Caisse des Dépôts et Consignations',
      bic: 'CDCGFRPPXXX',
      iban: frenchIban(between(10000000, 99999999999), '40031', '00001'),
      added_from_device_id: null,
      added_at: iso(at(toDate(payout.tx.created_at), -26)),
      is_trusted: false,
    });
  }

  return true;
}

function closureHistory(ctx, row, dates, why) {
  const by = row.initiated_by === 'CUSTOMER' ? 'customer' : row.approved_by;
  const steps = [['REQUESTED', dates.requested, by, why]];
  if (dates.approved) steps.push(['APPROVED', dates.approved, row.approved_by]);

  if (dates.noticeSent) {
    steps.push(['NOTICE_SENT', dates.noticeSent, row.approved_by, 'Two months’ notice sent']);
  }

  if (dates.payout) steps.push(['PENDING_PAYOUT', dates.payout, row.approved_by]);

  if (dates.closed) {
    steps.push(['CLOSED', dates.closed, 'system', 'Remaining balance sent, accounts closed']);
  }

  if (dates.cancelled) steps.push(['CANCELLED', dates.cancelled, by, dates.cancelReason]);
  trail(ctx.rows, 'CLOSURES', row, steps);
}

/** A closure, from the dates it went through (the last one is its status). */
function closure(ctx, customer, spec) {
  const { dates } = spec;
  const noticeEnd = dates.noticeSent ? addMonths(dates.noticeSent, 2) : null;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    account_id: spec.account?.id || null,
    initiated_by: spec.initiated || 'CUSTOMER',
    reason: spec.reason || 'CUSTOMER_REQUEST',
    investigation_id: spec.investigation?.id || null,
    deceased_case_id: spec.deceased?.id || null,
    insolvency_proceeding_id: spec.insolvency?.id || null,
    payout_beneficiary_id: spec.payout?.beneficiary.id || null,
    payout_transaction_id: dates.closed ? spec.payout.tx.id : null,
    requested_at: iso(dates.requested),
    notice_end_date: noticeEnd && isoDate(noticeEnd),
    balance_to_return: spec.balance,
    status: spec.status,
    closed_at: dates.closed ? iso(dates.closed) : null,
    approved_by: dates.approved ? spec.approver || op('support') : null,
    notice_sent_at: dates.noticeSent ? iso(dates.noticeSent) : null,
  };
  ctx.rows.closures.push(row);
  closureHistory(ctx, row, dates, spec.why);

  return row;
}

/** The payee that is the holder's own account at another bank. */
function ownPayee(ctx, customer) {
  const holder = ctx.holderOf(customer);
  const parties = new Map<any, any>(ctx.rows.counterparties.map(c => [c.id, c]));

  return (
    holder &&
    ctx.rows.sct_beneficiaries.find(
      b =>
        b.customer_id === customer.id && parties.get(b.counterparty_id)?.name === fullName(holder),
    )
  );
}

/** A customer who left: asked, approved, balance sent to their own account elsewhere, closed. */
function pastCustomerClosure(ctx, customer, payout) {
  const own = ownPayee(ctx, customer);
  if (!own) return;
  // The money left for the customer's own account, not a payee from their statement.
  payout.out.beneficiary_id = own.id;
  payout.tx.counterparty_id = own.counterparty_id;

  if (!own.last_used_at || own.last_used_at < payout.tx.created_at) {
    own.last_used_at = payout.tx.created_at;
  }

  const closed = toDate(payout.tx.booked_at);
  const requested = withTime(daysAfter(closed, -between(3, 12)));
  const approved = at(requested, between(4, 30));
  closure(ctx, customer, {
    status: 'CLOSED',
    balance: Number(payout.tx.amount),
    payout: { ...payout, beneficiary: own },
    dates: { requested, approved, payout: at(approved, 1), closed },
    why: 'Customer asked to close the account in the app',
  });
}

/** Leaving after an investigation: the decision becomes an exit, with two months' notice. */
function riskExit(ctx) {
  const closed = type => i =>
    i.decision === 'NO_SAR' &&
    i.type === type &&
    ctx.customers.get(i.customer_id).status === 'ACTIVE' &&
    ctx.customers.get(i.customer_id).customer_type === 'RETAIL';
  // An AML case first; a fraud case cleared without a report when no AML case fits.
  const inv =
    ctx.rows.investigations.find(closed('AML')) || ctx.rows.investigations.find(closed('FRAUD'));
  if (!inv) return;
  inv.decision = 'EXIT_RELATIONSHIP';
  ctx.rows.status_changes
    .filter(s => s.record_id === inv.id && s.new_value === 'CLOSED')
    .forEach(s => {
      s.reason = 'EXIT_RELATIONSHIP';
    });
  const customer = ctx.customers.get(inv.customer_id);
  ctx.used.add(customer.id);
  const requested = past(at(toDate(inv.decided_at), between(24, 72)));
  const approved = past(at(requested, between(4, 24)));
  const noticeSent = past(at(approved, between(2, 20)));
  const ended = addMonths(noticeSent, 2) < NOW;
  closure(ctx, customer, {
    initiated: 'BANK',
    reason: 'RISK_EXIT',
    investigation: inv,
    status: ended ? 'PENDING_PAYOUT' : 'NOTICE_SENT',
    approver: MLRO,
    balance: sumBalances(accountsOf(ctx, customer)),
    dates: { requested, approved, noticeSent, payout: ended ? addMonths(noticeSent, 2) : null },
    why: 'Investigation closed: activity outside our risk appetite',
  });
}

/** A money mule reported to Tracfin: closed without notice (financial crime). */
function fraudExit(ctx) {
  const inv = ctx.rows.investigations.find(i => i.decision === 'SAR_FILED');
  if (!inv) return;
  const customer = ctx.customers.get(inv.customer_id);
  const requested = past(at(toDate(inv.decided_at), between(48, 120)));
  closure(ctx, customer, {
    initiated: 'BANK',
    reason: 'FRAUD',
    investigation: inv,
    status: 'APPROVED',
    approver: MLRO,
    balance: sumBalances(accountsOf(ctx, customer)),
    dates: { requested, approved: past(at(requested, between(4, 24))) },
    why: 'SAR filed: relationship ended without notice',
  });
}

/** Dormant accounts the bank closes, with two months' notice. */
function dormancyClosures(ctx) {
  const dormant = c =>
    c.customer_type === 'RETAIL' &&
    c.status === 'ACTIVE' &&
    accountsOf(ctx, c).some(a => a.status === 'DORMANT' && a.type === 'CURRENT') &&
    // Loi Eckert: inactive only if no account of the customer was used for 12 months.
    accountsOf(ctx, c).every(a => ago(toDate(a.last_activity_at)) > 365);
  ['NOTICE_SENT', 'APPROVED'].forEach(status => {
    const customer = draw(ctx, dormant);
    if (!customer) return;
    const accounts = accountsOf(ctx, customer).filter(a => a.status !== 'CLOSED');
    const account = accounts.find(a => a.status === 'DORMANT');
    const requested = withTime(daysAfter(NOW, status === 'APPROVED' ? -3 : -between(20, 40)));
    const approved = past(at(requested, between(20, 30)));
    closure(ctx, customer, {
      initiated: 'BANK',
      reason: 'DORMANCY',
      account: accounts.length > 1 ? account : null,
      status,
      approver: op('l2'),
      balance: Number(account.balance),
      dates: {
        requested,
        approved,
        noticeSent: status === 'NOTICE_SENT' ? past(at(approved, between(2, 20))) : null,
      },
      why: 'No activity for more than 12 months',
    });
  });
}

/** Customers leaving right now: new requests, one waiting for the payout, one who stayed. */
function openCustomerClosures(ctx) {
  const retail = activeRetail(ctx);
  const withSavings = c =>
    retail(c) && accountsOf(ctx, c).some(a => a.type === 'SAVINGS' && a.status === 'ACTIVE');
  const plans: [string, (c) => any, string][] = [
    ['REQUESTED', retail, null],
    ['REQUESTED', withSavings, 'SAVINGS'],
    ['PENDING_PAYOUT', retail, null],
    ['CANCELLED', retail, null],
  ];
  plans.forEach(([status, fits, only]) => {
    const customer = draw(ctx, fits);
    if (!customer) return;
    const account = only && accountsOf(ctx, customer).find(a => a.type === only);
    const days = { REQUESTED: [0, 1], PENDING_PAYOUT: [4, 8], CANCELLED: [20, 30] }[status];
    const requested = past(withTime(daysAfter(NOW, -between(days[0], days[1]))));
    const dates: Record<string, any> = { requested };

    if (status === 'PENDING_PAYOUT') {
      dates.approved = past(at(requested, between(4, 30)));
      dates.payout = past(at(dates.approved, 1));
    }

    if (status === 'CANCELLED') {
      dates.cancelled = past(at(requested, between(24, 60)));
      dates.cancelReason = 'Customer decided to stay after a call with support';
    }

    closure(ctx, customer, {
      account,
      status,
      balance: account ? Number(account.balance) : sumBalances(accountsOf(ctx, customer)),
      dates,
      why: only ? 'Customer asked to close the savings account' : 'Customer asked to leave',
    });
  });
}

// ---- deceased customers -------------------------------------------------------------------------

function deceasedRow(ctx, person, fields) {
  const row = {
    id: uuid(),
    reference: null,
    individual_id: person.id,
    date_of_death: null,
    notified_at: null,
    notified_by: null,
    executor_name: null,
    notary_name: null,
    balance_at_death: null,
    status: 'NOTIFIED',
    certificate_verified_at: null,
    assigned_to: op('legal'),
    funds_released_at: null,
    ...fields,
  };
  ctx.rows.deceased_cases.push(row);

  return row;
}

function deceasedHistory(ctx, row, dates) {
  const steps = [
    ['NOTIFIED', toDate(row.notified_at), row.assigned_to || 'system', row.notified_by],
  ];
  if (dates.frozen) steps.push(['ACCOUNTS_FROZEN', dates.frozen, row.assigned_to]);

  if (row.certificate_verified_at) {
    steps.push(['CERTIFICATE_VERIFIED', toDate(row.certificate_verified_at), row.assigned_to]);
  }

  if (row.funds_released_at) {
    steps.push([
      'FUNDS_RELEASED',
      toDate(row.funds_released_at),
      row.assigned_to,
      'Balance sent to the notary',
    ]);
  }

  if (dates.closed) steps.push(['CLOSED', dates.closed, row.assigned_to, dates.why]);
  trail(ctx.rows, 'DECEASED_CASES', row, steps);
}

// Fictional notaries, one per estate.
const NOTARIES = [
  'Maître Agnès Poulain, notaire',
  'Maître Ludovic Herbelin, notaire',
  'Maître Corinne Vasselin, notaire',
  'Maître Bertrand Quemener, notaire',
];

/** The person's cards stop on the day the bank learns of the death. */
function stopCards(ctx, person, when) {
  ctx.rows.cards
    .filter(c => c.holder_id === person.id && ['ACTIVE', 'PENDING'].includes(c.status))
    .forEach(c => Object.assign(c, { status: 'CANCELLED', blocked_at: iso(when) }));
}

/** A customer who left after dying: estate paid to the notary, accounts closed. */
const HEIRS = ['Claire', 'Thomas', 'Sophie', 'Nicolas', 'Isabelle', 'Julien', 'Anne', 'Marc'];

function pastDeceased(ctx, customer, payout) {
  const person = ctx.holderOf(customer);
  const notary = NOTARIES[0];

  if (!relabel(ctx, payout, `Office notarial ${notary.split(',')[0]}`, 'Succession', true)) {
    return false;
  }

  const closed = toDate(payout.tx.booked_at);
  const death = withTime(daysAfter(closed, -between(70, 120)));
  const notified = at(death, between(5, 20) * 24);
  const verified = at(notified, between(2, 10) * 24);
  bury(ctx, person, death);
  const row = deceasedRow(ctx, person, {
    date_of_death: isoDate(death),
    notified_at: iso(notified),
    notified_by: 'Family, by phone',
    notary_name: notary,
    // The heir who settled the estate with the notary (same family name, fixed by the file).
    executor_name: `${
      HEIRS[parseInt(person.id.replace(/-/g, '').slice(0, 6), 16) % HEIRS.length]
    } ${person.last_name}`,
    balance_at_death: Number(payout.tx.amount),
    status: 'CLOSED',
    certificate_verified_at: iso(verified),
    funds_released_at: iso(closed),
  });
  deceasedHistory(ctx, row, {
    frozen: at(notified, 2),
    closed: at(closed, 24),
    why: 'Estate settled, accounts closed',
  });
  const requested = at(verified, 4);
  closure(ctx, customer, {
    initiated: 'BANK',
    reason: 'DECEASED',
    deceased: row,
    status: 'CLOSED',
    approver: op('legal'),
    balance: Number(payout.tx.amount),
    payout,
    dates: { requested, approved: at(requested, 24), payout: at(requested, 25), closed },
    why: 'Holder deceased: the notary asked for the balance',
  });

  return true;
}

/** Found by the yearly RNIPP check of inactive accounts (loi Eckert): frozen, certificate in. */
function eckertDeceased(ctx, lastOwn) {
  const quiet = c =>
    c.customer_type === 'RETAIL' &&
    c.status === 'ACTIVE' &&
    singleHolder(ctx, c) &&
    accountsOf(ctx, c).length > 0 &&
    accountsOf(ctx, c).every(a => ago(toDate(a.last_activity_at)) > 60) &&
    ago(lastOwn(ctx.holderOf(c)?.id)) > 60;
  const customer = draw(ctx, quiet);
  if (!customer) return;
  const person = ctx.holderOf(customer);
  const lastSeen = [
    lastOwn(person.id),
    ...accountsOf(ctx, customer).map(a => toDate(a.last_activity_at)),
  ];
  const death = withTime(daysAfter(new Date(Math.max(...lastSeen)), between(5, 25)));
  const notified = withTime(daysAfter(NOW, -between(10, 20)));
  const frozen = at(notified, 3);
  const verified = past(at(notified, between(3, 6) * 24));
  const accounts = accountsOf(ctx, customer);
  const row = deceasedRow(ctx, person, {
    date_of_death: isoDate(death),
    notified_at: iso(notified),
    notified_by: 'Yearly RNIPP check of inactive accounts (loi Eckert)',
    notary_name: NOTARIES[1],
    balance_at_death: sumBalances(accounts),
    status: 'CERTIFICATE_VERIFIED',
    certificate_verified_at: iso(verified),
  });
  deceasedHistory(ctx, row, { frozen });
  bury(ctx, person, death);
  accounts.forEach(a =>
    Object.assign(a, {
      status: 'FROZEN',
      frozen_at: iso(frozen),
      freeze_reason: 'DECEASED',
      freeze_note: 'Holder deceased: frozen until the notary settles the estate.',
    }),
  );
  stopCards(ctx, person, frozen);
  customer.status = 'SUSPENDED';
  customer.updated_at = iso(frozen);
  addStatus(ctx, 'CUSTOMERS', customer, 'SUSPENDED', frozen, row.assigned_to, 'Holder deceased');
  const requested = at(verified, 2);
  closure(ctx, customer, {
    initiated: 'BANK',
    reason: 'DECEASED',
    deceased: row,
    status: 'APPROVED',
    approver: row.assigned_to,
    balance: row.balance_at_death,
    dates: { requested: past(requested), approved: past(at(requested, 20)) },
    why: 'Holder deceased: waiting for the notary’s instructions',
  });
}

/** Just reported by the family: nothing frozen yet, the case waits in the inbox. */
function newDeceased(ctx, lastOwn) {
  const recent = (low, high) => c =>
    activeRetail(ctx)(c) &&
    singleHolder(ctx, c) &&
    ago(lastOwn(ctx.holderOf(c)?.id)) > low &&
    ago(lastOwn(ctx.holderOf(c)?.id)) < high;
  // Someone quiet for days; some datasets have nobody that quiet: then a shorter spell.
  const customer = draw(ctx, recent(3, 15)) || draw(ctx, recent(1, 30));
  if (!customer) return;
  const person = ctx.holderOf(customer);
  const death = withTime(daysAfter(lastOwn(person.id), 1));
  const row = deceasedRow(ctx, person, {
    date_of_death: isoDate(death),
    notified_at: iso(past(at(NOW, -between(2, 10)))),
    notified_by: 'Son, by phone',
    assigned_to: null,
  });
  deceasedHistory(ctx, row, {});
  bury(ctx, person, death);
}

/** A joint holder died: the survivor keeps the account, the estate is told what it held. */
function jointDeceased(ctx, lastOwn) {
  // One holder quiet for weeks, the other still paying. Some datasets have no such pair: then a
  // shorter quiet spell (still long enough for the death to be reported in the past).
  const joint = (quiet, active) => c => {
    const members = ctx.membersOf.get(c.id) || [];
    const days = members.map(m => ago(lastOwn(m.individual_id)));

    return (
      activeRetail(ctx)(c) &&
      members.length === 2 &&
      days.some(d => d > quiet && d < 200) &&
      days.some(d => d < active)
    );
  };

  let quiet = 25;
  let customer = draw(ctx, joint(25, 5));

  if (!customer) {
    quiet = 18;
    customer = draw(ctx, joint(18, 15));
  }

  if (!customer) return;
  const member = ctx.membersOf.get(customer.id).find(m => ago(lastOwn(m.individual_id)) > quiet);
  const person = ctx.people.get(member.individual_id);
  const death = withTime(daysAfter(lastOwn(person.id), between(1, 4)));
  const notified = at(death, between(5, 12) * 24);
  const verified = past(at(notified, between(3, 8) * 24));
  const account = mainAccount(ctx, customer);
  const before = (ctx.txOf.get(account.id) || [])
    .filter(t => t.status === 'BOOKED' && t.booked_at < iso(death))
    .sort((a, b) => (a.booked_at < b.booked_at ? -1 : 1))
    .pop();
  const row = deceasedRow(ctx, person, {
    date_of_death: isoDate(death),
    notified_at: iso(notified),
    notified_by: 'Surviving spouse, by letter with the death certificate',
    // The surviving joint holder settles the estate with the notary.
    executor_name: fullName(
      ctx.people.get(ctx.membersOf.get(customer.id).find(m => m !== member).individual_id),
    ),
    notary_name: NOTARIES[2],
    balance_at_death: before ? Number(before.balance_after) : Number(account.balance),
    status: 'CLOSED',
    certificate_verified_at: iso(verified),
  });
  deceasedHistory(ctx, row, {
    closed: past(at(verified, 48)),
    why: 'Joint account carries on with the survivor; balance at death sent to the notary',
  });
  member.until = isoDate(death);
  bury(ctx, person, death);
  stopCards(ctx, person, notified);
}

// ---- authority requests -------------------------------------------------------------------------

function authorityRow(ctx, customer, fields) {
  const person = customer.customer_type === 'RETAIL' ? ctx.holderOf(customer) : null;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    individual_id: person?.id || null,
    business_id: person ? null : customer.business_id,
    type: 'INFORMATION_REQUEST',
    requester_type: 'POLICE',
    requester_name: null,
    received_at: null,
    response_due: null,
    amount_claimed: null,
    amount_held: null,
    protected_amount: null,
    status: 'RECEIVED',
    answered_at: null,
    assigned_to: op('legal'),
    channel: 'EMAIL',
    file_url: null,
    ...fields,
  };
  if (person && row.type !== 'INFORMATION_REQUEST') row.protected_amount = SBI;
  row.file_url = `https://files.demo-bank.example/legal/${row.id}/acte.pdf`;
  ctx.rows.authority_requests.push(row);

  return row;
}

const AUTHORITY_STEPS = [
  ['IN_PROGRESS', 'progress'],
  ['FUNDS_HELD', 'held'],
  ['ANSWERED', 'answered'],
  ['PAID_OUT', 'paid'],
  ['CLOSED', 'closed'],
];

function authorityHistory(ctx, row, dates) {
  const steps = [['RECEIVED', toDate(row.received_at), 'system', `By ${row.channel}`]];
  AUTHORITY_STEPS.forEach(([status, key]) => {
    if (dates[key]) steps.push([status, dates[key], row.assigned_to, dates[`${key}Why`]]);
  });
  trail(ctx.rows, 'AUTHORITY_REQUESTS', row, steps);
}

// [type, requester, who, status, days ago, claimed, what the payment says]
const SEIZURES = {
  bailiff: ['SEIZURE', 'BAILIFF', 'SCP Guillot & Maillard, commissaires de justice'],
  freeze: ['PRECAUTIONARY_FREEZE', 'BAILIFF', 'SELARL Maillard Huissiers, commissaires de justice'],
  satd: ['TAX_GARNISHMENT', 'TAX_AUTHORITY', 'DGFiP, Service des impôts des particuliers'],
  satdCompany: ['TAX_GARNISHMENT', 'TAX_AUTHORITY', 'DGFiP, Service des impôts des entreprises'],
};
const PAYMENT_LABEL = {
  SEIZURE: 'PAIEMENT SAISIE-ATTRIBUTION',
  TAX_GARNISHMENT: 'PAIEMENT SATD TRESOR PUBLIC',
};

/** An authority can only reach an account that was already open when its order arrived. */
const openedBefore = (account, when) => Boolean(account) && toDate(account.opened_at) < when;

/** What can be held: the lowest balance from now on, less what a person always keeps. */
const roomOn = (ctx, account, when, kept?) =>
  round2(Math.max(0, spendable(ctx, account, when, false) - (kept || 0)));

function lastStatus(dates) {
  const reached = AUTHORITY_STEPS.filter(([, key]) => dates[key]);

  return reached[reached.length - 1][0];
}

/** The money held, then (when it is time) paid to the creditor and the hold released. */
function seizedMoney(ctx, row, account, spec, dates) {
  delete dates.answered;
  dates.held = new Date(toDate(row.answered_at));
  dates.heldWhy = `${row.amount_held} EUR held`;
  const wait = row.type === 'TAX_GARNISHMENT' ? between(16, 20) : between(32, 40);
  const paidAt = daysAfter(dates.held, wait);
  const paid = ['PAID_OUT', 'CLOSED'].includes(spec.status) && paidAt < NOW ? paidAt : null;
  holdRow(ctx, account, {
    reason: 'AUTHORITY_REQUEST',
    authority_request_id: row.id,
    amount: row.amount_held,
    placed_by: row.assigned_to,
    placed_at: row.answered_at,
    status: paid ? 'RELEASED' : 'ACTIVE',
    released_at: paid && iso(paid),
    released_by: paid && row.assigned_to,
    release_reason: paid && `Paid to ${row.requester_name}`,
  });
  if (!paid) return;
  post(ctx, account, paid, 'DEBIT', row.amount_held, PAYMENT_LABEL[row.type], 'TRANSFERS');
  dates.paid = paid;
  if (spec.status === 'CLOSED') dates.closed = past(daysAfter(paid, between(2, 6)));
  if (account.status === 'FROZEN') unfreeze(ctx, account, paid, 'Garnishment paid');
}

/**
 * A seizure or a garnishment: declared at once, the money held, then paid to the creditor (a
 * seizure after the month the debtor has to contest it).
 */
function seizure(ctx, customer, account, spec) {
  const [type, requester, name] = SEIZURES[spec.kind];
  const { received } = spec;
  const row = authorityRow(ctx, customer, {
    type,
    requester_type: requester,
    requester_name: name,
    received_at: iso(received),
    response_due: isoDate(type === 'TAX_GARNISHMENT' ? daysAfter(received, 15) : received),
    amount_claimed: spec.claimed,
    channel: requester === 'BAILIFF' ? 'BAILIFF_PORTAL' : 'POST',
    assigned_to: spec.status === 'RECEIVED' ? null : op('legal'),
  });
  const dates: Record<string, any> = {};

  if (spec.status !== 'RECEIVED') {
    dates.progress = past(at(received, between(1, 3)));
    dates.answered = past(at(dates.progress, between(1, 3)));
    const held = round2(
      Math.min(spec.claimed, roomOn(ctx, account, received, row.protected_amount)),
    );
    row.amount_held = held;
    row.answered_at = iso(dates.answered);
    if (held > 0) seizedMoney(ctx, row, account, spec, dates);
  }

  row.status = Object.keys(dates).length ? lastStatus(dates) : 'RECEIVED';
  authorityHistory(ctx, row, dates);

  return row;
}

/** Wave A froze a few accounts on a tax garnishment: each gets its request, held then paid. */
function garnishedAccounts(ctx) {
  const frozen = ctx.rows.accounts
    .filter(a => a.status === 'FROZEN' && a.freeze_reason === 'AUTHORITY_REQUEST')
    .sort((a, b) => (a.frozen_at < b.frozen_at ? -1 : 1));
  const fates = ['CLOSED', 'PAID_OUT', 'PAID_OUT', 'FUNDS_HELD'];
  frozen.forEach((account, n) => {
    const customer = ctx.customers.get(account.customer_id);
    ctx.used.add(customer.id);
    const status = n === frozen.length - 1 ? 'FUNDS_HELD' : fates[n];
    const received = at(toDate(account.frozen_at), -between(2, 6));
    const row = seizure(ctx, customer, account, {
      kind: 'satd',
      received,
      claimed: between(8, 45) * 100,
      status,
    });

    // Nothing above the protected amount: declared, nothing held, the account opens again.
    if (!row.amount_held) {
      row.status = 'ANSWERED';
      addStatus(
        ctx,
        'AUTHORITY_REQUESTS',
        row,
        'ANSWERED',
        at(toDate(row.answered_at), 48),
        row.assigned_to,
        'Nothing to seize above the protected amount',
      );
      unfreeze(ctx, account, at(toDate(row.answered_at), 49), 'Nothing to seize');
    }
  });
}

/** Bailiffs and the tax office on customers still active: one new, one held, one paid. */
function otherSeizures(ctx) {
  const plans: [string, string, number[], (c) => any][] = [
    ['bailiff', 'RECEIVED', [0, 0], activeRetail(ctx)],
    ['bailiff', 'FUNDS_HELD', [8, 14], activeRetail(ctx)],
    ['bailiff', 'PAID_OUT', [60, 80], activeRetail(ctx)],
    ['freeze', 'FUNDS_HELD', [5, 12], activeBusiness(ctx)],
    ['satdCompany', 'PAID_OUT', [40, 60], activeBusiness(ctx)],
  ];
  plans.forEach(([kind, status, [from, to], fits]) => {
    const received = past(withTime(daysAfter(NOW, -between(from, to))));
    const enough = c =>
      fits(c) &&
      openedBefore(mainAccount(ctx, c), received) &&
      roomOn(ctx, mainAccount(ctx, c), received, SBI) > 300;
    const customer = draw(ctx, enough);
    if (!customer) return;
    seizure(ctx, customer, mainAccount(ctx, customer), {
      kind,
      received,
      claimed: between(6, 60) * 100,
      status,
    });
  });
}

function incomingTransfers(ctx, customer) {
  const account = mainAccount(ctx, customer);
  const since = iso(daysAfter(NOW, -60));

  return (ctx.txOf.get(account.id) || [])
    .filter(
      t =>
        t.rail === 'TRANSFER' &&
        t.direction === 'CREDIT' &&
        t.category !== 'SALARY' &&
        t.status === 'BOOKED' &&
        t.created_at > since,
    )
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 2);
}

function policeRequisition(ctx, customer) {
  const lines = incomingTransfers(ctx, customer);
  const latest = new Date(Math.max(...lines.map(t => toDate(t.created_at).getTime())));
  const received = past(
    withTime(daysAfter(new Date(Math.max(latest.getTime(), daysAfter(NOW, -14).getTime())), 1)),
  );
  const answered = at(received, between(24, 60));
  // Received in the last days: still being worked on, the answer is not sent yet.
  const done = answered < NOW;
  const row = authorityRow(ctx, customer, {
    requester_type: 'POLICE',
    requester_name: 'Commissariat central, brigade de répression de la délinquance économique',
    received_at: iso(received),
    response_due: isoDate(daysAfter(received, 8)),
    answered_at: done ? iso(answered) : null,
    status: done ? 'ANSWERED' : 'IN_PROGRESS',
  });
  authorityHistory(ctx, row, {
    progress: at(received, 2),
    answered: done ? answered : null,
    answeredWhy: 'Statements sent to the investigator',
  });
  const inv = investigation(ctx, {
    customer,
    type: 'FRAUD',
    origin: 'AUTHORITY_REQUEST',
    opened: past(at(received, 3)),
    status: 'IN_PROGRESS',
    lines,
    summary:
      'Police requisition: transfers received from the victim of a reported scam. Check where the money went next; no contact with the customer (tipping off).',
    priority: 'HIGH',
    quiet: true,
    lineNote: 'Transfer named in the police requisition',
  });
  inv.origin_authority_request_id = row.id;
}

/** Police and Tracfin ask what the bank knows; one request opens an investigation. */
function informationRequests(ctx) {
  // A requisition about money received from a scam victim: answered, then investigated.
  const victimPaid = c => activeRetail(ctx)(c) && incomingTransfers(ctx, c).length >= 2;
  const police = draw(ctx, victimPaid);
  if (police) policeRequisition(ctx, police);
  // Tracfin follows up a SAR it received.
  const sar = ctx.rows.investigations.find(
    i => i.decision === 'SAR_FILED' && ago(toDate(i.decided_at)) > 20,
  );

  if (sar) {
    const received = past(daysAfter(toDate(sar.decided_at), between(10, 20)));
    const answered = past(at(received, between(24, 96)));
    const row = authorityRow(ctx, ctx.customers.get(sar.customer_id), {
      requester_type: 'FIU',
      requester_name: 'Tracfin (droit de communication)',
      received_at: iso(received),
      response_due: isoDate(daysAfter(received, 15)),
      answered_at: iso(answered),
      status: 'CLOSED',
    });
    authorityHistory(ctx, row, {
      progress: at(received, 2),
      answered,
      answeredWhy: 'Statements and KYC file sent',
      closed: past(at(answered, 24)),
    });
  }

  // Just in: a gendarmerie requisition waiting in the inbox.
  const fresh = draw(ctx, activeRetail(ctx));
  if (!fresh) return;
  const received = past(at(NOW, -between(1, 6)));
  const row = authorityRow(ctx, fresh, {
    requester_type: 'POLICE',
    requester_name: 'Gendarmerie nationale, brigade de recherches',
    received_at: iso(received),
    response_due: isoDate(daysAfter(received, 10)),
    assigned_to: null,
  });
  authorityHistory(ctx, row, {});
}

// ---- insolvency ---------------------------------------------------------------------------------

// Since 2025, twelve commercial courts are economic activity courts (TAE), as an experiment.
const TAE = ['Paris', 'Lyon', 'Marseille', 'Nanterre', 'Versailles', 'Le Mans', 'Limoges'];
const courtOf = city =>
  TAE.includes(city)
    ? `Tribunal des activités économiques de ${city}`
    : `Tribunal de commerce de ${city}`;

function proceedingRow(ctx, customer, fields) {
  const business = customer.business_id && ctx.businesses.get(customer.business_id);
  const person = business ? null : ctx.holderOf(customer);
  const { judgment } = fields;
  delete fields.judgment;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    business_id: business?.id || null,
    individual_id: person?.id || null,
    type: 'LIQUIDATION',
    court: business ? courtOf(business.city) : null,
    judgment_date: isoDate(judgment),
    practitioner_name: null,
    claims_deadline: isoDate(daysAfter(addMonths(judgment, 2), 15)),
    bank_claim_amount: null,
    claim_filed_at: null,
    status: 'OPENED',
    court_case_number: `${judgment.getUTCFullYear()}J${String(between(100, 2400)).padStart(
      5,
      '0',
    )}`,
    practitioner_email: null,
    closed_at: null,
    ...fields,
  };
  ctx.rows.insolvency_proceedings.push(row);

  return row;
}

function proceedingHistory(ctx, row, dates) {
  const by = op('legal');
  const steps = [['OPENED', dates.opened, by, dates.openedWhy]];
  if (dates.frozen) steps.push(['ACCOUNTS_FROZEN', dates.frozen, by]);
  if (row.claim_filed_at) steps.push(['CLAIM_FILED', toDate(row.claim_filed_at), by]);
  if (dates.handed) steps.push(['BALANCE_HANDED_OVER', dates.handed, by]);
  if (row.closed_at) steps.push(['CLOSED', toDate(row.closed_at), by]);
  trail(ctx.rows, 'INSOLVENCY_PROCEEDINGS', row, steps);
}

/** A collection case stops: the law suspends individual recovery during the proceeding. */
function pauseCollection(ctx, loan, row, why) {
  const col = ctx.rows.collection_cases.find(c => c.loan_id === loan.id && c.status !== 'CLOSED');
  if (!col) return;
  Object.assign(col, { status: 'PAUSED', insolvency_proceeding_id: row.id, next_action_at: null });
  addStatus(
    ctx,
    'COLLECTION_CASES',
    col,
    'PAUSED',
    toDate(row.claim_filed_at),
    col.assigned_to,
    why,
  );
}

/** What the bank is owed on a loan: the capital left and the interest missed. */
function claimOn(ctx, loan) {
  const missed = ctx.rows.repayments
    .filter(r => r.loan_id === loan.id && r.status === 'MISSED')
    .reduce((s, r) => s + Number(r.interest_part), 0);

  return round2(Number(loan.outstanding_balance) + missed);
}

/** A defaulted borrower under a proceeding: the bank files its claim, collections pause. */
function proceedingOnLoan(ctx, loan, fields, why) {
  const customer = ctx.customers.get(loan.customer_id);
  const col = ctx.rows.collection_cases.find(c => c.loan_id === loan.id);
  const earliest = col ? daysAfter(toDate(col.opened_at), 7) : daysAfter(NOW, -60);
  const judgment = withTime(
    new Date(Math.max(earliest.getTime(), daysAfter(NOW, -between(25, 40)).getTime())),
  );
  const opened = past(at(judgment, between(24, 72)));
  const row = proceedingRow(ctx, customer, {
    judgment,
    bank_claim_amount: claimOn(ctx, loan),
    claim_filed_at: iso(past(at(opened, between(3, 8) * 24))),
    status: 'CLAIM_FILED',
    ...fields,
  });
  proceedingHistory(ctx, row, { opened, openedWhy: fields.openedWhy });
  delete row.openedWhy;
  pauseCollection(ctx, loan, row, why);

  return row;
}

/** A company liquidated before: balance handed to the liquidator, accounts closed. */
function pastLiquidation(ctx, customer, payout) {
  const liquidator = 'SELARL Tessier & Associés, mandataires judiciaires';
  if (!relabel(ctx, payout, liquidator, 'Liquidateur judiciaire', true)) return null;
  const closed = toDate(payout.tx.booked_at);
  const judgment = withTime(daysAfter(closed, -between(45, 70)));
  const opened = at(judgment, between(24, 72));
  const row = proceedingRow(ctx, customer, {
    judgment,
    practitioner_name: liquidator,
    practitioner_email: 'liquidations@tessier-mj.fr',
    status: 'CLOSED',
    closed_at: iso(at(closed, 24)),
  });
  proceedingHistory(ctx, row, {
    opened,
    openedWhy: 'Letter from the liquidator',
    frozen: at(opened, 2),
    handed: closed,
  });
  const account = accountsOf(ctx, customer).find(a => a.id === payout.tx.account_id);
  holdRow(ctx, account, {
    reason: 'INSOLVENCY',
    insolvency_proceeding_id: row.id,
    amount: Number(payout.tx.amount),
    placed_by: op('legal'),
    placed_at: iso(at(opened, 2)),
    status: 'RELEASED',
    released_at: iso(closed),
    released_by: op('legal'),
    release_reason: 'Balance handed over to the liquidator',
  });
  const requested = at(opened, 4);
  closure(ctx, customer, {
    initiated: 'BANK',
    reason: 'INSOLVENCY',
    insolvency: row,
    status: 'CLOSED',
    approver: op('legal'),
    balance: Number(payout.tx.amount),
    payout,
    dates: { requested, approved: at(requested, 24), payout: at(requested, 25), closed },
    why: 'Judicial liquidation',
  });

  return row;
}

/** A company liquidated a few days ago: the balance is held for the liquidator. */
function newLiquidation(ctx) {
  const judgment = withTime(daysAfter(NOW, -between(2, 4)));
  const opened = past(at(judgment, between(20, 30)));
  const placed = past(at(opened, 2));
  const funded = c =>
    activeBusiness(ctx)(c) &&
    openedBefore(mainAccount(ctx, c), placed) &&
    roomOn(ctx, mainAccount(ctx, c), placed) > 1000;
  const customer = draw(ctx, funded);
  if (!customer) return null;
  const account = mainAccount(ctx, customer);
  const row = proceedingRow(ctx, customer, {
    judgment,
    practitioner_name: 'SELAS Lecomte, mandataire judiciaire',
    practitioner_email: 'contact@lecomte-mj.fr',
    status: 'ACCOUNTS_FROZEN',
  });
  proceedingHistory(ctx, row, { opened, openedWhy: 'Letter from the liquidator', frozen: placed });
  // Card payments authorised but not booked yet are spoken for: the hold takes what is left.
  holdRow(ctx, account, {
    reason: 'INSOLVENCY',
    insolvency_proceeding_id: row.id,
    amount: round2(
      Math.max(0, Math.min(roomOn(ctx, account, placed), Number(account.available_balance))),
    ),
    placed_by: op('legal'),
    placed_at: iso(placed),
  });

  return row;
}

function insolvencies(ctx, oldBusiness) {
  const made: Record<string, any> = {
    past: oldBusiness && pastLiquidation(ctx, oldBusiness[0], oldBusiness[1]),
  };
  made.fresh = newLiquidation(ctx);
  const defaulted = ctx.rows.loans.filter(l => l.status === 'DEFAULT');
  const company = defaulted.find(
    l => ctx.customers.get(l.customer_id).customer_type === 'BUSINESS',
  );

  if (company) {
    made.receivership = proceedingOnLoan(
      ctx,
      company,
      {
        type: 'RECEIVERSHIP',
        practitioner_name: 'SCP Besson-Mallet, administrateurs judiciaires',
        practitioner_email: 'contact@besson-mallet-aj.fr',
        openedWhy: 'Letter from the court-appointed administrator',
      },
      'Receivership: individual recovery suspended, claim filed',
    );
  }

  // Over-indebtedness: a defaulted personal loan, or else one already late.
  const retail = l => ctx.customers.get(l.customer_id).customer_type === 'RETAIL';
  const person =
    defaulted.find(retail) || ctx.rows.loans.filter(l => l.status === 'LATE').find(retail);

  if (person) {
    const holder = ctx.holderOf(ctx.customers.get(person.customer_id));
    const row = proceedingOnLoan(
      ctx,
      person,
      {
        type: 'PERSONAL_DEBT_RESTRUCTURING',
        court: `Commission de surendettement, Banque de France (${holder.city})`,
        openedWhy: 'Notice from the commission: case admissible',
      },
      'Over-indebtedness case admissible: recovery suspended',
    );
    row.claims_deadline = isoDate(daysAfter(toDate(`${row.judgment_date}T12:00:00Z`), 30));
    row.court_case_number = `SUR-${row.judgment_date.slice(0, 4)}-${between(10000, 99999)}`;
  }

  return made;
}

// ---- business events ----------------------------------------------------------------------------

function eventRow(ctx, customer, fields) {
  const { detected } = fields;
  delete fields.detected;
  const row = {
    id: uuid(),
    reference: null,
    business_id: customer.business_id,
    kyc_case_id: null,
    type: 'DIRECTOR_CHANGE',
    source: 'COMPANY_REGISTER',
    effective_date: isoDate(daysAfter(detected, -between(8, 20))),
    detected_at: iso(detected),
    details: null,
    status: 'NEW',
    register_reference: `BODACC B n°${detected.getUTCFullYear()}0${between(
      100,
      250,
    )}, annonce ${between(100, 3000)}`,
    assigned_to: null,
    dismiss_reason: null,
    ...fields,
  };
  if (row.source !== 'COMPANY_REGISTER') row.register_reference = null;
  ctx.rows.business_events.push(row);
  const steps = [['NEW', detected, 'system']];

  if (row.status !== 'NEW') {
    steps.push([
      row.status,
      past(at(detected, between(4, 48))),
      row.assigned_to,
      row.dismiss_reason,
    ]);
  }

  trail(ctx.rows, 'BUSINESS_EVENTS', row, steps);

  return row;
}

function directorOf(ctx, customer) {
  const member = ctx.rows.business_members.find(
    m => m.business_id === customer.business_id && m.individual_id && m.role === 'DIRECTOR',
  );

  return member && ctx.people.get(member.individual_id);
}

/** A KYB event review opened by an ownership change; the new owners' papers are asked. */
function eventReview(ctx, customer, event, status) {
  const opened = past(at(toDate(event.detected_at), between(4, 24)));
  const kyc = {
    id: uuid(),
    customer_id: customer.id,
    reference: null,
    type: 'EVENT_REVIEW',
    trigger: 'OWNERSHIP_CHANGE',
    channel: customer.onboarding_channel,
    status,
    opened_at: iso(opened),
    due_at: iso(daysAfter(opened, 30)),
    assigned_to: event.assigned_to,
    decided_by: null,
    resolved_at: null,
    escalated_at: null,
    escalation_reason: null,
    rejection_reason: null,
    risk_before: customer.risk_rating,
    risk_after: null,
    investigation_id: null,
    notes: 'New shareholder above 25% in the company register: identify the beneficial owners.',
    updated_at: iso(opened),
  };
  ctx.rows.kyc_cases.push(kyc);
  event.kyc_case_id = kyc.id;
  const steps = [['OPEN', opened, 'system', 'Ownership change in the company register']];

  if (status === 'IN_REVIEW') {
    const review = past(at(opened, between(2, 20)));
    steps.push(['IN_REVIEW', review, kyc.assigned_to]);
    kyc.updated_at = iso(review);
    const director = directorOf(ctx, customer);
    if (director) informationRequest(ctx, kyc, director, past(at(review, 1)), 'SENT', 'BUSINESS');
  }

  trail(ctx.rows, 'KYC_CASES', kyc, steps);
}

const NEW_OWNERS = ['Holding Oréade SAS', 'Maelis Participations SAS'];

/** Register changes on our business customers: reviews, triage, dismissed. */
function registerEvents(ctx) {
  const kyb = op('onboarding');
  const plans: [string, string, number[], string?][] = [
    ['OWNERSHIP_CHANGE', 'REVIEW_OPENED', [1, 4], 'OPEN'],
    ['OWNERSHIP_CHANGE', 'REVIEW_OPENED', [10, 20], 'IN_REVIEW'],
    ['DIRECTOR_CHANGE', 'NEW', [0, 2]],
    ['ADDRESS_CHANGE', 'NEW', [0, 3]],
    ['LEGAL_FORM_CHANGE', 'NEW', [1, 5]],
    ['CAPITAL_CHANGE', 'DISMISSED', [15, 60]],
  ];
  plans.forEach(([type, status, [from, to], review], n) => {
    const fits = c =>
      activeBusiness(ctx)(c) &&
      directorOf(ctx, c) &&
      (type !== 'LEGAL_FORM_CHANGE' ||
        ['SARL', 'EURL'].includes(ctx.businesses.get(c.business_id).legal_form));
    const customer = draw(ctx, fits);
    if (!customer) return;
    const business = ctx.businesses.get(customer.business_id);
    const director = fullName(directorOf(ctx, customer));
    const details = {
      OWNERSHIP_CHANGE: `${NEW_OWNERS[n % 2]} bought 40% of the shares from ${director}.`,
      DIRECTOR_CHANGE: `${director} resigned as ${
        ['SARL', 'EURL'].includes(business.legal_form) ? 'gérant' : 'président'
      }; Bérénice Lacroix-Vernet appointed.`,
      ADDRESS_CHANGE: `Head office moved from ${business.address_line1}, ${business.postal_code} ${business.city} to 12 avenue de la Gare, ${business.postal_code} ${business.city}.`,
      LEGAL_FORM_CHANGE: `Converted from ${business.legal_form} to ${
        business.legal_form === 'EURL' ? 'SASU' : 'SAS'
      }.`,
      CAPITAL_CHANGE: 'Share capital raised from 10,000 to 50,000 EUR by the existing partners.',
    }[type];
    const event = eventRow(ctx, customer, {
      type,
      status,
      detected: past(withTime(daysAfter(NOW, -between(from, to)))),
      details,
      source: type === 'LEGAL_FORM_CHANGE' ? 'CLIENT' : 'COMPANY_REGISTER',
      assigned_to: status === 'NEW' ? null : kyb,
      dismiss_reason:
        status === 'DISMISSED'
          ? 'Capital raised by the existing partners: owners and control unchanged.'
          : null,
    });
    if (review) eventReview(ctx, customer, event, review);
  });
}

const HANDLED = 'Followed by the legal team as an insolvency proceeding.';

/** The register publishes the insolvencies the legal team already follows. */
function insolvencyEvents(ctx, made) {
  [made.past, made.receivership].filter(Boolean).forEach(row => {
    const customer = ctx.customers.get(row.customer_id);
    const judgment = toDate(`${row.judgment_date}T09:00:00Z`);
    const detected = past(withTime(daysAfter(judgment, between(12, 16))));
    eventRow(ctx, customer, {
      type: 'INSOLVENCY_OPENED',
      status: 'DISMISSED',
      detected,
      effective_date: row.judgment_date,
      details: `${
        row.type === 'LIQUIDATION' ? 'Judicial liquidation' : 'Receivership'
      } opened by the ${row.court}; ${row.practitioner_name}.`,
      register_reference: `BODACC A n°${detected.getUTCFullYear()}0${between(
        100,
        250,
      )}, annonce ${between(100, 3000)}`,
      assigned_to: op('legal'),
      dismiss_reason: HANDLED,
    });
  });
  if (!made.past) return;
  // Months later, the liquidation closes for lack of assets and the company is struck off.
  const closedAt = daysAfter(toDate(made.past.closed_at), between(120, 150));
  if (closedAt > NOW) return;
  eventRow(ctx, ctx.customers.get(made.past.customer_id), {
    type: 'DISSOLUTION',
    status: 'DISMISSED',
    detected: withTime(closedAt),
    details: 'Liquidation closed for lack of assets; company struck off the register.',
    register_reference: `BODACC A n°${closedAt.getUTCFullYear()}0${between(
      100,
      250,
    )}, annonce ${between(100, 3000)}`,
    assigned_to: op('legal'),
    dismiss_reason: 'Relationship already closed.',
  });
}

// ---- complaints and collections -------------------------------------------------------------------

function collectionComplaint(ctx, col) {
  const customer = ctx.customers.get(col.customer_id);
  const received = past(at(toDate(col.last_contact_at), between(4, 30)));
  const acknowledged = past(at(received, between(4, 40)));
  const resolved = ago(received) > 12 ? past(daysAfter(received, between(6, 12))) : null;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    individual_id: ctx.holderOf(customer)?.id || null,
    transaction_id: null,
    fee_id: null,
    chargeback_id: null,
    dispute_request_id: null,
    sepa_dispute_id: null,
    collection_case_id: col.id,
    channel: 'EMAIL',
    regulatory_deadline: isoDate(daysAfter(received, 61)),
    assigned_to: op('support'),
    acknowledged_at: iso(acknowledged),
    status: resolved ? 'RESOLVED' : 'IN_PROGRESS',
    outcome: resolved ? 'PARTIALLY_UPHELD' : null,
    compensation_amount: null,
    compensation_transaction_id: null,
    root_cause: resolved ? 'STAFF_ERROR' : null,
    resolved_at: resolved && iso(resolved),
    escalated_to: null,
    escalated_at: null,
    escalation_reference: null,
    escalation_outcome: null,
    escalation_decided_at: null,
    category: 'CREDIT',
    description:
      'I was called three times the same day about my late loan instalment, once at work. I know I owe the money, but this is harassment.',
    received_at: iso(received),
  };
  ctx.rows.complaints.push(row);
  const steps = [
    ['RECEIVED', received, 'customer'],
    ['ACKNOWLEDGED', acknowledged, row.assigned_to],
    ['IN_PROGRESS', past(at(acknowledged, 24)), row.assigned_to],
  ];

  if (resolved) {
    steps.push([
      'RESOLVED',
      resolved,
      row.assigned_to,
      'Calls above our policy: apology, one call a week from now on',
    ]);
  }

  trail(ctx.rows, 'COMPLAINTS', row, steps);
}

/** Questions about a complaint and a collection case; a complaint about collection calls. */
function collectionAndComplaints(ctx) {
  const open = c => c.status === 'IN_PROGRESS' && c.individual_id;
  // Otherwise a complaint not yet in progress: the details are asked before working on it.
  const waiting = c => ['ACKNOWLEDGED', 'RECEIVED'].includes(c.status) && c.individual_id;
  const access =
    ctx.rows.complaints.find(c => open(c) && !c.transaction_id) ||
    ctx.rows.complaints.find(open) ||
    ctx.rows.complaints.find(waiting);

  if (access) {
    const from = toDate(access.acknowledged_at || access.received_at);
    const sent = past(at(from, between(20, 30)));
    informationRequest(
      ctx,
      access,
      ctx.people.get(access.individual_id),
      sent,
      'SENT',
      'COMPLAINT_DETAILS',
      'COMPLAINT',
    );
  }

  const running = ctx.rows.collection_cases.filter(
    c => c.status === 'IN_PROGRESS' && ctx.customers.get(c.customer_id).customer_type === 'RETAIL',
  );
  // With a single case running, the same customer is asked and complains about the calls.
  const [asked, unhappy = asked] = running;

  if (asked) {
    const person = ctx.holderOf(ctx.customers.get(asked.customer_id));
    const sent = past(withTime(daysAfter(NOW, -between(2, 5))));
    informationRequest(ctx, asked, person, sent, 'SENT', 'COLLECTION_SITUATION', 'COLLECTION_CASE');
  }

  if (unhappy) collectionComplaint(ctx, unhappy);
}

// ---- QA reviews ---------------------------------------------------------------------------------

const QA_FAILS = {
  kyc_case_id: [
    'Proof of address older than three months accepted',
    'Check the date on the proof of address: under three months on the day you approve.',
  ],
  alert_id: [
    'Clearance note does not say why the payments are normal',
    'Write what you checked and why it explains the payments (payslip, known payer, invoice).',
  ],
  investigation_id: [
    'Decision not to file a SAR not justified in the file',
    'Attach the evidence behind a no-SAR decision and the MLRO’s sign-off.',
  ],
  chargeback_id: [
    'Customer evidence not attached before filing',
    'Attach the order confirmation and the messages with the merchant before filing with the network.',
  ],
  complaint_id: [
    'Answer did not mention the banking mediator',
    'Every final answer must tell the customer they can go to the banking mediator, free of charge.',
  ],
};
const NEW_OPERATORS = [mail('ines.bouaziz'), mail('camille.roux')];
const isOperator = by => typeof by === 'string' && by.includes('@');

/** Decisions a reviewer can re-check, by link: [record, who decided, when, risky]. */
function decisions(ctx) {
  const recent = when => when && ago(toDate(when)) < 150 && ago(toDate(when)) > 1;
  const risky = id => ctx.customers.get(id)?.risk_rating === 'HIGH';
  const rows = (list, by, when) =>
    list
      .filter(r => isOperator(by(r)) && recent(when(r)))
      .map(r => [r, by(r), when(r), risky(r.customer_id)]);

  return {
    kyc_case_id: rows(
      ctx.rows.kyc_cases.filter(k => ['APPROVED', 'REJECTED'].includes(k.status)),
      k => k.decided_by,
      k => k.resolved_at,
    ),
    alert_id: rows(
      ctx.rows.alerts.filter(a => a.status === 'CLEARED'),
      a => a.reviewed_by || a.assigned_to,
      a => a.resolved_at,
    ),
    investigation_id: rows(
      ctx.rows.investigations.filter(i => i.status === 'CLOSED'),
      i => i.decided_by,
      i => i.decided_at,
    ),
    chargeback_id: rows(
      ctx.rows.chargebacks.filter(c => c.decision_at),
      c => c.assigned_to,
      c => c.decision_at,
    ),
    complaint_id: rows(
      ctx.rows.complaints.filter(c => c.resolved_at),
      c => c.assigned_to,
      c => c.resolved_at,
    ),
  };
}

const sampleReason = (link, operator, risky) => {
  if (link === 'investigation_id' || risky) return 'HIGH_RISK';

  return NEW_OPERATORS.includes(operator) ? 'NEW_OPERATOR' : 'RANDOM';
};

function qaReviews(ctx) {
  const pools = decisions(ctx);
  const outcomes = ['PASSED', 'PASSED', 'FAILED', 'PASSED', 'PENDING'];
  const plan: [string, number][] = [
    ['kyc_case_id', 8],
    ['alert_id', 6],
    ['investigation_id', 4],
    ['chargeback_id', 4],
    ['complaint_id', 3],
  ];
  let n = 0;
  plan.forEach(([link, count]) => {
    const pool = pools[link].slice();

    for (let k = 0; k < count && pool.length; k += 1) {
      const [record, operator, when, risky] = pool.splice(between(0, pool.length - 1), 1)[0];
      const outcome = outcomes[n % outcomes.length];
      n += 1;
      const decided = toDate(when);
      const [criteria, coaching] = QA_FAILS[link];
      ctx.rows.qa_reviews.push({
        id: uuid(),
        kyc_case_id: null,
        alert_id: null,
        investigation_id: null,
        chargeback_id: null,
        complaint_id: null,
        [link]: record.id,
        operator_email: operator,
        reviewer_email: op('qa'),
        sample_reason: sampleReason(link, operator, risky),
        score: { PASSED: between(80, 100), FAILED: between(45, 74), PENDING: null }[outcome],
        outcome,
        reviewed_at: outcome === 'PENDING' ? null : iso(past(at(decided, between(2, 12) * 24))),
        reference: null,
        coaching_note: outcome === 'FAILED' ? coaching : null,
        failed_criteria: outcome === 'FAILED' ? criteria : null,
        sampled_at: iso(past(at(decided, 20))),
      });
    }
  });
  numberReferences(ctx.rows.qa_reviews, 'QA', 'sampled_at');
  ctx.rows.qa_reviews.forEach(r => {
    delete r.sampled_at;
  });
}

// ---- putting it together ------------------------------------------------------------------------

/** Customers who left in the past: their closing transfer becomes their closure. */
function pastClosures(ctx) {
  const left = ctx.rows.customers
    .filter(c => c.status === 'OFFBOARDED')
    .map(c => [c, closingPayout(ctx, c)])
    .filter(([, payout]) => payout)
    .sort((a, b) => (a[1].tx.booked_at < b[1].tx.booked_at ? 1 : -1));
  left.forEach(([c]) => ctx.used.add(c.id));
  const business = left.find(([c]) => c.customer_type === 'BUSINESS');
  const retail = left.filter(([c]) => c.customer_type === 'RETAIL');
  // An estate settled before the statements began (no payment after the death).
  const start = iso(daysAfter(NOW, -190));
  const estate = retail.find(([c, p]) => singleHolder(ctx, c) && p.tx.booked_at < start);
  const settled = estate && pastDeceased(ctx, estate[0], estate[1]);
  retail
    .filter(r => !(settled && r === estate))
    .slice(0, 10)
    .forEach(([c, payout]) => pastCustomerClosure(ctx, c, payout));

  return business;
}

function lifecycle(ctx) {
  WAVE_D_LIFECYCLE.forEach(t => {
    ctx.rows[t] = [];
  });
  ledger(ctx);
  ctx.used = busyCustomers(ctx);
  ctx.partyUse = new Map();
  ctx.rows.transactions.forEach(t => {
    if (t.counterparty_id) {
      ctx.partyUse.set(t.counterparty_id, (ctx.partyUse.get(t.counterparty_id) || 0) + 1);
    }
  });
  const lastOwn = lastOwnPayment(ctx);
  const oldBusiness = pastClosures(ctx);
  eckertDeceased(ctx, lastOwn);
  newDeceased(ctx, lastOwn);
  jointDeceased(ctx, lastOwn);
  riskExit(ctx);
  fraudExit(ctx);
  dormancyClosures(ctx);
  openCustomerClosures(ctx);
  garnishedAccounts(ctx);
  otherSeizures(ctx);
  informationRequests(ctx);
  const made = insolvencies(ctx, oldBusiness);
  registerEvents(ctx);
  insolvencyEvents(ctx, made);
  collectionAndComplaints(ctx);
  qaReviews(ctx);
  delete ctx.used;
  delete ctx.partyUse;
  numberReferences(ctx.rows.closures, 'CLO', 'requested_at');
  numberReferences(ctx.rows.authority_requests, 'AUT', 'received_at');
  numberReferences(ctx.rows.business_events, 'EVT', 'detected_at');
  numberReferences(ctx.rows.insolvency_proceedings, 'INS', 'judgment_date');
  numberReferences(ctx.rows.deceased_cases, 'DEC', 'notified_at');
  // New holds and complaints join the ones of wave C, numbered again in date order.
  numberReferences(ctx.rows.holds, 'HLD', 'placed_at');
  // The reference draws of the recall holds no longer placed (disputes.ts, holdNoMore).
  for (let k = 0; k < (ctx.holdsNoMore || 0); k += 1) between(1, 9);
  numberReferences(ctx.rows.complaints, 'CMP', 'received_at');
}

// eslint-disable-next-line import/prefer-default-export
export { lifecycle };
