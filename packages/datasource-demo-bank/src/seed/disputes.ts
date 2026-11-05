/**
 * Wave C: disputes, the money holds they create, and complaints. Written once statements and
 * financial crime exist, so every case starts from a real payment of a real customer.
 *
 * - Dispute requests: "I want my money back", routed to a chargeback (cards), a SEPA dispute
 *   (transfers and direct debits), back to the merchant, or declined. The customers who reported
 *   card payments in wave B and the tested cards get theirs.
 * - Chargebacks follow the card networks' rounds (filed, the merchant answers, pre-arbitration,
 *   decision), with the provisional credit the law requires for unauthorised payments.
 * - SEPA disputes: direct debit refunds, recalls of our customers' mistaken transfers and of the
 *   takeover transfer, and the recalls other banks send us: fraud recalls on the mules' incoming
 *   payments (the money is gone, so they are refused) and payments sent to our customers by
 *   mistake, returned once the customer agrees.
 * - Holds on the money a recall or an investigation is about.
 * - One open case per path of the guided disputes workflows (intake, chargeback, merchant
 *   answered), on a payment written for it, so the same customers come back on every build.
 * - Complaints, often about a fee, a dispute or a fraud, with their legal deadline.
 *
 * Every movement these cases cause (provisional credits, refunds, money sent back) is booked on
 * the account's statement, and the running balance is written again line by line. Each one is
 * listed with its role in dispute_transactions, next to the payment the case is about.
 */
import { createHash } from 'crypto';

import { digits, toDate, transactionRow } from './banking';
import {
  NOW,
  alert,
  at,
  earlier,
  informationRequest,
  investigation,
  later,
  numberReferences,
  op,
  past,
  screeningHit,
  trail,
  watchEntry,
} from './crime';
import { businessDays, ledger, post, rebalance, spendable } from './ledger';
import {
  DAY,
  TODAY,
  between,
  chance,
  daysAgo,
  iso,
  isoDate,
  pick,
  round2,
  uuid,
  weighted,
  withStream,
  withTime,
} from './random';
import { OTHER_BANKS, otherBankAccount } from './reference';

const WAVE_C = [
  'dispute_requests',
  'chargebacks',
  'sepa_disputes',
  'dispute_transactions',
  'holds',
  'complaints',
];

const ago = date => (NOW.getTime() - date) / DAY;

/** Money on an account that cannot be spent, with its history; the balances follow. */
function hold(ctx, account, fields) {
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

/** A movement of a case, kept to list it with its role once every case exists. */
function move(ctx, tx, role, links) {
  ctx.moves.push({ tx, role, ...links });
}

// ---- indexes -------------------------------------------------------------------------------------

function indexes(ctx) {
  const { rows } = ctx;
  const byTx = table => new Map(rows[table].map(r => [r.transaction_id, r]));
  ctx.txById = new Map(rows.transactions.map(t => [t.id, t]));
  ctx.cardOf = byTx('card_transactions');
  ctx.debitOf = byTx('direct_debits');
  ctx.outOf = byTx('outgoing_transfers');
  ctx.inOf = byTx('incoming_transfers');
  ctx.cards = new Map(rows.cards.map(c => [c.id, c]));
  ctx.parties = new Map(rows.counterparties.map(c => [c.id, c]));
  ctx.emitters = new Map(rows.sct_emitters.map(e => [e.id, e]));
  ctx.payees = new Map(rows.sct_beneficiaries.map(b => [b.id, b]));
  ctx.mandates = new Map(rows.mandates.map(m => [m.id, m]));
  ctx.creditors = new Map(rows.sdd_creditors.map(c => [c.id, c]));
  ctx.used = new Set();
  ctx.reserved = new Set();
  ctx.moves = [];
  ctx.tickets = new Map();
  ctx.story = new Set(
    ctx.stories ? [...ctx.stories.values()].flatMap(s => s.lines.map(l => l.tx.id)) : [],
  );
}

const customerOf = (ctx, tx) => ctx.customers.get(ctx.accounts.get(tx.account_id).customer_id);

/**
 * Booked payments of active retail customers, not part of a story, not disputed yet, and not of a
 * customer kept for the guided workflows' cases (guidedCases).
 */
function candidates(ctx, rail, keep) {
  return ctx.rows.transactions.filter(tx => {
    if (tx.rail !== rail || tx.status !== 'BOOKED' || ctx.used.has(tx.id) || ctx.story.has(tx.id)) {
      return false;
    }

    const account = ctx.accounts.get(tx.account_id);
    const customer = ctx.customers.get(account.customer_id);

    return (
      account.status === 'ACTIVE' &&
      customer.status === 'ACTIVE' &&
      customer.customer_type === 'RETAIL' &&
      !ctx.reserved.has(customer.id) &&
      keep(tx)
    );
  });
}

// ---- dispute requests ----------------------------------------------------------------------------

const DETAILS = {
  UNAUTHORIZED: [
    'I did not make this payment, my card never left my wallet.',
    'I do not recognise this online purchase.',
  ],
  DUPLICATE_CHARGE: ['I was charged twice for the same order.', 'The same amount was taken twice.'],
  CANCELLED_ORDER: [
    'I cancelled the order within the 14 days and was never refunded.',
    'I cancelled my booking but the merchant kept the money.',
  ],
  ITEM_NOT_RECEIVED: [
    'Ordered five weeks ago, never delivered, the seller no longer answers.',
    'The parcel never arrived.',
  ],
  SERVICE_NOT_RENDERED: [
    'The event was cancelled and I was not refunded.',
    'I paid for a service that was never provided.',
  ],
  CANCELLED_RECURRING: [
    'I cancelled this subscription but I am still charged.',
    'I cancelled my membership and was charged again the next month.',
  ],
  WRONG_AMOUNT: ['The amount charged is higher than the price I agreed.'],
  WRONG_BENEFICIARY: ['I made a typo in the IBAN, the money went to someone else.'],
  SCAM: ['Someone took control of my account and sent this transfer.'],
};

/** What kind of payment a dispute is about, from its statement line. */
function paymentType(ctx, tx) {
  if (tx.rail !== 'TRANSFER') return tx.rail;

  return ctx.outOf.get(tx.id)?.scheme === 'SEPA_INSTANT' ? 'INSTANT_TRANSFER' : 'TRANSFER';
}

// In the app or on the website the customer files it; on the phone or by email, support logs it
// from the ticket.
const SELF_SERVICE = ['APP', 'WEB'];

function disputeRequest(ctx, tx, fields) {
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customerOf(ctx, tx).id,
    transaction_id: tx.id,
    payment_type: paymentType(ctx, tx),
    card_transaction_id: ctx.cardOf.get(tx.id)?.id || null,
    direct_debit_id: ctx.debitOf.get(tx.id)?.id || null,
    outgoing_transfer_id: ctx.outOf.get(tx.id)?.id || null,
    investigation_id: null,
    alert_id: null,
    bdf_notified_at: null,
    amount: tx.amount,
    currency: 'EUR',
    reason_detail: pick(DETAILS[fields.reason] || DETAILS.WRONG_AMOUNT),
    status: 'NEW',
    route: null,
    channel: weighted([
      ['APP', 60],
      ['PHONE', 25],
      ['WEB', 10],
      ['EMAIL', 5],
    ]),
    merchant_contacted_at: null,
    assigned_to: null,
    routed_at: null,
    closed_at: null,
    resolution_notes: null,
    ...fields,
  };
  const self = SELF_SERVICE.includes(row.channel);
  Object.assign(row, {
    created_at: row.requested_at,
    created_by: self ? 'customer' : op('support'),
    support_ticket_ref: self ? null : `TCK-${digits(7)}`,
  });
  ctx.used.add(tx.id);
  ctx.rows.dispute_requests.push(row);

  return row;
}

const DESK = { CHARGEBACK: 'Card disputes desk', SEPA_DISPUTE: 'Payments desk' };

/** Routed by the disputes desk a few hours after it came in. */
function route(dispute, to, by) {
  const routed = past(at(toDate(dispute.requested_at), between(2, 30)));
  Object.assign(dispute, {
    status: ['CHARGEBACK', 'SEPA_DISPUTE'].includes(to) ? 'ROUTED' : 'CLOSED',
    route: to,
    assigned_to: dispute.assigned_to || by,
    routed_at: iso(routed),
  });

  return routed;
}

function closeDispute(dispute, date, notes) {
  Object.assign(dispute, { status: 'CLOSED', closed_at: iso(date), resolution_notes: notes });
}

function disputeHistory(ctx, dispute, asked?) {
  const steps = [['NEW', toDate(dispute.requested_at), dispute.created_by, dispute.reason]];

  if (asked) {
    const why = 'Details asked from the customer';
    steps.push(['WAITING_CUSTOMER', toDate(asked.sent_at), dispute.assigned_to, why]);
  }

  if (dispute.bdf_notified_at) {
    const why = 'Refund refused while we check; reasons sent to the Banque de France';
    steps.push(['UNDER_INVESTIGATION', toDate(dispute.bdf_notified_at), dispute.assigned_to, why]);
  }

  if (dispute.status === 'ROUTED' || (dispute.closed_at && DESK[dispute.route])) {
    steps.push(['ROUTED', toDate(dispute.routed_at), dispute.assigned_to, dispute.route]);
  }

  if (dispute.closed_at) {
    steps.push([
      'CLOSED',
      toDate(dispute.closed_at),
      dispute.assigned_to,
      dispute.resolution_notes,
    ]);
  }

  trail(ctx.rows, 'DISPUTE_REQUESTS', dispute, steps);
}

// ---- chargebacks ---------------------------------------------------------------------------------

// [Visa code, Visa label, Mastercard code, Mastercard label]
const REASON_CODES = {
  UNAUTHORIZED: [
    '10.4',
    'Other Fraud – Card-Absent Environment',
    '4837',
    'No Cardholder Authorization',
  ],
  DUPLICATE_CHARGE: ['12.6.1', 'Duplicate Processing', '4834', 'Point-of-Interaction Error'],
  CANCELLED_ORDER: ['13.7', 'Cancelled Merchandise/Services', '4853', 'Cardholder Dispute'],
  // A subscription charged after the customer cancelled it: its own Visa code, Mastercard's 4853.
  CANCELLED_RECURRING: ['13.2', 'Cancelled Recurring Transaction', '4853', 'Cardholder Dispute'],
  ITEM_NOT_RECEIVED: [
    '13.1',
    'Merchandise/Services Not Received',
    '4855',
    'Goods or Services Not Provided',
  ],
  SERVICE_NOT_RENDERED: [
    '13.1',
    'Merchandise/Services Not Received',
    '4855',
    'Goods or Services Not Provided',
  ],
  WRONG_AMOUNT: ['12.5', 'Incorrect Amount', '4834', 'Point-of-Interaction Error'],
};
const REPRESENTMENTS = {
  UNAUTHORIZED: 'Payment authenticated with 3-D Secure by the cardholder',
  DUPLICATE_CHARGE: 'Two separate orders, invoices attached',
  CANCELLED_ORDER: 'Cancellation received after the deadline of the terms of sale',
  CANCELLED_RECURRING: 'Cancellation received after the billing date of the period charged',
  ITEM_NOT_RECEIVED: 'Proof of delivery signed at the customer’s address',
  SERVICE_NOT_RENDERED: 'Service delivered, usage logs attached',
  WRONG_AMOUNT: 'Amount matches the price the cardholder accepted at checkout',
};

/** Where the case is, from how long ago it was filed. */
function chargebackStage(days, fraud) {
  if (days < 4) return 'INITIATED';
  if (days < 18) return 'PRESENTED';
  if (fraud) return 'WON';
  if (days < 40) return pick(['PRESENTED', 'REPRESENTED', 'REPRESENTED']);
  if (days < 60) return pick(['REPRESENTED', 'PRE_ARBITRATION', 'WON']);

  return weighted([
    ['WON', 60],
    ['LOST', 25],
    ['WITHDRAWN', 15],
  ]);
}

const FINAL = ['WON', 'LOST', 'WITHDRAWN'];
const AFTER_PRESENTMENT = ['PRESENTED', 'REPRESENTED', 'PRE_ARBITRATION', ...FINAL];

function provisionalCredit(ctx, cb, account, date, merchant) {
  const fraud = REASON_CODES.UNAUTHORIZED.includes(cb.reason_code);
  const label = fraud ? 'REMBOURSEMENT OPERATION NON AUTORISEE CB' : 'CREDIT PROVISOIRE LITIGE CB';
  const tx = post(ctx, account, date, 'CREDIT', cb.amount, `${label} ${merchant}`);
  Object.assign(cb, { provisional_credit_issued: true, provisional_credit_transaction_id: tx.id });
  move(ctx, tx, 'PROVISIONAL_CREDIT', { chargeback: cb });
}

/**
 * A chargeback other than an unauthorised payment is credited only once won (French practice): the
 * refund is booked on the network's decision.
 */
function wonRefund(ctx, cb, account, date, merchant) {
  if (cb.provisional_credit_transaction_id) return;
  const tx = post(ctx, account, date, 'CREDIT', cb.amount, `REMBOURSEMENT LITIGE CB ${merchant}`);
  move(ctx, tx, 'REFUND', { chargeback: cb });
}

/** Dates of each round, from filing to the decision. */
function chargebackRounds(filed, status, fraud) {
  const days: Record<string, any> = { filed: 0 };
  if (AFTER_PRESENTMENT.includes(status)) days.presented = between(1, 3);
  // A won case: the merchant's bank either did not contest, or contested and lost.
  const fought =
    ['REPRESENTED', 'PRE_ARBITRATION', 'LOST'].includes(status) ||
    (status === 'WON' && chance(0.5));
  if (fought && !fraud) days.represented = between(12, 25);

  if (status === 'PRE_ARBITRATION' || (status === 'WON' && days.represented)) {
    days.preArbitration = days.represented + between(5, 10);
  }

  // Pre-arbitration closes 60 to 90 days after the filing; other cases a week or so after the last round.
  if (FINAL.includes(status)) {
    days.decision = days.preArbitration
      ? between(60, 90)
      : (days.represented || 3) + between(6, 20);
  }

  return Object.fromEntries(
    Object.entries(days).map(([k, d]) => [k, past(new Date(filed.getTime() + d * DAY))]),
  );
}

/**
 * The next date that counts on an open case: 120 days to file, then each side's time to answer
 * (Visa 30 days, Mastercard 45). A closed case has none.
 */
function deadline(cb, tx, rounds) {
  const round = cb.network === 'MASTERCARD' ? 45 : 30;
  let due = new Date(toDate(tx.created_at).getTime() + 120 * DAY);
  if (rounds.presented) due = new Date(rounds.presented.getTime() + round * DAY);
  if (rounds.represented) due = new Date(rounds.represented.getTime() + round * DAY);
  const open = !FINAL.includes(cb.status);
  cb.representment_deadline = open ? iso(withTime(due)) : null;
  cb.days_to_deadline = open ? Math.ceil((due.getTime() - NOW.getTime()) / DAY) : null;
  cb.is_overdue = open && due < NOW;
}

function chargebackHistory(ctx, cb, rounds) {
  const by = cb.assigned_to;
  const steps = [['INITIATED', toDate(cb.created_at), cb.dispute_request_id ? by : 'system']];
  if (rounds.presented) steps.push(['PRESENTED', rounds.presented, by, `Filed with ${cb.network}`]);

  if (rounds.represented) {
    steps.push(['REPRESENTED', rounds.represented, 'network', cb.representment_reason]);
  }

  if (rounds.preArbitration) steps.push(['PRE_ARBITRATION', rounds.preArbitration, by]);
  if (rounds.decision) steps.push([cb.status, rounds.decision, 'network', cb.resolution_notes]);
  trail(ctx.rows, 'CHARGEBACKS', cb, steps);
}

/**
 * A new chargeback needs the cardholder's word (and their messages with the merchant): asked, or
 * already answered when `answered`.
 */
function cardholderQuestion(ctx, cb, account, filed, answered) {
  const person = ctx.holderOf(ctx.customers.get(account.customer_id));
  if (!person) return null;
  const sent = past(at(filed, 3));
  let status = NOW.getTime() - sent > 7 * DAY ? 'OVERDUE' : 'SENT';
  if (answered) status = 'ANSWERED';
  const topic = ['10.3', '10.4', '4837'].includes(cb.reason_code)
    ? 'CHARGEBACK_FRAUD'
    : 'CHARGEBACK_EVIDENCE';
  const rfi = informationRequest(ctx, cb, person, sent, status, topic, 'CHARGEBACK');
  // Shown on the customer's dispute request too.
  rfi.dispute_request_id = cb.dispute_request_id;

  return rfi;
}

/**
 * Asked and not answered yet: the chargeback waits on the cardholder, out of the work queue. Its
 * history line takes an id from the chargeback's, so no random draw moves the data after it.
 */
function waitOnCardholder(ctx, cb, asked) {
  const h = createHash('md5').update(`${cb.id}:waiting`).digest('hex');
  const when = earlier(
    later(toDate(asked.sent_at), at(toDate(cb.created_at), 0.01)),
    new Date(NOW.getTime() - 60000),
  );
  cb.status = 'WAITING_CARDHOLDER';
  ctx.rows.status_changes.push({
    id: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
      20,
      32,
    )}`,
    record_type: 'CHARGEBACKS',
    record_id: cb.id,
    field: 'status',
    old_value: 'INITIATED',
    new_value: 'WAITING_CARDHOLDER',
    changed_by: cb.assigned_to,
    changed_at: iso(when),
    reason: 'Questions sent to the cardholder',
  });
}

/** A new chargeback asks the cardholder; until they answer, it waits on them. */
function askCardholder(ctx, cb, account, filed, answered) {
  const asked = cardholderQuestion(ctx, cb, account, filed, answered);
  if (asked && asked.status !== 'ANSWERED') waitOnCardholder(ctx, cb, asked);
}

/** The dates and answers of each round on the chargeback row. */
function applyRounds(ctx, cb, rounds, reason) {
  if (rounds.presented) {
    Object.assign(cb, {
      filed_at: iso(rounds.presented),
      evidence_submitted_at: iso(at(rounds.presented, -2)),
    });
  }

  if (rounds.represented) {
    cb.representment_received_at = iso(rounds.represented);
    cb.representment_reason = REPRESENTMENTS[reason];
  }

  if (rounds.preArbitration) cb.pre_arbitration_filed_at = iso(rounds.preArbitration);

  if (rounds.decision) {
    cb.decision_at = iso(rounds.decision);
    cb.resolution_notes = {
      WON: rounds.represented
        ? 'The merchant answered, the network ruled for the cardholder: the customer is credited.'
        : 'The merchant’s bank did not contest: the customer is credited.',
      LOST: `The merchant proved its case (${REPRESENTMENTS[reason].toLowerCase()}): ${
        reason === 'UNAUTHORIZED'
          ? 'the refund stays with the customer, the loss is the bank’s.'
          : 'nothing is credited to the customer.'
      }`,
      WITHDRAWN:
        'Withdrawn: the order finally arrived and the customer dropped the claim; nothing was credited.',
    }[cb.status];
  }
}

/** The network's reason code and label. */
function reasonCode(network, reason) {
  const [visa, visaLabel, mc, mcLabel] = REASON_CODES[reason];

  return network === 'VISA' ? [visa, visaLabel] : [mc, mcLabel];
}

/**
 * Whether a fraud claim can go to the card network: only when the liability stayed with the
 * merchant, an online payment without 3-D Secure. After 3-D Secure, chip or contactless the bank
 * refunds the customer and bears the loss.
 */
function chargeable(ctx, tx) {
  const card = ctx.cardOf.get(tx.id);

  return card?.entry_mode === 'ONLINE' && !card.is_3ds;
}

/**
 * The money of a chargeback. The law (PSD2): an unauthorised payment is refunded by the end of the
 * next business day, and the refund stays whatever the network decides (the loss is the bank's).
 * Other disputes (French practice): nothing is credited until the chargeback is won.
 */
function chargebackMoney(ctx, cb, { account, tx, fraud, requested, rounds, merchant }) {
  if (fraud) {
    const due = later(businessDays(requested, 1), at(toDate(tx.booked_at || tx.created_at), 0.5));
    provisionalCredit(ctx, cb, account, past(due), merchant);

    return;
  }

  if (cb.status === 'WON') wonRefund(ctx, cb, account, rounds.decision, merchant);
}

/**
 * A chargeback on a card payment. `filedFrom`: filed once a check ends, not right after routing;
 * `quiet`: no question to the cardholder (an investigation asks instead); `answered`: the
 * cardholder answered the question already.
 */
function chargeback(ctx, tx, dispute, options) {
  const { fraud, source, requested, stage, alertId, filedFrom, quiet, answered } = options;
  const account = ctx.accounts.get(tx.account_id);
  const { network } = ctx.cards.get(ctx.cardOf.get(tx.id).card_id);
  const merchant = ctx.parties.get(tx.counterparty_id)?.name?.toUpperCase() || 'MARCHAND';
  const reason = fraud ? 'UNAUTHORIZED' : dispute.reason;
  const [code, label] = reasonCode(network, reason);
  const from = filedFrom || (dispute ? toDate(dispute.routed_at) : requested);
  const filed = past(at(from, between(2, 20)));
  const status = stage || chargebackStage(ago(filed), fraud);
  const cb: Record<string, any> = {
    id: uuid(),
    reference: null,
    customer_id: customerOf(ctx, tx).id,
    transaction_id: tx.id,
    card_transaction_id: ctx.cardOf.get(tx.id).id,
    dispute_request_id: dispute?.id || null,
    alert_id: alertId || null,
    network,
    source,
    reason_code: code,
    reason_description: label,
    amount: tx.amount,
    currency: 'EUR',
    status,
    assigned_to: dispute?.assigned_to || op('disputes'),
    processor_dispute_id: `${network === 'VISA' ? 'VROL' : 'MCOM'}-${digits(10)}`,
    created_at: iso(filed),
    filed_at: null,
    evidence_submitted_at: null,
    representment_received_at: null,
    representment_reason: null,
    pre_arbitration_filed_at: null,
    decision_at: null,
    provisional_credit_issued: false,
    provisional_credit_transaction_id: null,
    provisional_credit_reversed_at: null,
    resolution_notes: null,
  };
  const rounds = chargebackRounds(filed, status, fraud);
  applyRounds(ctx, cb, rounds, reason);
  chargebackMoney(ctx, cb, { account, tx, fraud, requested, rounds, merchant });
  deadline(cb, tx, rounds);
  cb.updated_at = iso(
    [rounds.decision, rounds.preArbitration, rounds.represented, rounds.presented, filed].find(
      Boolean,
    ),
  );
  ctx.rows.chargebacks.push(cb);
  chargebackHistory(ctx, cb, rounds);
  if (status === 'INITIATED' && !quiet) askCardholder(ctx, cb, account, filed, answered);

  return cb;
}

// ---- card disputes -------------------------------------------------------------------------------

const ONLINE_SHOPS = ['SHOPPING', 'BILLS', 'TRANSPORT', 'RESTAURANTS'];

// What can go wrong depends on what the merchant sells: a parcel, a trip, a subscription, a meal.
const MERCHANT_KIND = {
  GOODS: ['Amazon', 'Fnac', 'Zara', 'Decathlon', 'IKEA', 'Sephora', 'El Corte Inglés'],
  TRAVEL: ['Air France', 'SNCF Connect'],
  DELIVERY: ['Uber Eats', 'Deliveroo'],
  SUBSCRIPTION: ['Netflix', 'Spotify', 'Apple', 'OVHcloud', 'Google Workspace'],
  RIDE: ['Uber'],
};
const kindOf = name =>
  Object.keys(MERCHANT_KIND).find(kind => MERCHANT_KIND[kind].includes(name)) || 'IN_PERSON';
// [kind, reason, what the customer writes]; {m} is the merchant.
const CARD_TEXTS = [
  ['GOODS', 'ITEM_NOT_RECEIVED', 'Ordered on {m}, never delivered, and they no longer answer.'],
  [
    'GOODS',
    'CANCELLED_ORDER',
    'I sent the item back to {m} within the 14 days and was never refunded.',
  ],
  ['GOODS', 'DUPLICATE_CHARGE', '{m} charged me twice for the same order.'],
  ['GOODS', 'WRONG_AMOUNT', '{m} charged more than the price shown at checkout.'],
  ['TRAVEL', 'SERVICE_NOT_RENDERED', 'My trip was cancelled by {m} and I was never refunded.'],
  [
    'TRAVEL',
    'CANCELLED_ORDER',
    'I cancelled my booking with {m} within the free cancellation period.',
  ],
  ['TRAVEL', 'DUPLICATE_CHARGE', '{m} charged the same ticket twice.'],
  ['DELIVERY', 'ITEM_NOT_RECEIVED', 'My {m} order never arrived.'],
  ['DELIVERY', 'WRONG_AMOUNT', 'Charged for dishes missing from my {m} order.'],
  ['DELIVERY', 'DUPLICATE_CHARGE', '{m} charged the same order twice.'],
  [
    'SUBSCRIPTION',
    'CANCELLED_RECURRING',
    'I cancelled my {m} subscription last month and was still charged.',
  ],
  ['SUBSCRIPTION', 'DUPLICATE_CHARGE', '{m} charged my subscription twice this month.'],
  ['RIDE', 'WRONG_AMOUNT', '{m} charged far more than the fare shown in the app.'],
  ['RIDE', 'DUPLICATE_CHARGE', '{m} charged the same ride twice.'],
  ['IN_PERSON', 'DUPLICATE_CHARGE', 'I was charged twice at {m}.'],
  ['IN_PERSON', 'WRONG_AMOUNT', 'The amount charged at {m} is higher than my receipt.'],
];

/** The reasons that make sense for this payment, with the words the customer used. */
function cardReasons(ctx, tx) {
  const name = ctx.parties.get(tx.counterparty_id)?.name || '';
  const online = ctx.cardOf.get(tx.id)?.entry_mode === 'ONLINE';
  const fraud = online
    ? `I do not recognise this online payment to ${name}.`
    : `I was not at ${name} that day, and my card never left me.`;

  return [
    // Online purchases can go missing or be sent back; in a shop, a payment can only be wrong.
    ...CARD_TEXTS.filter(([kind]) => kind === (online ? kindOf(name) : 'IN_PERSON')).map(
      ([, reason, text]) => [reason, text.replace('{m}', name)],
    ),
    // Everyday fraud claims here go to the network; the others are the bank's (bankRefund).
    ...(chargeable(ctx, tx) ? [['UNAUTHORIZED', fraud]] : []),
  ];
}

/**
 * Everyday card disputes, one of each outcome so every stage shows: [where it ends, how many days
 * ago the customer asked, the reasons that fit].
 */
const ANY = [
  'ITEM_NOT_RECEIVED',
  'CANCELLED_ORDER',
  'CANCELLED_RECURRING',
  'DUPLICATE_CHARGE',
  'SERVICE_NOT_RENDERED',
  'WRONG_AMOUNT',
];
// Before routing these, the desk wants the customer's exchanges with the merchant.
const ASK_FIRST = [
  'ITEM_NOT_RECEIVED',
  'CANCELLED_ORDER',
  'CANCELLED_RECURRING',
  'SERVICE_NOT_RENDERED',
];
const CARD_PLAN = [
  ...Array(2).fill(['NEW', [0, 2], ASK_FIRST]),
  ...Array(4).fill(['NEW', [0, 2], ANY]),
  ...Array(3).fill(['CONTACT_MERCHANT', [10, 120], ['ITEM_NOT_RECEIVED', 'CANCELLED_ORDER']]),
  ...Array(2).fill(['DECLINED', [10, 120], ['DUPLICATE_CHARGE']]),
  ...Array(2).fill(['INITIATED', [1, 3], ANY]),
  ...Array(3).fill(['PRESENTED', [6, 16], [...ANY, 'UNAUTHORIZED']]),
  ...Array(2).fill(['REPRESENTED', [20, 36], ANY]),
  ['PRE_ARBITRATION', [44, 56], ANY],
  ...Array(4).fill(['WON', [62, 140], ANY]),
  ['WON', [62, 140], ['UNAUTHORIZED']],
  ...Array(2).fill(['LOST', [62, 140], ANY]),
  ['WITHDRAWN', [62, 140], ['ITEM_NOT_RECEIVED', 'CANCELLED_RECURRING', 'SERVICE_NOT_RENDERED']],
];

/** A new dispute waits for the customer's details before it is routed. */
function askDetails(ctx, dispute) {
  const person = ctx.holderOf(ctx.customers.get(dispute.customer_id));
  if (!person) return null;
  const sent = past(at(toDate(dispute.requested_at), between(1, 5)));
  Object.assign(dispute, { status: 'WAITING_CUSTOMER', assigned_to: op('disputes') });

  return informationRequest(
    ctx,
    dispute,
    person,
    sent,
    'SENT',
    'DISPUTE_DETAILS',
    'DISPUTE_REQUEST',
  );
}

function routeCard(ctx, tx, dispute, outcome) {
  const by = op('disputes');

  if (outcome === 'CONTACT_MERCHANT') {
    const routed = route(dispute, 'CONTACT_MERCHANT', by);
    closeDispute(
      dispute,
      routed,
      'Asked the customer to contact the merchant first; they can come back after 15 days.',
    );

    return null;
  }

  if (outcome === 'DECLINED') {
    const routed = route(dispute, 'DECLINED', by);
    closeDispute(
      dispute,
      routed,
      'Only one payment found for this order: the other line is a pre-authorisation that was released.',
    );

    return null;
  }

  route(dispute, 'CHARGEBACK', by);
  const cb = chargeback(ctx, tx, dispute, {
    fraud: dispute.reason === 'UNAUTHORIZED',
    source: 'CUSTOMER_REQUEST',
    requested: toDate(dispute.requested_at),
    stage: outcome,
  });
  if (FINAL.includes(cb.status)) closeDispute(dispute, toDate(cb.decision_at), cb.resolution_notes);

  return cb;
}

function cardDisputes(ctx) {
  const pool = candidates(ctx, 'CARD', tx => {
    const card = ctx.cardOf.get(tx.id);

    return (
      card?.type === 'PURCHASE' &&
      ['SETTLED', 'CLEARED'].includes(card.status) &&
      Number(tx.amount) >= 25 &&
      ONLINE_SHOPS.includes(tx.category)
    );
  });
  let asked = 0;
  CARD_PLAN.forEach(([outcome, [from, to], reasons]) => {
    const requested = past(withTime(daysAgo(between(from, to))));
    // Paid between 4 and 40 days before the customer complained.
    const fits = pool.filter(tx => {
      const gap = (requested - toDate(tx.created_at).getTime()) / DAY;

      return gap > 4 && gap < 40 && cardReasons(ctx, tx).some(([r]) => reasons.includes(r));
    });
    if (!fits.length) return;
    const tx = pick(fits);
    pool.splice(pool.indexOf(tx), 1);
    const [reason, text] = pick(cardReasons(ctx, tx).filter(([r]) => reasons.includes(r)));
    const ask = outcome === 'NEW' && ASK_FIRST.includes(reason) && asked < 2;
    const contacted =
      outcome !== 'CONTACT_MERCHANT' &&
      !ask &&
      !['UNAUTHORIZED', 'DUPLICATE_CHARGE'].includes(reason);
    const dispute = disputeRequest(ctx, tx, {
      reason,
      reason_detail: text,
      requested_at: iso(requested),
      merchant_contacted_at: contacted ? iso(at(requested, -between(48, 400))) : null,
    });
    const rfi = ask ? askDetails(ctx, dispute) : null;
    if (rfi) asked += 1;
    if (outcome !== 'NEW') routeCard(ctx, tx, dispute, outcome);
    disputeHistory(ctx, dispute, rfi);
  });
}

const LIABILITY = {
  ONLINE: 'approved with 3-D Secure',
  CHIP: 'read by chip',
  CONTACTLESS: 'paid contactless',
  MOBILE_WALLET: 'paid with a phone wallet',
};

/**
 * An unauthorised card payment, refunded by the next business day (PSD2). The bank files a
 * chargeback when the liability stayed with the merchant; otherwise the loss is the bank's.
 */
function bankRefund(ctx, tx, dispute) {
  const account = ctx.accounts.get(tx.account_id);
  const requested = toDate(dispute.requested_at);
  const routed = route(dispute, 'BANK_REFUND', dispute.assigned_to || op('disputes'));
  const refunded = past(earlier(at(routed, between(1, 20)), businessDays(requested, 1)));
  // Never before the payment itself is on the statement.
  const booked = at(toDate(tx.booked_at || tx.created_at), 0.5);
  const merchant = ctx.parties.get(tx.counterparty_id)?.name?.toUpperCase() || 'MARCHAND';
  const label = `REMBOURSEMENT OPERATION NON AUTORISEE CB ${merchant}`;
  const refund = post(
    ctx,
    account,
    past(later(later(refunded, at(routed, 0.1)), booked)),
    'CREDIT',
    tx.amount,
    label,
  );
  move(ctx, refund, 'REFUND', { dispute: dispute.id });
  const how = LIABILITY[ctx.cardOf.get(tx.id)?.entry_mode] || 'authenticated';
  closeDispute(
    dispute,
    toDate(refund.booked_at),
    `Refunded the next business day (PSD2). The payment was ${how}: no chargeback right, the bank bears the loss.`,
  );
}

function fraudClaim(ctx, tx, dispute, source) {
  if (!chargeable(ctx, tx)) {
    bankRefund(ctx, tx, dispute);
    disputeHistory(ctx, dispute);

    return;
  }

  route(dispute, 'CHARGEBACK', dispute.assigned_to || op('disputes'));
  const cb = chargeback(ctx, tx, dispute, {
    fraud: true,
    source,
    requested: toDate(dispute.requested_at),
    alertId: dispute.alert_id,
  });
  if (FINAL.includes(cb.status)) closeDispute(dispute, toDate(cb.decision_at), cb.resolution_notes);
  disputeHistory(ctx, dispute);
}

/** Wave B: the payments customers reported, and the purchases on tested cards. */
function storyDisputes(ctx) {
  const reported = ctx.rows.alerts.filter(
    a => a.source === 'MANUAL' && a.alert_type === 'CUSTOMER_REPORT',
  );
  reported.forEach(a => {
    ctx.rows.alert_transactions
      .filter(x => x.alert_id === a.id)
      .forEach(x => {
        const tx = ctx.txById.get(x.transaction_id);
        if (!tx || tx.status !== 'BOOKED') return;
        const dispute = disputeRequest(ctx, tx, {
          reason: 'UNAUTHORIZED',
          channel: 'PHONE',
          requested_at: a.triggered_at,
          reason_detail:
            'Reported on the phone with the other card payments the customer did not make.',
        });
        // One call: the agent who took it logs every payment on the same ticket.
        if (!ctx.tickets.has(a.id)) ctx.tickets.set(a.id, dispute.support_ticket_ref);
        Object.assign(dispute, {
          alert_id: a.id,
          created_by: a.created_by,
          support_ticket_ref: ctx.tickets.get(a.id),
        });
        fraudClaim(ctx, tx, dispute, 'CUSTOMER_REQUEST');
      });
  });
  // Tested cards: the bank spots the fraud itself, calls the customer and logs the claim.
  [...(ctx.stories?.values() || [])]
    .filter(s => s.kind === 'CARD_TESTING' && s.lines.length)
    .forEach(story => {
      const { tx } = story.lines[story.lines.length - 1];
      if (tx.status !== 'BOOKED') return;
      const customer = customerOf(ctx, tx);
      const found = ctx.rows.alerts.find(
        a => a.customer_id === customer.id && a.alert_type === 'CARD_TESTING',
      );
      const dispute = disputeRequest(ctx, tx, {
        reason: 'UNAUTHORIZED',
        channel: 'PHONE',
        requested_at: iso(past(at(toDate(found?.triggered_at || tx.created_at), between(2, 6)))),
        reason_detail:
          'Called by the fraud team about the card tests: confirms this purchase is not theirs.',
        alert_id: found?.id || null,
      });
      dispute.created_by = op('l1');
      fraudClaim(ctx, tx, dispute, 'FRAUD_DETECTION');
    });
}

/** One more line in a record's status history, after the ones written with it. */
function addStep(ctx, type, record, [from, to], when, by, reason) {
  ctx.rows.status_changes.push({
    id: uuid(),
    record_type: type,
    record_id: record.id,
    field: 'status',
    old_value: from,
    new_value: to,
    changed_by: by,
    changed_at: iso(when),
    reason,
  });
}

// "Not me", but the payment was approved with 3-D Secure in our app on the customer's usual
// phone. The law lets the bank refuse the refund only when it suspects the customer's own fraud,
// and then it must send its reasons to the Banque de France: it does, and investigates.
// [how the check ends, how many days ago the customer asked]
const DOUBTED = [
  ['OPEN', [2, 5]],
  ['FIRST_PARTY_FRAUD', [45, 80]],
  ['GENUINE_FRAUD', [50, 90]],
];
const DOUBT =
  'The customer says they did not make this online payment, but it was approved with 3-D Secure in our app, on the phone they have used for months, from their usual area. Refund refused for now; our reasons were sent to the Banque de France, as the law requires.';
const DOUBT_ENDS = {
  FIRST_PARTY_FRAUD:
    'Outcome: the customer made the payment (same phone, same place, parcel delivered to their address). Refund refused.',
  GENUINE_FRAUD:
    'Outcome: genuine fraud, the phone had been stolen the day before and unlocked. Customer refunded; after 3-D Secure there is no chargeback right, the bank bears the loss.',
};

function doubtedEnd(ctx, tx, dispute, decision, decided) {
  const account = ctx.accounts.get(tx.account_id);
  dispute.route = decision === 'GENUINE_FRAUD' ? 'BANK_REFUND' : 'DECLINED';
  dispute.routed_at = iso(decided);

  if (decision === 'GENUINE_FRAUD') {
    const merchant = ctx.parties.get(tx.counterparty_id)?.name?.toUpperCase() || 'MARCHAND';
    const refund = post(
      ctx,
      account,
      at(decided, 2),
      'CREDIT',
      tx.amount,
      `REMBOURSEMENT OPERATION NON AUTORISEE CB ${merchant}`,
    );
    move(ctx, refund, 'REFUND', { dispute: dispute.id });
    closeDispute(dispute, at(decided, 2), DOUBT_ENDS[decision]);
  } else {
    closeDispute(dispute, decided, DOUBT_ENDS[decision]);
  }
}

function doubtedClaim(ctx, tx, end, requested) {
  const customer = customerOf(ctx, tx);
  const name = ctx.parties.get(tx.counterparty_id)?.name || '';
  const dispute = disputeRequest(ctx, tx, {
    reason: 'UNAUTHORIZED',
    reason_detail: `I do not recognise this online payment to ${name}.`,
    requested_at: iso(requested),
  });
  const notified = past(at(requested, between(4, 20)));
  Object.assign(dispute, {
    status: 'UNDER_INVESTIGATION',
    assigned_to: op('disputes'),
    bdf_notified_at: iso(notified),
  });
  const decision = end === 'OPEN' ? null : end;
  const inv = investigation(ctx, {
    customer,
    type: 'FRAUD',
    origin: 'DISPUTE',
    opened: at(notified, -1),
    status: 'IN_PROGRESS',
    decision,
    lines: [tx],
    summary: decision ? `${DOUBT} ${DOUBT_ENDS[decision]}` : DOUBT,
    priority: 'MEDIUM',
    lineNote: 'The payment the customer says they did not make',
    quiet: true,
  });
  dispute.investigation_id = inv.id;
  if (decision) doubtedEnd(ctx, tx, dispute, decision, toDate(inv.decided_at));
  disputeHistory(ctx, dispute);
}

function doubtedClaims(ctx) {
  const pool = candidates(ctx, 'CARD', tx => {
    const card = ctx.cardOf.get(tx.id);

    return (
      card?.type === 'PURCHASE' &&
      card.entry_mode === 'ONLINE' &&
      card.is_3ds &&
      ['SETTLED', 'CLEARED'].includes(card.status) &&
      Number(tx.amount) >= 60
    );
  });
  DOUBTED.forEach(([end, [from, to]]) => {
    const requested = past(withTime(daysAgo(between(from, to))));
    const fits = pool.filter(tx => {
      const gap = (requested - toDate(tx.created_at).getTime()) / DAY;

      return gap > 2 && gap < 30;
    });
    if (!fits.length) return;
    const tx = pick(fits);
    pool.splice(pool.indexOf(tx), 1);
    doubtedClaim(ctx, tx, end, requested);
  });
}

// The same customer disputes again and again: [stage, how many days ago they asked].
const REPEATS = [
  ['WON', [130, 160]],
  ['WON', [62, 90]],
  ['NEW', [0, 1]],
];

/** The payments of one customer that fit each of the REPEATS dates, or nothing. */
function repeatPayments(txs) {
  const picked = [];
  const ok = REPEATS.every(([, [from, to]]) => {
    const requested = past(withTime(daysAgo(between(from, to))));
    const tx = txs.find(t => {
      const gap = (requested - toDate(t.created_at).getTime()) / DAY;

      return !picked.some(p => p.tx === t) && gap > 4 && gap < 40;
    });
    if (tx) picked.push({ tx, requested });

    return Boolean(tx);
  });

  return ok ? picked : null;
}

/** Three disputes in six months by one customer: the third sets the rule off (repeatRule). */
function repeatedDisputes(ctx) {
  const pool = candidates(ctx, 'CARD', tx => {
    const card = ctx.cardOf.get(tx.id);
    const name = ctx.parties.get(tx.counterparty_id)?.name || '';

    return (
      card?.type === 'PURCHASE' &&
      ['SETTLED', 'CLEARED'].includes(card.status) &&
      card.entry_mode === 'ONLINE' &&
      Number(tx.amount) >= 25 &&
      ['GOODS', 'DELIVERY'].includes(kindOf(name))
    );
  });
  const byCustomer = new Map();
  pool.forEach(tx => {
    const id = ctx.accounts.get(tx.account_id).customer_id;
    if (!byCustomer.has(id)) byCustomer.set(id, []);
    byCustomer.get(id).push(tx);
  });
  const found = [...byCustomer.values()].map(repeatPayments).find(Boolean);
  if (!found) return;
  found.forEach(({ tx, requested }, k) => {
    const [reason, text] = cardReasons(ctx, tx).find(([r]) => r === 'ITEM_NOT_RECEIVED');
    const dispute = disputeRequest(ctx, tx, {
      reason,
      reason_detail: text,
      requested_at: iso(requested),
      channel: 'APP',
      merchant_contacted_at: iso(at(requested, -between(48, 200))),
    });
    if (REPEATS[k][0] !== 'NEW') routeCard(ctx, tx, dispute, REPEATS[k][0]);
    disputeHistory(ctx, dispute);
  });
}

// `previous` came in on or before `current`, at most six months earlier.
const withinSixMonths = (current, previous) =>
  previous.requested_at <= current.requested_at &&
  (toDate(current.requested_at).getTime() - toDate(previous.requested_at).getTime()) / DAY <= 183;

/**
 * Rule FRD-004 on every customer: a third dispute, on another day, within six months. Recent ones
 * wait for review; older ones were checked and found genuine.
 */
function repeatRule(ctx) {
  const byCustomer = new Map();
  // Disputes with a merchant (card payments, direct debits), not the customer's own transfer typos.
  ctx.rows.dispute_requests
    .filter(d => ['CARD', 'DIRECT_DEBIT'].includes(d.payment_type))
    .forEach(d => {
      if (!byCustomer.has(d.customer_id)) byCustomer.set(d.customer_id, []);
      byCustomer.get(d.customer_id).push(d);
    });
  byCustomer.forEach((list, customerId) => {
    const window = d => list.filter(e => withinSixMonths(d, e));
    const days = d => new Set(window(d).map(e => e.requested_at.slice(0, 10))).size;
    const third = list
      .sort((a, b) => (a.requested_at < b.requested_at ? -1 : 1))
      .find(d => days(d) >= 3);
    if (!third) return;
    const cases = window(third);
    const triggered = past(at(toDate(third.requested_at), 0.2));
    const signal = alert(ctx, {
      type: 'REPEATED_DISPUTES',
      customer: ctx.customers.get(customerId),
      triggered,
      lines: [third, ...cases.filter(e => e !== third)].map(e => ctx.txById.get(e.transaction_id)),
      outcome: ago(triggered) < 10 ? 'OPEN' : 'CLEARED',
      clearance: 'FALSE_POSITIVE',
      note: 'Checked: each dispute was about a different merchant and was genuine.',
      score: 64,
    });
    ctx.rows.chargebacks
      .filter(c => !c.alert_id && cases.some(e => e.id === c.dispute_request_id))
      .forEach(c => {
        c.alert_id = signal.id;
      });
    cases
      .filter(d => !d.alert_id)
      .forEach(d => {
        d.alert_id = signal.id;
      });
  });
}

// ---- SEPA disputes -------------------------------------------------------------------------------

const SEPA_CODES = {
  CUSTOMER_REQUEST: 'MD06',
  UNAUTHORISED: 'MD01',
  WRONG_IBAN: 'AC03',
  WRONG_AMOUNT: 'AM09',
  FRAUD: 'FRAD',
  DUPLICATE: 'DUPL',
  TECHNICAL: 'TECH',
};

function sepaDispute(ctx, tx, fields) {
  const requested = toDate(fields.requested_at);
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customerOf(ctx, tx).id,
    transaction_id: tx.id,
    direct_debit_id: null,
    incoming_transfer_id: ctx.inOf.get(tx.id)?.id || null,
    outgoing_transfer_id: ctx.outOf.get(tx.id)?.id || null,
    dispute_request_id: null,
    alert_id: null,
    return_transaction_id: null,
    amount: tx.amount,
    amount_returned: null,
    response_due: isoDate(businessDays(requested, 15)),
    customer_consent_at: null,
    answered_at: null,
    assigned_to: op('payments'),
    other_bank_bic: null,
    ...fields,
  };
  row.reason_code = SEPA_CODES[row.reason];
  ctx.rows.sepa_disputes.push(row);

  return row;
}

function sepaHistory(ctx, row, steps) {
  trail(ctx.rows, 'SEPA_DISPUTES', row, steps);
}

/** Direct debits the customer wants back: within 8 weeks the refund cannot be refused. */
function directDebitRefunds(ctx) {
  const pool = candidates(ctx, 'DIRECT_DEBIT', tx => {
    const dd = ctx.debitOf.get(tx.id);

    return (
      dd?.status === 'COLLECTED' && dd.mandate_type === 'CORE' && ago(toDate(tx.created_at)) < 50
    );
  });

  for (let k = 0; k < 6 && pool.length; k += 1) {
    const tx = pool.splice(between(0, pool.length - 1), 1)[0];
    const dd = ctx.debitOf.get(tx.id);
    const account = ctx.accounts.get(tx.account_id);
    const creditor = ctx.creditors.get(ctx.mandates.get(dd.mandate_id)?.creditor_id);
    const name = ctx.parties.get(creditor?.counterparty_id)?.name || 'CREANCIER';
    const requested = past(
      withTime(new Date(toDate(tx.created_at).getTime() + between(3, 20) * DAY)),
    );
    const dispute = disputeRequest(ctx, tx, {
      ...pick([
        {
          reason: 'SERVICE_NOT_RENDERED',
          reason_detail: `I cancelled my contract with ${name}, this debit should not have been taken.`,
        },
        {
          reason: 'WRONG_AMOUNT',
          reason_detail: `${name} took ${Number(tx.amount).toFixed(
            2,
          )} EUR, more than my usual monthly payment.`,
        },
      ]),
      requested_at: iso(requested),
    });
    const routed = route(dispute, 'SEPA_DISPUTE', op('disputes'));
    const refunded = past(businessDays(routed, between(1, 3)));
    const refund = post(
      ctx,
      account,
      refunded,
      'CREDIT',
      tx.amount,
      `REMBOURSEMENT PRLV SEPA ${name.toUpperCase()}`,
    );
    const row = sepaDispute(ctx, tx, {
      direct_debit_id: dd.id,
      dispute_request_id: dispute.id,
      scheme: 'SDD_CORE',
      type: 'REFUND',
      side: 'WE_ASKED',
      reason: 'CUSTOMER_REQUEST',
      requested_at: iso(routed),
      status: 'ACCEPTED',
      answered_at: iso(refunded),
      amount_returned: tx.amount,
      return_transaction_id: refund.id,
      // Each creditor banks somewhere, always the same place.
      other_bank_bic: OTHER_BANKS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 5][1],
    });
    dd.status = 'REFUNDED';
    move(ctx, refund, 'REFUND', { sepa: row });
    closeDispute(
      dispute,
      refunded,
      'Refunded: within 8 weeks a SEPA Core direct debit refund is unconditional.',
    );
    disputeHistory(ctx, dispute);
    sepaHistory(ctx, row, [
      ['OPEN', routed, row.assigned_to],
      ['ACCEPTED', refunded, 'system', 'Refund within 8 weeks (MD06)'],
    ]);
  }
}

const RECALL_ANSWERS = {
  ACCEPTED: 'The beneficiary agreed: funds returned.',
  PARTIAL: 'The beneficiary returned part of the amount.',
  REFUSED: 'The beneficiary refused to return the funds.',
};
const TYPO_REFUSED =
  'The beneficiary refused to return the funds. The payee check had warned the customer (no match on the name): the loss is theirs.';

/** The other bank's answer to our recall: the money back on the account, or not. */
function recallAnswered(ctx, row, tx, routed, steps) {
  const answered = past(new Date(routed.getTime() + between(4, 14) * DAY));
  row.answered_at = iso(answered);

  if (row.status !== 'REFUSED') {
    const back = row.status === 'PARTIAL' ? round2(Number(tx.amount) * 0.5) : Number(tx.amount);
    const account = ctx.accounts.get(tx.account_id);
    const credit = post(
      ctx,
      account,
      answered,
      'CREDIT',
      back,
      'RETOUR FONDS SUR DEMANDE DE RAPPEL',
    );
    Object.assign(row, { amount_returned: back, return_transaction_id: credit.id });
    move(ctx, credit, 'REFUND', { sepa: row });
  }

  steps.push([row.status, answered, 'other bank', RECALL_ANSWERS[row.status]]);

  return answered;
}

function mistakenTransfer(ctx, tx, k) {
  const payee = ctx.payees.get(ctx.outOf.get(tx.id).beneficiary_id);
  const reason = k % 2 ? 'WRONG_AMOUNT' : 'WRONG_IBAN';
  const requested = past(at(toDate(tx.created_at), between(2, 72)));
  const dispute = disputeRequest(ctx, tx, {
    reason: reason === 'WRONG_IBAN' ? 'WRONG_BENEFICIARY' : 'WRONG_AMOUNT',
    requested_at: iso(requested),
    reason_detail:
      reason === 'WRONG_IBAN'
        ? 'I made a typo in the IBAN, the money went to someone else.'
        : 'I typed one zero too many in the amount.',
  });
  const routed = route(dispute, 'SEPA_DISPUTE', op('disputes'));
  // The payee check warned the customer (no match on the name), who sent the transfer anyway.
  if (reason === 'WRONG_IBAN') ctx.outOf.get(tx.id).payee_check = 'NO_MATCH';
  // The other bank has 15 business days to answer.
  const answeredBy = businessDays(routed, 15) < NOW;
  const row = sepaDispute(ctx, tx, {
    dispute_request_id: dispute.id,
    scheme: ctx.outOf.get(tx.id).scheme === 'SEPA_INSTANT' ? 'SCT_INST' : 'SCT',
    type: 'REQUEST_FOR_RECALL',
    side: 'WE_ASKED',
    reason,
    requested_at: iso(routed),
    status: 'WAITING_OTHER_BANK',
    other_bank_bic: payee?.bic || null,
  });

  // The second one is refused, so a complaint can follow it.
  if (answeredBy) {
    row.status =
      k === 1
        ? 'REFUSED'
        : weighted([
            ['ACCEPTED', 50],
            ['REFUSED', 30],
            ['PARTIAL', 20],
          ]);
  }

  const steps = [
    ['OPEN', routed, row.assigned_to],
    ['WAITING_OTHER_BANK', at(routed, 1), row.assigned_to],
  ];

  if (answeredBy) {
    const answered = recallAnswered(ctx, row, tx, routed, steps);
    const typo = reason === 'WRONG_IBAN' && row.status === 'REFUSED';
    closeDispute(dispute, answered, typo ? TYPO_REFUSED : RECALL_ANSWERS[row.status]);
  }

  disputeHistory(ctx, dispute);
  sepaHistory(ctx, row, steps);
}

/** Transfers our customers sent to the wrong IBAN or for the wrong amount: we ask them back. */
function mistakenTransfers(ctx) {
  const pool = candidates(ctx, 'TRANSFER', tx => {
    const out = ctx.outOf.get(tx.id);

    return (
      out && tx.direction === 'DEBIT' && Number(tx.amount) >= 40 && ago(toDate(tx.created_at)) < 120
    );
  });

  for (let k = 0; k < 5 && pool.length; k += 1) {
    mistakenTransfer(ctx, pool.splice(between(0, pool.length - 1), 1)[0], k);
  }
}

/** The takeover transfer that left: refunded to the customer at once, recalled from the other bank. */
function takeoverRecall(ctx) {
  [...(ctx.stories?.values() || [])]
    .filter(s => s.kind === 'TAKEOVER')
    .forEach(story => {
      const line = story.lines.find(l => l.event.kind === 'OUT' && l.tx.status === 'BOOKED');
      if (!line) return;
      const { tx } = line;
      const account = ctx.accounts.get(tx.account_id);
      const requested = at(toDate(tx.created_at), between(3, 20));
      const takeover = ctx.rows.alerts.find(
        a => a.customer_id === account.customer_id && a.category === 'ACCOUNT_TAKEOVER',
      );
      const dispute = disputeRequest(ctx, tx, {
        reason: 'UNAUTHORIZED',
        channel: 'PHONE',
        requested_at: iso(requested),
        reason_detail: 'Someone took control of my account and sent this transfer.',
        alert_id: takeover?.id || null,
      });
      const routed = route(dispute, 'SEPA_DISPUTE', op('disputes'));
      // Unauthorised: the bank refunds by the next business day, then chases the money itself.
      const refund = post(
        ctx,
        account,
        past(businessDays(requested, 1)),
        'CREDIT',
        tx.amount,
        'REMBOURSEMENT OPERATION NON AUTORISEE',
      );
      const answered = past(new Date(routed.getTime() + between(5, 12) * DAY));
      const row = sepaDispute(ctx, tx, {
        dispute_request_id: dispute.id,
        alert_id: takeover?.id || null,
        scheme: 'SCT_INST',
        type: 'RECALL',
        side: 'WE_ASKED',
        reason: 'FRAUD',
        requested_at: iso(routed),
        status: 'PARTIAL',
        answered_at: iso(answered),
        amount_returned: round2(Number(tx.amount) * 0.18),
        other_bank_bic: story.payee?.beneficiary?.bic || null,
      });
      move(ctx, refund, 'REFUND', { sepa: row });
      const why =
        'The receiving bank returned what was left on the account: the rest had been withdrawn.';
      closeDispute(
        dispute,
        answered,
        'Customer refunded the next business day (unauthorised payment); recall to the receiving bank partly successful.',
      );
      disputeHistory(ctx, dispute);
      sepaHistory(ctx, row, [
        ['OPEN', routed, row.assigned_to],
        ['WAITING_OTHER_BANK', at(routed, 1), row.assigned_to],
        ['PARTIAL', answered, 'other bank', why],
      ]);
    });
}

// ---- recalls other banks send us -------------------------------------------------------------------

const FRAUD_RECALL_ANSWERS = {
  ACCEPTED: 'Funds still on the account: returned.',
  PARTIAL: 'Only part of the funds was left: returned what remained.',
  REFUSED: 'No funds left: the money was forwarded within hours.',
};

/** We answer a fraud recall with what is left of the payment on the account. */
function fraudRecallAnswered(ctx, row, account, left, requested, steps) {
  const answered = past(at(requested, between(24, 96)));
  row.answered_at = iso(answered);
  row.status = 'REFUSED';
  if (left > 0) row.status = left >= Number(row.amount) - 0.01 ? 'ACCEPTED' : 'PARTIAL';

  if (left > 0) {
    const back = post(
      ctx,
      account,
      answered,
      'DEBIT',
      round2(left),
      'RETOUR FONDS RAPPEL SEPA FRAUDE',
    );
    Object.assign(row, { amount_returned: round2(left), return_transaction_id: back.id });
    move(ctx, back, 'RETURN', { sepa: row });
  }

  steps.push([row.status, answered, row.assigned_to, FRAUD_RECALL_ANSWERS[row.status]]);
}

function muleRecall(ctx, { tx, event }) {
  const account = ctx.accounts.get(tx.account_id);
  const requested = past(at(toDate(tx.created_at), between(48, 20 * 24)));
  const open = ago(requested) < 12;
  const inv = ctx.rows.investigations.find(i => i.customer_id === account.customer_id);
  const signal = alert(ctx, {
    type: 'INCOMING_FRAUD_RECALL',
    customer: ctx.customers.get(account.customer_id),
    triggered: past(at(requested, 0.5)),
    lines: [tx],
    outcome: open || !inv ? 'OPEN' : 'ESCALATED',
    score: 88,
  });
  if (!open && inv) signal.investigation_id = inv.id;
  const row = sepaDispute(ctx, tx, {
    alert_id: signal.id,
    scheme: ctx.inOf.get(tx.id)?.scheme === 'SEPA_INSTANT' ? 'SCT_INST' : 'SCT',
    type: 'RECALL',
    side: 'WE_ARE_ASKED',
    reason: 'FRAUD',
    requested_at: iso(requested),
    status: 'OPEN',
    other_bank_bic: event.from?.emitter?.bic || null,
  });
  const steps = [['OPEN', requested, 'other bank', 'Fraud recall (FRAD) from the payer’s bank']];
  // Only money really on the account can go back (not the overdraft).
  const held = ctx.rows.holds
    .filter(h => h.account_id === account.id && h.status === 'ACTIVE')
    .reduce((sum, h) => sum + Number(h.amount), 0);
  // Never more than is really there: booked money, less pending payments and other holds.
  const onAccount = open
    ? Math.min(
        spendable(ctx, account, at(requested, 1), false) - held,
        Number(account.available_balance),
      )
    : spendable(ctx, account, at(requested, 1), false);
  const left = round2(Math.max(0, Math.min(Number(tx.amount), onAccount)));

  if (!open) {
    fraudRecallAnswered(ctx, row, account, left, requested, steps);
  } else if (left > 0) {
    hold(ctx, account, {
      amount: round2(left),
      reason: 'FRAUD',
      alert_id: signal.id,
      sepa_dispute_id: row.id,
      placed_by: 'system',
      placed_at: iso(past(at(requested, 0.1))),
      expires_at: `${row.response_due} 21:59:59.000 +00:00`,
    });
  }

  sepaHistory(ctx, row, steps);
}

/** The victims' banks ask for their money back from the mules: what is left, if anything. */
function muleRecalls(ctx) {
  [...(ctx.stories?.values() || [])]
    .filter(story => story.kind === 'MULE')
    .forEach(story =>
      story.lines
        .filter(l => l.event.kind === 'IN' && l.tx.status === 'BOOKED')
        .slice(0, 2)
        .forEach(line => muleRecall(ctx, line)),
    );
}

/** Our customer was asked: when they answer, the money goes back or stays theirs. */
function consentDecided(ctx, row, account, rfi, agreed, sent) {
  const answered = agreed ? toDate(rfi.answered_at) : past(new Date(sent.getTime() + 9 * DAY));
  row.answered_at = iso(answered);
  // Agreed, but the money may be spent already: then the payer's bank claims it elsewhere.
  const there = agreed && spendable(ctx, account, answered, false) >= Number(row.amount);
  row.status = there ? 'ACCEPTED' : 'REFUSED';
  if (agreed) row.customer_consent_at = rfi.answered_at;

  if (there) {
    const back = post(ctx, account, answered, 'DEBIT', row.amount, 'RETOUR FONDS RAPPEL SEPA');
    Object.assign(row, { amount_returned: row.amount, return_transaction_id: back.id });
    move(ctx, back, 'RETURN', { sepa: row });
  }

  let why = 'No consent from the customer: the funds stay.';

  if (there) {
    why = 'Customer agreed: funds returned.';
  } else if (agreed) {
    why = 'Customer agreed, but the funds were already spent: the payer’s bank was told.';
  }

  return { answered, why };
}

/** No answer by the other bank's deadline: the request closes with the case. */
function closeRequest(ctx, rfi, date) {
  const reason = 'Case closed: no answer before the other bank’s deadline.';
  Object.assign(rfi, { status: 'CANCELLED', cancel_reason: reason });
  addStep(ctx, 'INFORMATION_REQUESTS', rfi, ['OVERDUE', 'CANCELLED'], date, 'system', reason);
}

/**
 * A hold these recalls no longer place (nothing is held before the customer agrees): the draws it
 * took (its id, its history lines, its reference) are kept, so the data built after stays put.
 */
function holdNoMore(ctx, ids) {
  for (let k = 0; k < ids; k += 1) uuid();
  ctx.holdsNoMore = (ctx.holdsNoMore || 0) + 1;
}

/**
 * The customer answered (or never did): the money went back or stays. Not a fraud, so the amount
 * was held only once they agreed, until the return went out.
 */
function consentEnd(ctx, row, account, rfi, agreed, sent) {
  const { answered, why } = consentDecided(ctx, row, account, rfi, agreed, sent);
  if (rfi && !agreed) closeRequest(ctx, rfi, answered);

  if (row.status === 'ACCEPTED') {
    hold(ctx, account, {
      amount: row.amount,
      reason: 'DISPUTE',
      sepa_dispute_id: row.id,
      placed_by: row.assigned_to,
      placed_at: iso(answered),
      status: 'RELEASED',
      released_at: iso(at(answered, 0.05)),
      released_by: row.assigned_to,
      release_reason: why,
    });
  } else {
    holdNoMore(ctx, 3);
  }

  return [row.status, answered, row.assigned_to, why];
}

function mistakenCredit(ctx, tx, k) {
  ctx.used.add(tx.id);
  const account = ctx.accounts.get(tx.account_id);
  const customer = ctx.customers.get(account.customer_id);
  const person = ctx.holderOf(customer);
  const incoming = ctx.inOf.get(tx.id);
  const requested =
    k === 0 ? past(withTime(daysAgo(1))) : past(at(toDate(tx.created_at), between(48, 240)));
  const row = sepaDispute(ctx, tx, {
    scheme: incoming.scheme === 'SEPA_INSTANT' ? 'SCT_INST' : 'SCT',
    type: 'REQUEST_FOR_RECALL',
    side: 'WE_ARE_ASKED',
    reason: k % 2 ? 'WRONG_AMOUNT' : 'WRONG_IBAN',
    requested_at: iso(requested),
    status: 'OPEN',
    other_bank_bic: ctx.emitters.get(incoming.emitter_id)?.bic || null,
  });
  const sent = past(at(requested, 3));
  // The newest is still waiting for the customer; one of the others never answered.
  const waiting = k === 0 || NOW.getTime() - sent < 8 * DAY || !person;
  const agreed = !waiting && k !== 3;
  let rfiStatus = 'OVERDUE';
  if (waiting) rfiStatus = 'SENT';
  else if (agreed) rfiStatus = 'ANSWERED';
  const owner = { ...row, customer_id: customer.id, assigned_to: row.assigned_to };
  const rfi =
    person &&
    informationRequest(ctx, owner, person, sent, rfiStatus, 'RECALL_CONSENT', 'SEPA_DISPUTE');

  if (rfi) {
    const amount = Number(tx.amount).toFixed(2);
    rfi.questions = `The bank of the payer says the transfer of ${amount} EUR you received was sent by mistake. Do you agree that we return it?`;
  }

  const steps = [
    [
      'OPEN',
      requested,
      'other bank',
      `The payer says the payment was a mistake (${row.reason_code})`,
    ],
    ['WAITING_CUSTOMER', sent, row.assigned_to, 'Customer’s consent asked'],
  ];

  // Not a fraud: nothing is held while the customer is asked, the money is theirs until they agree.
  if (waiting) {
    row.status = 'WAITING_CUSTOMER';
    holdNoMore(ctx, 2);
  } else {
    steps.push(consentEnd(ctx, row, account, rfi, agreed, sent));
  }

  sepaHistory(ctx, row, steps);
}

/** Someone paid our customer by mistake: the money goes back only if our customer agrees. */
function mistakenCredits(ctx) {
  const pool = candidates(ctx, 'TRANSFER', tx => {
    const inc = ctx.inOf.get(tx.id);

    return (
      inc &&
      tx.direction === 'CREDIT' &&
      !inc.purpose_code &&
      Number(tx.amount) < 3000 &&
      ago(toDate(tx.created_at)) < 60
    );
  });

  for (let k = 0; k < 4 && pool.length; k += 1) {
    mistakenCredit(ctx, pool.splice(between(0, pool.length - 1), 1)[0], k);
  }
}

/** Open money-laundering investigations: what is left on the account stays there until decided. */
function investigationHolds(ctx) {
  ctx.rows.investigations
    // Built on alerts (mules, split payments), not on a relationship manager's doubt.
    .filter(i => i.type === 'AML' && i.origin === 'ALERTS' && !i.decision)
    .forEach(inv => {
      const account = (ctx.accountsOf.get(inv.customer_id) || []).find(a => a.type !== 'SAVINGS');
      if (!account) return;
      const left = round2(Number(account.available_balance));
      if (left < 50) return;
      hold(ctx, account, {
        amount: left,
        reason: 'INVESTIGATION',
        investigation_id: inv.id,
        placed_by: inv.assigned_to,
        placed_at: iso(past(at(toDate(inv.opened_at), 6))),
      });
    });
}

/** Nothing on the customer's accounts moved after `date`: a freeze from then on reads true. */
function quietSince(ctx, customer, date) {
  const when = iso(date);

  return (ctx.accountsOf.get(customer.id) || []).every(a =>
    (ctx.txOf.get(a.id) || []).every(tx => tx.created_at < when),
  );
}

/** A customer just added to the EU sanctions list: every account and card is frozen, the money held. */
function sanctionsFreeze(ctx) {
  const day = past(withTime(daysAgo(1)));
  const busy = new Set(
    [...ctx.rows.dispute_requests, ...ctx.rows.complaints, ...ctx.rows.alerts].map(
      r => r.customer_id,
    ),
  );

  const fits = c => {
    const person = c.status === 'ACTIVE' && c.customer_type === 'RETAIL' && ctx.holderOf(c);
    const accounts = ctx.accountsOf.get(c.id) || [];

    return (
      person &&
      !busy.has(c.id) &&
      (ctx.customersOf.get(person.id) || []).length === 1 &&
      accounts.every(a => a.status === 'ACTIVE') &&
      accounts.some(a => Number(a.available_balance) > 300) &&
      quietSince(ctx, c, day)
    );
  };

  const pool = ctx.rows.customers.filter(fits);
  const customer =
    pool.find(c => ctx.holderOf(c).nationality !== 'FR') || pool.find(Boolean) || null;
  if (!customer) return;
  const person = ctx.holderOf(customer);
  const name = `${person.first_name} ${person.last_name}`;
  // The EU's ISIL and Al-Qaida regime also lists EU citizens; the Russia one lists Russians.
  const regime =
    person.nationality === 'RU'
      ? 'Russia (Regulation 269/2014)'
      : 'ISIL (Da’esh) and Al-Qaida (Regulation 2016/1686)';
  const entry = watchEntry(ctx, {
    list: 'EU',
    regime,
    name,
    country: person.nationality,
    date_of_birth: person.date_of_birth,
    listed_at: iso(at(day, -30)),
    updated_at: iso(at(day, -30)),
  });
  const reviewer = op('l2');
  const hit = screeningHit(ctx, {
    individual_id: person.id,
    watchlist_entry_id: entry.id,
    screened_name: name,
    trigger: 'LIST_UPDATE',
    match_score: round2(98 + between(0, 19) / 10),
    matched_on: 'Name, date of birth, nationality',
    status: 'TRUE_MATCH',
    created_at: iso(at(day, -20)),
    reviewed_by: reviewer,
    reviewed_at: iso(day),
    decision_reason: 'Confirmed match: asset freeze applied and reported to the DG Trésor.',
  });
  person.is_sanctioned = true;
  ctx.accountsOf.get(customer.id).forEach(account => {
    Object.assign(account, {
      status: 'FROZEN',
      frozen_at: iso(day),
      freeze_reason: 'SANCTIONS',
      freeze_note:
        'Asset freeze: customer added to the EU sanctions list. Reported to the DG Trésor.',
    });
    ctx.rows.cards
      .filter(c => c.account_id === account.id && ['ACTIVE', 'PENDING'].includes(c.status))
      .forEach(c =>
        Object.assign(c, { status: 'BLOCKED', blocked_reason: 'AML_FREEZE', blocked_at: iso(day) }),
      );
    const left = round2(Number(account.available_balance));
    if (left <= 0) return;
    hold(ctx, account, {
      amount: left,
      reason: 'SANCTIONS',
      screening_hit_id: hit.id,
      placed_by: reviewer,
      placed_at: iso(at(day, 0.2)),
    });
  });
}

// ---- complaints ----------------------------------------------------------------------------------

const PAYMENT_CATEGORIES = ['FEES', 'CARD_PAYMENT', 'TRANSFER', 'DIRECT_DEBIT', 'FRAUD_SCAM'];

function complaint(ctx, customer, fields) {
  const received = toDate(fields.received_at);
  // Payment services: an answer within 15 business days; anything else: two months.
  const due = PAYMENT_CATEGORIES.includes(fields.category)
    ? businessDays(received, 15)
    : new Date(received.getTime() + 61 * DAY);
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
    collection_case_id: null,
    channel: weighted([
      ['APP', 40],
      ['EMAIL', 25],
      ['PHONE', 20],
      ['WEB', 10],
      ['POST', 5],
    ]),
    regulatory_deadline: isoDate(due),
    assigned_to: op('support'),
    acknowledged_at: null,
    status: 'RECEIVED',
    outcome: null,
    compensation_amount: null,
    compensation_transaction_id: null,
    root_cause: null,
    resolved_at: null,
    escalated_to: null,
    escalated_at: null,
    escalation_reference: null,
    escalation_outcome: null,
    escalation_decided_at: null,
    ...fields,
  };
  ctx.rows.complaints.push(row);

  return row;
}

/** Where a complaint stands from its age; resolved ones say who was right and why. */
function settleComplaint(
  ctx,
  row,
  account,
  { outcome, rootCause, compensate }: Record<string, any>,
) {
  const received = toDate(row.received_at);
  const age = ago(received);
  const by = row.assigned_to;
  const steps = [['RECEIVED', received, 'customer']];

  if (age > 1) {
    row.acknowledged_at = iso(past(at(received, between(4, 40))));
    row.status = 'ACKNOWLEDGED';
    steps.push(['ACKNOWLEDGED', toDate(row.acknowledged_at), by]);
  }

  if (age > 4) {
    row.status = 'IN_PROGRESS';
    steps.push(['IN_PROGRESS', past(at(toDate(row.acknowledged_at), 24)), by]);
  }

  if (age > 12) {
    const resolved = earlier(
      past(new Date(received.getTime() + between(5, 14) * DAY)),
      toDate(`${row.regulatory_deadline}T16:00:00Z`),
    );
    Object.assign(row, {
      status: 'RESOLVED',
      outcome,
      root_cause: rootCause,
      resolved_at: iso(resolved),
    });

    if (compensate && account) {
      const tx = post(ctx, account, resolved, 'CREDIT', compensate, 'GESTE COMMERCIAL RECLAMATION');
      Object.assign(row, { compensation_amount: compensate, compensation_transaction_id: tx.id });

      // Paid after a dispute: listed with the dispute's movements.
      if (row.dispute_request_id || row.chargeback_id || row.sepa_dispute_id) {
        move(ctx, tx, 'COMPENSATION', {
          dispute: row.dispute_request_id,
          chargeback: ctx.rows.chargebacks.find(c => c.id === row.chargeback_id),
          sepa: ctx.rows.sepa_disputes.find(d => d.id === row.sepa_dispute_id),
        });
      }
    }

    steps.push(['RESOLVED', resolved, by, outcome]);
  }

  trail(ctx.rows, 'COMPLAINTS', row, steps);

  return row;
}

const FEE_COMPLAINTS = {
  FOREIGN_CARD_PAYMENT:
    'I was charged a fee for a card payment abroad that I was never told about.',
  FOREIGN_ATM_WITHDRAWAL: 'Why was I charged for withdrawing cash in London?',
  REJECTED_PAYMENT:
    'You charged me for a rejected direct debit when my salary arrived the same day.',
  CARD_REPLACEMENT: 'I paid for a new card although mine was faulty, not lost.',
};

function feeComplaint(ctx, fee, account, customer, k) {
  const received =
    k === 0 ? past(withTime(daysAgo(0))) : past(at(toDate(fee.charged_at), between(24, 20 * 24)));
  const row = complaint(ctx, customer, {
    category: 'FEES',
    fee_id: fee.id,
    transaction_id: fee.transaction_id,
    received_at: iso(received),
    description: FEE_COMPLAINTS[fee.type],
  });
  // The second one is upheld: the fee was not in the price list the customer signed.
  const upheld = fee.type !== 'FOREIGN_ATM_WITHDRAWAL' && (k === 1 || chance(0.6));
  settleComplaint(ctx, row, account, {
    outcome: upheld ? 'UPHELD' : 'REJECTED',
    rootCause: upheld ? 'UNCLEAR_INFORMATION' : 'NO_FAULT',
  });

  if (row.status === 'RESOLVED' && upheld) {
    const refunded = toDate(row.resolved_at);
    const tx = post(ctx, account, refunded, 'CREDIT', fee.amount, 'REMBOURSEMENT FRAIS');
    Object.assign(fee, {
      status: 'REFUNDED',
      refunded_at: iso(refunded),
      refund_transaction_id: tx.id,
    });
  }
}

function feeComplaints(ctx) {
  const active = f => {
    const account = ctx.accounts.get(f.account_id);

    return (
      account.status === 'ACTIVE' && ctx.customers.get(account.customer_id).status === 'ACTIVE'
    );
  };

  const fees = ctx.rows.fees.filter(
    f =>
      FEE_COMPLAINTS[f.type] &&
      f.status === 'CHARGED' &&
      Number(f.amount) >= 3 &&
      ago(toDate(f.charged_at)) < 120 &&
      active(f),
  );
  // The second complaint is an old one, so it is settled: about a fee other than a withdrawal.
  const settled = f => f.type !== 'FOREIGN_ATM_WITHDRAWAL' && ago(toDate(f.charged_at)) > 40;

  for (let k = 0; k < 6 && fees.length; k += 1) {
    const oldOne = k === 1 ? fees.findIndex(settled) : -1;
    const fee = fees.splice(oldOne >= 0 ? oldOne : between(0, fees.length - 1), 1)[0];
    const account = ctx.accounts.get(fee.account_id);
    feeComplaint(ctx, fee, account, ctx.customers.get(account.customer_id), k);
  }
}

/**
 * The customer takes the answer further: the banking mediator gives an opinion within 90 days
 * (here for the bank: the merchant proved delivery).
 */
function escalate(ctx, row) {
  const escalated = past(at(toDate(row.resolved_at), between(48, 200)));
  const decided = earlier(
    new Date(escalated.getTime() + between(30, 80) * DAY),
    new Date(NOW.getTime() - DAY),
  );
  Object.assign(row, {
    status: 'ESCALATED',
    escalated_to: 'BANKING_MEDIATOR',
    escalated_at: iso(escalated),
    escalation_reference: `MED-${escalated.getUTCFullYear()}-${digits(5)}`,
  });
  const why = 'Referred to the banking mediator';
  addStep(ctx, 'COMPLAINTS', row, ['RESOLVED', 'ESCALATED'], escalated, 'customer', why);

  // The mediator takes at least two weeks to give an opinion.
  if (decided - escalated >= 14 * DAY) {
    Object.assign(row, {
      status: 'CLOSED',
      escalation_outcome: 'FOR_BANK',
      escalation_decided_at: iso(decided),
    });
    const ruling = 'The mediator ruled for the bank: the merchant proved delivery.';
    addStep(ctx, 'COMPLAINTS', row, ['ESCALATED', 'CLOSED'], decided, 'banking mediator', ruling);
  }
}

/** The other bank refused to give the money back (or only part of it): the customer blames us. */
function recallComplaint(ctx) {
  const asked = status => d =>
    d.side === 'WE_ASKED' && d.type === 'REQUEST_FOR_RECALL' && d.status === status;
  const row =
    ctx.rows.sepa_disputes.find(asked('REFUSED')) || ctx.rows.sepa_disputes.find(asked('PARTIAL'));
  if (!row) return;
  const tx = ctx.txById.get(row.transaction_id);
  const account = ctx.accounts.get(tx.account_id);
  const filed = complaint(ctx, ctx.customers.get(account.customer_id), {
    category: 'TRANSFER',
    sepa_dispute_id: row.id,
    dispute_request_id: row.dispute_request_id,
    transaction_id: tx.id,
    received_at: iso(past(at(toDate(row.answered_at), between(24, 72)))),
    description:
      row.status === 'PARTIAL'
        ? 'The other bank returned only part of my money and you did nothing more. What can I do now?'
        : 'The other bank refused to return my money and you did nothing more. What can I do now?',
  });
  settleComplaint(ctx, filed, account, { outcome: 'REJECTED', rootCause: 'THIRD_PARTY' });
}

/** Complaints that follow a dispute: a lost chargeback, a refused recall, a fraud victim. */
function caseComplaints(ctx) {
  ctx.rows.chargebacks
    .filter(cb => cb.status === 'LOST' && cb.dispute_request_id)
    .slice(0, 2)
    .forEach(cb => {
      const customer = ctx.customers.get(cb.customer_id);
      const account = ctx.accounts.get(ctx.txById.get(cb.transaction_id).account_id);
      const row = complaint(ctx, customer, {
        category: 'CARD_PAYMENT',
        chargeback_id: cb.id,
        dispute_request_id: cb.dispute_request_id,
        transaction_id: cb.transaction_id,
        received_at: iso(past(at(toDate(cb.decision_at), between(24, 96)))),
        description:
          'You took the money back although the merchant never delivered. I want this reviewed.',
      });
      settleComplaint(ctx, row, account, { outcome: 'REJECTED', rootCause: 'THIRD_PARTY' });
    });
  // The oldest one did not accept the answer and went to the banking mediator.
  const oldest = ctx.rows.complaints
    .filter(c => c.category === 'CARD_PAYMENT' && c.status === 'RESOLVED')
    .sort((a, b) => (a.resolved_at < b.resolved_at ? -1 : 1))[0];
  if (oldest) escalate(ctx, oldest);
  ctx.rows.dispute_requests
    // The takeover victim: an unauthorised transfer, refunded, and angry the bank did not see it.
    .filter(d => d.reason === 'UNAUTHORIZED' && d.payment_type !== 'CARD')
    .forEach(d => {
      const customer = ctx.customers.get(d.customer_id);
      const account = ctx.accounts.get(ctx.txById.get(d.transaction_id).account_id);
      const row = complaint(ctx, customer, {
        category: 'FRAUD_SCAM',
        dispute_request_id: d.id,
        transaction_id: d.transaction_id,
        received_at: iso(past(at(toDate(d.requested_at), 30))),
        description:
          'How could someone change my phone number and empty my account without the bank noticing?',
      });
      settleComplaint(ctx, row, account, {
        outcome: 'PARTIALLY_UPHELD',
        rootCause: 'FRAUD',
        compensate: 50,
      });
    });
  recallComplaint(ctx);
}

const SERVICE_COMPLAINTS = [
  [
    'ACCOUNT_ACCESS',
    'My account was locked for two days after a failed login and nobody called me back.',
    'SYSTEM_ERROR',
    'UPHELD',
    30,
  ],
  [
    'ACCOUNT_ACCESS',
    'I cannot log in since I changed phones.',
    'UNCLEAR_INFORMATION',
    'UPHELD',
    null,
  ],
  [
    'CUSTOMER_SERVICE',
    'I waited 40 minutes on the phone to block my card.',
    'PROCESS_ERROR',
    'UPHELD',
    20,
  ],
  [
    'CUSTOMER_SERVICE',
    'The adviser was rude when I asked about my overdraft.',
    'STAFF_ERROR',
    'PARTIALLY_UPHELD',
    null,
  ],
  ['TRANSFER', 'My instant transfer took a whole day to arrive.', 'THIRD_PARTY', 'REJECTED', null],
  ['DIRECT_DEBIT', 'A direct debit was taken twice this month.', 'THIRD_PARTY', 'REJECTED', null],
];

function serviceComplaints(ctx) {
  const pool = ctx.rows.customers.filter(
    c => c.status === 'ACTIVE' && c.customer_type === 'RETAIL',
  );
  const accountOf = customer =>
    (ctx.accountsOf.get(customer.id) || []).find(
      a => a.status === 'ACTIVE' && a.type !== 'SAVINGS',
    );
  // A complaint paid back goes to a customer with an account old enough for it to be settled.
  const settles = c => accountOf(c) && ago(toDate(accountOf(c).opened_at)) > 160;
  SERVICE_COMPLAINTS.forEach(([category, description, rootCause, outcome, compensate], k) => {
    const drawn = between(0, pool.length - 1);
    const fits = i => !compensate || settles(pool[i]);
    const index = [...pool.keys()].map(i => (drawn + i) % pool.length).find(fits) ?? drawn;
    const customer = pool.splice(index, 1)[0];
    const account = accountOf(customer);
    let received =
      k < 2 ? past(withTime(daysAgo(between(1, 6)))) : past(withTime(daysAgo(between(15, 150))));
    // Never before the customer had the account the complaint is about.
    if (account) received = past(later(received, at(toDate(account.opened_at), 72)));
    const row = complaint(ctx, customer, { category, description, received_at: iso(received) });
    settleComplaint(ctx, row, account, { outcome, rootCause, compensate });
  });
}

/**
 * Every movement of every case, with its role: the payment disputed, then what the case booked.
 * A row names all the cases it belongs to (the dispute request and where it was routed).
 */
function disputeMoves(ctx) {
  const { rows } = ctx;
  const byKey = new Map();

  const add = (transactionId, role, links) => {
    const key = `${transactionId}|${role}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        id: uuid(),
        transaction_id: transactionId,
        role,
        dispute_request_id: null,
        chargeback_id: null,
        sepa_dispute_id: null,
      });
    }

    const row = byKey.get(key);
    Object.entries(links).forEach(([k, v]) => {
      if (v) row[k] = v;
    });
  };

  rows.dispute_requests.forEach(d =>
    add(d.transaction_id, 'DISPUTED', { dispute_request_id: d.id }),
  );
  rows.chargebacks.forEach(c =>
    add(c.transaction_id, 'DISPUTED', {
      chargeback_id: c.id,
      dispute_request_id: c.dispute_request_id,
    }),
  );
  rows.sepa_disputes.forEach(s =>
    add(s.transaction_id, 'DISPUTED', {
      sepa_dispute_id: s.id,
      dispute_request_id: s.dispute_request_id,
    }),
  );
  ctx.moves.forEach(({ tx, role, dispute, chargeback: cb, sepa }) =>
    add(tx.id, role, {
      dispute_request_id: dispute || cb?.dispute_request_id || sepa?.dispute_request_id,
      chargeback_id: cb?.id,
      sepa_dispute_id: sepa?.id,
    }),
  );
  rows.dispute_transactions = [...byKey.values()];
}

// ---- the guided workflows' open cases -------------------------------------------------------------

const frDay = date => date.toLocaleDateString('fr-FR');
const hoursAgo = hours => past(at(NOW, -hours));
const md5 = text => createHash('md5').update(text).digest('hex');
// `hour` UTC, `days` before today: the guided cases' payments fall on the same day every build.
const dayAt = (days, hour) => new Date(TODAY.getTime() - days * DAY + hour * 3600000);

/** When a guided case's payment was made: a fixed hour of a fixed day, by merchant. */
const payDate = pay =>
  dayAt(
    pay.daysAgo,
    pay.hour ?? 11 + (parseInt(md5(pay.merchant || pay.payee).slice(0, 2), 16) % 8),
  );

/**
 * The customer's current account and a card valid on `date` (still active today when `active`: a
 * fraud case blocks it), or nothing.
 */
function walletOf(ctx, customer, date, active) {
  const account = ctx.rows.accounts.find(
    a => a.customer_id === customer.id && a.type === 'CURRENT' && a.status === 'ACTIVE',
  );
  const card =
    account &&
    ctx.rows.cards.find(
      c =>
        c.account_id === account.id &&
        toDate(c.issued_at) < date &&
        new Date(c.expires_at) > date &&
        (active ? c.status === 'ACTIVE' : !c.blocked_at || toDate(c.blocked_at) > date),
    );

  return card ? { account, card } : null;
}

/** A merchant of the bank's card network, by name: its counterparty and its acquirer row. */
function merchantNamed(ctx, name) {
  const party = ctx.rows.counterparties.find(
    c => c.counterparty_type === 'CARD_MERCHANT' && c.name === name,
  );
  const merchant = party && ctx.rows.card_merchants.find(m => m.counterparty_id === party.id);

  return merchant ? { party, merchant } : null;
}

/** A line written into a statement after the fact: the balances after it move with it. */
function addToStatement(ctx, account, tx) {
  rebalance(ctx, account);
  ctx.rows.transactions.push(tx);
  ctx.txOf.get(account.id).push(tx);
  ctx.txById.set(tx.id, tx);
  rebalance(ctx, account);
}

/** A card payment of a guided case, cleared the next day and settled the day after. */
function cardPayment(ctx, { account, card }, pay) {
  const { party, merchant } = merchantNamed(ctx, pay.merchant);
  const date = payDate(pay);
  // Cleared the next day, or by now when that is still to come (a payment made yesterday morning).
  const cleared = past(at(date, 20));
  const settled = at(cleared, 24);
  const tx = transactionRow(account, {
    rail: 'CARD',
    direction: 'DEBIT',
    amount: pay.amount,
    category: merchant.category,
    counterparty_id: party.id,
    initiated_by_id: card.holder_id,
    description: `CB ${party.name.toUpperCase()} ${merchant.city.toUpperCase()}`,
    created_at: iso(date),
    booked_at: iso(cleared),
    value_date: isoDate(cleared),
  });
  const detail = {
    id: uuid(),
    transaction_id: tx.id,
    card_id: card.id,
    merchant_id: merchant.id,
    type: 'PURCHASE',
    authorization_code: digits(6),
    entry_mode: pay.mode,
    is_3ds: pay.mode === 'ONLINE' && Boolean(pay.secure),
    country: party.country,
    original_amount: pay.amount,
    original_currency: 'EUR',
    exchange_rate: null,
    wallet_type: null,
    city: merchant.city.toUpperCase(),
    authorized_at: iso(date),
    decline_reason: null,
    cleared_at: iso(cleared),
    settled_at: settled < NOW ? iso(settled) : null,
    acquirer_reference_number: digits(23),
    status: settled < NOW ? 'SETTLED' : 'CLEARED',
  };
  ctx.rows.card_transactions.push(detail);
  ctx.cardOf.set(tx.id, detail);
  addToStatement(ctx, account, tx);

  return tx;
}

/** A transfer of a guided case, to a payee added for it, approved in the app. */
function transferPayment(ctx, { account }, pay) {
  const customer = ctx.customers.get(account.customer_id);
  const date = dayAt(pay.daysAgo, 9);
  const party = {
    id: uuid(),
    counterparty_type: 'SCT_BENEFICIARY',
    name: pay.payee,
    country: 'FR',
    risk_level: 'LOW',
    is_blocked: false,
    first_seen_at: iso(at(date, -0.2)),
    last_screened_at: iso(at(date, -0.2)),
    blocked_at: null,
    block_reason: null,
  };
  ctx.rows.counterparties.push(party);
  ctx.parties.set(party.id, party);
  const payee = {
    id: uuid(),
    counterparty_id: party.id,
    customer_id: customer.id,
    added_from_device_id: null,
    ...otherBankAccount(),
    nickname: null,
    is_saved: false,
    payee_check: 'MATCH',
    payee_check_name: null,
    is_trusted: false,
    added_at: iso(at(date, -0.1)),
    removed_at: null,
    last_used_at: iso(date),
  };
  ctx.rows.sct_beneficiaries.push(payee);
  ctx.payees.set(payee.id, payee);
  const holder = ctx.holderOf(customer);
  const device = ctx.rows.devices.find(d => d.individual_id === holder?.id && !d.revoked_at);
  const tx = transactionRow(account, {
    rail: 'TRANSFER',
    direction: 'DEBIT',
    amount: pay.amount,
    category: 'TRANSFERS',
    counterparty_id: party.id,
    initiated_by_id: holder?.id || null,
    device_id: device?.id || null,
    description: `VIR SEPA ${pay.payee.toUpperCase()}`,
    reference: pay.remittance,
    created_at: iso(date),
    booked_at: iso(date),
    value_date: isoDate(date),
  });
  const detail = {
    id: uuid(),
    transaction_id: tx.id,
    beneficiary_id: payee.id,
    scheme: 'SEPA',
    initiated_via: 'BANKING_APP',
    end_to_end_id: `E2E${md5(tx.id).slice(0, 13).toUpperCase()}`,
    payee_check: 'MATCH',
    validation_status: 'NOT_REQUIRED',
    validated_by: null,
    validated_at: null,
    requested_execution_date: isoDate(date),
    rejection_reason: null,
    sca_method: 'APP_CONFIRMATION',
    purpose_code: null,
    is_standing_order: false,
  };
  payee.added_from_device_id = device?.id || null;
  ctx.rows.outgoing_transfers.push(detail);
  ctx.outOf.set(tx.id, detail);
  addToStatement(ctx, account, tx);

  return tx;
}

/**
 * A card blocked at `blocked` (stolen, or a fraud claim routed): what was paid with it afterwards
 * becomes attempts declined because the card is blocked. The balances follow.
 */
function stolenCard(ctx, card, blocked, reason = 'STOLEN') {
  Object.assign(card, { status: 'BLOCKED', blocked_reason: reason, blocked_at: iso(blocked) });
  const account = ctx.accounts.get(card.account_id);
  ctx.rows.card_transactions
    .filter(c => c.card_id === card.id && toDate(c.authorized_at) > blocked)
    .forEach(c => {
      const tx = ctx.txById.get(c.transaction_id);

      // A payment still pending held money aside: it is free again.
      if (tx.status === 'PENDING') {
        ctx.waiting.set(account.id, round2(ctx.waiting.get(account.id) - Number(tx.amount)));
      }

      Object.assign(c, {
        status: 'DECLINED',
        decline_reason: 'CARD_BLOCKED',
        cleared_at: null,
        settled_at: null,
        acquirer_reference_number: null,
      });
      Object.assign(tx, {
        status: 'REJECTED',
        status_reason: 'Card blocked',
        booked_at: null,
        value_date: null,
        balance_after: null,
      });
    });
  rebalance(ctx, account);
}

/** A claim filed today, a few hours ago, waiting in "New disputes". */
function newClaim(ctx, tx, fields) {
  const dispute = disputeRequest(ctx, tx, {
    requested_at: iso(hoursAgo(between(1, 5))),
    channel: 'APP',
    ...fields,
  });
  disputeHistory(ctx, dispute);

  return dispute;
}

/** A card claim routed to a chargeback `days` ago, at a fixed time of day. */
function routedClaim(ctx, tx, days, fields, options) {
  const requested = past(dayAt(days, 9.5));
  const dispute = disputeRequest(ctx, tx, {
    requested_at: iso(requested),
    channel: 'APP',
    ...fields,
  });
  const routed = route(dispute, 'CHARGEBACK', op('disputes'));

  // A fraud claim: the intake desk blocks the card when it routes it (card processor).
  if (dispute.reason === 'UNAUTHORIZED') {
    stolenCard(ctx, ctx.cards.get(ctx.cardOf.get(tx.id).card_id), at(routed, 0.01), 'FRAUD');
  }

  chargeback(ctx, tx, dispute, {
    source: 'CUSTOMER_REQUEST',
    requested,
    fraud: dispute.reason === 'UNAUTHORIZED',
    ...options,
  });
  disputeHistory(ctx, dispute);
}

/** The customer wrote to the merchant `days` after paying. */
const wroteAfter = (tx, days) => iso(at(toDate(tx.created_at), days * 24 + 3));

/**
 * One open case per path of the guided Dispute intake, Chargeback and Merchant answered workflows:
 * the payment written for it, and the case on top. The payment is the same on every build (merchant,
 * amount, day); so is the customer, the first by a hash of the case and the customer id.
 */
const GUIDED_CASES: [string, any, (ctx, tx) => any][] = [
  // Dispute intake (New disputes).
  [
    'card fraud → chargeback',
    { merchant: 'OVHcloud', amount: 89.99, daysAgo: 12, mode: 'ONLINE', active: true },
    (ctx, tx) =>
      newClaim(ctx, tx, {
        reason: 'UNAUTHORIZED',
        reason_detail:
          'I do not recognise this online payment to OVHcloud: I have no account there. My card is still with me.',
      }),
  ],
  [
    'wrong amount → SEPA dispute',
    {
      transfer: true,
      payee: 'Atelier Plomberie Roux',
      amount: 1250,
      daysAgo: 2,
      remittance: 'FACTURE 2026-118',
    },
    (ctx, tx) =>
      newClaim(ctx, tx, {
        reason: 'WRONG_AMOUNT',
        reason_detail:
          'I paid the plumber 1 250,00 EUR instead of 125,00 EUR for invoice 2026-118: one zero too many.',
      }),
  ],
  [
    'merchant not contacted → merchant first',
    { merchant: 'Decathlon', amount: 149.9, daysAgo: 16, mode: 'ONLINE', secure: true },
    (ctx, tx) =>
      newClaim(ctx, tx, {
        reason: 'ITEM_NOT_RECEIVED',
        reason_detail: `Ordered a tent on Decathlon on ${frDay(
          toDate(tx.created_at),
        )}, still not delivered.`,
      }),
  ],
  [
    'past 120 days → not eligible',
    { merchant: 'Zara', amount: 79.95, daysAgo: 138, mode: 'ONLINE', secure: true },
    (ctx, tx) =>
      newClaim(ctx, tx, {
        reason: 'CANCELLED_ORDER',
        reason_detail: 'I sent the coat back to Zara within the 14 days and was never refunded.',
        merchant_contacted_at: wroteAfter(tx, 9),
      }),
  ],
  [
    'stolen card, contactless → bank refund',
    // Paid with the stolen card before the customer blocked it in the app.
    {
      merchant: 'Boulangerie Paul',
      amount: 23.4,
      daysAgo: 1,
      hour: 7,
      mode: 'CONTACTLESS',
      active: true,
    },
    (ctx, tx) => {
      const blocked = at(toDate(tx.created_at), 1.5);
      newClaim(ctx, tx, {
        reason: 'UNAUTHORIZED',
        channel: 'PHONE',
        reason_detail: `My wallet was stolen yesterday morning. I blocked my card in the app at ${blocked.toLocaleTimeString(
          'fr-FR',
          { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' },
        )}, but this contactless payment at Boulangerie Paul went through before.`,
      });
      stolenCard(ctx, ctx.cards.get(ctx.cardOf.get(tx.id).card_id), blocked);
    },
  ],
  // Chargeback (Chargebacks to file).
  [
    'fraud chargeback → block the card, file',
    { merchant: 'Google Workspace', amount: 138, daysAgo: 9, mode: 'ONLINE', active: true },
    (ctx, tx) =>
      routedClaim(
        ctx,
        tx,
        3,
        {
          reason: 'UNAUTHORIZED',
          reason_detail: 'I do not recognise this online payment to Google Workspace.',
        },
        { stage: 'INITIATED', answered: true },
      ),
  ],
  [
    'evidence missing → ask the cardholder',
    { merchant: 'IKEA', amount: 349, daysAgo: 21, mode: 'ONLINE', secure: true },
    (ctx, tx) =>
      routedClaim(
        ctx,
        tx,
        2,
        {
          reason: 'CANCELLED_ORDER',
          reason_detail:
            'I cancelled the wardrobe order with IKEA two days after paying and was never refunded.',
          merchant_contacted_at: wroteAfter(tx, 2),
        },
        { stage: 'INITIATED', quiet: true },
      ),
  ],
  [
    'small amount → accept',
    { merchant: 'Spotify', amount: 11.99, daysAgo: 15, mode: 'ONLINE' },
    (ctx, tx) =>
      routedClaim(
        ctx,
        tx,
        3,
        {
          reason: 'CANCELLED_RECURRING',
          reason_detail: 'I cancelled my Spotify subscription last month and was still charged.',
          merchant_contacted_at: wroteAfter(tx, 1),
        },
        { stage: 'INITIATED', answered: true },
      ),
  ],
  [
    'evidence complete → file',
    { merchant: 'Fnac', amount: 229.99, daysAgo: 24, mode: 'ONLINE', secure: true },
    (ctx, tx) =>
      routedClaim(
        ctx,
        tx,
        3,
        {
          reason: 'ITEM_NOT_RECEIVED',
          reason_detail: 'Ordered headphones on Fnac, never delivered, and they no longer answer.',
          merchant_contacted_at: wroteAfter(tx, 8),
        },
        { stage: 'INITIATED', answered: true },
      ),
  ],
  // Merchant answered.
  [
    'cancelled in time → push back',
    { merchant: 'Sephora', amount: 118.5, daysAgo: 55, mode: 'ONLINE', secure: true },
    (ctx, tx) =>
      routedClaim(
        ctx,
        tx,
        36,
        {
          reason: 'CANCELLED_ORDER',
          reason_detail:
            'I cancelled my Sephora order four days after paying and was never refunded.',
          merchant_contacted_at: wroteAfter(tx, 4),
        },
        { stage: 'REPRESENTED' },
      ),
  ],
  [
    'signed proof of delivery → accept',
    { merchant: 'Amazon', amount: 189.99, daysAgo: 52, mode: 'ONLINE', secure: true },
    (ctx, tx) =>
      routedClaim(
        ctx,
        tx,
        36,
        {
          reason: 'ITEM_NOT_RECEIVED',
          reason_detail:
            'Ordered a coffee machine on Amazon, never delivered, and they no longer answer.',
          merchant_contacted_at: wroteAfter(tx, 10),
        },
        { stage: 'REPRESENTED' },
      ),
  ],
];

// How far below its overdraft limit an account may dip.
const OVERDRAFT_MARGIN = 90;

/**
 * The open cases the guided disputes workflows play on, one per path, written first so the other
 * disputes never take their customers (ctx.reserved). Active retail customers outside the stories,
 * ranked by a hash of the case: the same customer gets the same case on every build. Drawn from a
 * stream of their own, so the random draws of the rest of the data do not move.
 */
function guidedCases(ctx) {
  // Customers who earn more than they spend: their balance takes the payment on any day.
  const eligible = ctx.rows.customers.filter(
    c =>
      c.customer_type === 'RETAIL' &&
      c.status === 'ACTIVE' &&
      !ctx.stories?.has(c.id) &&
      Number(c.expected_monthly_in) >= 2500 &&
      Number(c.expected_monthly_in) > Number(c.expected_monthly_out) * 1.1,
  );
  GUIDED_CASES.forEach(([key, pay, open]) => {
    const date = payDate(pay);
    const customer = eligible
      .filter(c => !ctx.reserved.has(c.id))
      .sort((a, b) => (md5(`${key}:${a.id}`) < md5(`${key}:${b.id}`) ? -1 : 1))
      .find(c => {
        const wallet = walletOf(ctx, c, date, pay.active);

        return wallet && spendable(ctx, wallet.account, date) + OVERDRAFT_MARGIN > pay.amount;
      });
    if (!customer) return;
    ctx.reserved.add(customer.id);
    withStream(`guided dispute: ${key}`, () => {
      const wallet = walletOf(ctx, customer, date, pay.active);
      const tx = pay.transfer ? transferPayment(ctx, wallet, pay) : cardPayment(ctx, wallet, pay);
      ctx.used.add(tx.id);
      open(ctx, tx);
    });
  });
}

// ---- putting it together ------------------------------------------------------------------------

/**
 * Money that left an account after a fraud recall held it (a mistaken credit sent back): the
 * recall holds keep only what is still there, the latest hold trimmed first.
 */
function trimRecallHolds(ctx) {
  const recalls = ctx.rows.holds.filter(
    h => h.status === 'ACTIVE' && h.reason === 'FRAUD' && h.sepa_dispute_id,
  );
  new Set(recalls.map(h => h.account_id)).forEach(id => {
    const account = ctx.accounts.get(id);
    const ours = recalls
      .filter(h => h.account_id === id)
      .sort((a, b) => (a.placed_at < b.placed_at ? 1 : -1));
    let over = round2(Math.max(0, -Number(account.available_balance)));
    const held = ctx.rows.holds
      .filter(h => h.account_id === id && h.status === 'ACTIVE')
      .reduce((sum, h) => sum + Number(h.amount), 0);
    over = round2(Math.max(over, held - Math.max(Number(account.balance), 0)));
    if (over <= 0) return;
    ours.forEach(h => {
      const cut = Math.min(over, Number(h.amount));
      h.amount = round2(Number(h.amount) - cut);
      over = round2(over - cut);
    });
    rebalance(ctx, account);
  });
}

function disputes(ctx) {
  WAVE_C.forEach(t => {
    ctx.rows[t] = [];
  });
  ledger(ctx);
  indexes(ctx);
  guidedCases(ctx);
  storyDisputes(ctx);
  cardDisputes(ctx);
  doubtedClaims(ctx);
  repeatedDisputes(ctx);
  directDebitRefunds(ctx);
  mistakenTransfers(ctx);
  takeoverRecall(ctx);
  muleRecalls(ctx);
  mistakenCredits(ctx);
  investigationHolds(ctx);
  feeComplaints(ctx);
  caseComplaints(ctx);
  serviceComplaints(ctx);
  repeatRule(ctx);
  sanctionsFreeze(ctx);
  trimRecallHolds(ctx);
  disputeMoves(ctx);
  numberReferences(ctx.rows.dispute_requests, 'DSP', 'requested_at');
  numberReferences(ctx.rows.chargebacks, 'CBK', 'created_at');
  numberReferences(ctx.rows.sepa_disputes, 'SEP', 'requested_at');
  numberReferences(ctx.rows.holds, 'HLD', 'placed_at');
  // The reference draws of the holds no longer placed (holdNoMore).
  for (let k = 0; k < (ctx.holdsNoMore || 0); k += 1) between(1, 9);
  numberReferences(ctx.rows.complaints, 'CMP', 'received_at');
}

export {
  disputes,
  // For the desks' history (desk-history.ts), which writes more cases the same way.
  FINAL,
  ONLINE_SHOPS,
  applyRounds,
  cardReasons,
  chargebackHistory,
  closeDispute,
  deadline,
  disputeHistory,
  disputeRequest,
  indexes,
  move,
  provisionalCredit,
  wonRefund,
  reasonCode,
  sepaDispute,
  sepaHistory,
};
