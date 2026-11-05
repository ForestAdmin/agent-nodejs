/**
 * What a disputes agent reads before routing a dispute request, as fields of the request: a
 * workflow "read" step only shows fields of one record, so the agent writes each piece of the case
 * as one short text. The dispute, the payment disputed, its eligibility checked against the rules
 * (time to claim, merchant first, earlier disputes, the PSD2 refund by the next business day), the
 * route those rules suggest, and once routed, where it went and the money given back.
 */
import type { RecordData } from '@forestadmin/datasource-toolkit';

import { ConditionTreeFactory, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import { reader } from '../shared/case-file';
import { PROVIDERS } from '../shared/providers';

const DAY = 24 * 3600 * 1000;
const OK = '✓';
const LOOK = '⚠';
const BAD = '✗';

// [Visa code, Visa label, Mastercard code, Mastercard label], as in disputes.ts.
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
const FRAUD_CODES = ['10.3', '10.4', '4837', '4863'];
const SEPA_CODES = {
  CUSTOMER_REQUEST: 'MD06',
  UNAUTHORISED: 'MD01',
  WRONG_IBAN: 'AC03',
  WRONG_AMOUNT: 'AM09',
  FRAUD: 'FRAD',
  DUPLICATE: 'DUPL',
  TECHNICAL: 'TECH',
};
const SEPA_REASONS = {
  NO_MANDATE: 'UNAUTHORISED',
  MANDATE_REVOKED: 'UNAUTHORISED',
  UNAUTHORIZED: 'UNAUTHORISED',
  WRONG_BENEFICIARY: 'WRONG_IBAN',
  WRONG_AMOUNT: 'WRONG_AMOUNT',
  DUPLICATE_CHARGE: 'DUPLICATE',
  SCAM: 'FRAUD',
};
// Order problems: the card rules want the customer to ask the merchant first.
const MERCHANT_REASONS = [
  'ITEM_NOT_RECEIVED',
  'CANCELLED_ORDER',
  'CANCELLED_RECURRING',
  'SERVICE_NOT_RENDERED',
];
const UNAUTHORISED = ['UNAUTHORIZED', 'NO_MANDATE', 'MANDATE_REVOKED'];
const CARD_DAYS = 120;
const SDD_DAYS = 56;
const THIRTEEN_MONTHS = 395;

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const zone = { timeZone: 'Europe/Paris' };
const frDate = d => (d ? new Date(d).toLocaleDateString('fr-FR', zone) : 'no date');
const stamp = d =>
  new Date(d).toLocaleString('fr-FR', { ...zone, dateStyle: 'short', timeStyle: 'short' });
const euros = n => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`;
const label = code => (code ? code.replace(/_/g, ' ').toLowerCase() : '');
const daysBetween = (from, to) =>
  Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const NETWORKS = { VISA: 'Visa', MASTERCARD: 'Mastercard' };
const REASON_WORDS = {
  UNAUTHORIZED: 'unauthorised payment',
  DUPLICATE_CHARGE: 'charged twice',
  CANCELLED_ORDER: 'cancelled order',
  CANCELLED_RECURRING: 'charged after cancelling a subscription',
  ITEM_NOT_RECEIVED: 'item not received',
  SERVICE_NOT_RENDERED: 'service not provided',
  WRONG_BENEFICIARY: 'wrong payee',
  WRONG_AMOUNT: 'wrong amount',
  NO_MANDATE: 'no mandate signed',
  MANDATE_REVOKED: 'mandate revoked',
  SCAM: 'scam',
};
const reasonWords = reason => REASON_WORDS[reason] || label(reason);
const capital = text => text.replace(/^./, c => c.toUpperCase());
const town = city =>
  city ? city.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase()) : '?';

/** The end of the next business day after `date`: when an unauthorised payment must be refunded. */
function nextBusinessDay(date) {
  const d = new Date(date);
  do d.setTime(d.getTime() + DAY);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  d.setUTCHours(21, 59, 59, 0);

  return d;
}

/** The network's code for a dispute reason on a card, or null. */
function cardCode(network, reason) {
  const codes = REASON_CODES[reason === 'SCAM' ? 'UNAUTHORIZED' : reason];
  if (!codes) return null;
  const [visa, visaLabel, mc, mcLabel] = codes;

  return network === 'VISA' ? [visa, visaLabel] : [mc, mcLabel];
}

const DISPUTE_FIELDS = [
  'id',
  'reference',
  'customer_id',
  'transaction_id',
  'card_transaction_id',
  'direct_debit_id',
  'outgoing_transfer_id',
  'reason',
  'reason_detail',
  'amount',
  'payment_type',
  'requested_at',
  'channel',
  'created_by',
  'support_ticket_ref',
  'merchant_contacted_at',
  'status',
  'route',
  'routed_at',
  'closed_at',
  'resolution_notes',
  'bdf_notified_at',
];

/** One row by id, or null. The agent's own tables only: links are not there yet at this stage. */
async function rowOf(list, table, id, fields) {
  if (!id) return null;
  const [row] = await list(table, [eq('id', id)], fields);

  return row || null;
}

/** The payment disputed, with what each rail says about it. */
async function paymentOf(list, d) {
  const tx = await rowOf(list, 'transactions', d.transaction_id, [
    'id',
    'created_at',
    'booked_at',
    'device_id',
    'counterparty_id',
  ]);
  const party = await rowOf(list, 'counterparties', tx?.counterparty_id, ['name', 'country']);
  const payment: { tx; party; country; card?; transfer?; debit?; wero?; device? } = {
    tx,
    party: party?.name || 'unknown',
    country: party?.country,
  };
  const card = await rowOf(list, 'card_transactions', d.card_transaction_id, [
    'entry_mode',
    'is_3ds',
    'wallet_type',
    'city',
    'country',
    'card_id',
    'merchant_id',
  ]);

  if (card) {
    payment.card = {
      ...card,
      card: await rowOf(list, 'cards', card.card_id, [
        'id',
        'network',
        'last_four_digits',
        'status',
        'blocked_at',
        'blocked_reason',
      ]),
      merchant: await rowOf(list, 'card_merchants', card.merchant_id, ['category']),
    };
  }

  const transfer = await rowOf(list, 'outgoing_transfers', d.outgoing_transfer_id, [
    'scheme',
    'sca_method',
    'payee_check',
    'beneficiary_id',
  ]);

  if (transfer) {
    payment.transfer = {
      ...transfer,
      beneficiary: await rowOf(list, 'sct_beneficiaries', transfer.beneficiary_id, [
        'iban',
        'bank_name',
      ]),
    };
  }

  const debit = await rowOf(list, 'direct_debits', d.direct_debit_id, [
    'mandate_type',
    'mandate_id',
  ]);

  if (debit) {
    payment.debit = {
      ...debit,
      mandate: await rowOf(list, 'mandates', debit.mandate_id, ['mandate_reference', 'signed_at']),
    };
  }

  if (d.payment_type === 'WERO') {
    [payment.wero] = await list(
      'wero_payments',
      [eq('transaction_id', d.transaction_id)],
      ['flow'],
    );
  }

  payment.device = await rowOf(list, 'devices', tx?.device_id, [
    'device_name',
    'is_trusted',
    'first_seen_at',
  ]);

  return payment;
}

// ---- Dispute · ---------------------------------------------------------------------------------

function paymentKind(d, p) {
  if (p.card) {
    const card = p.card.card || {};

    return `Card · ${NETWORKS[card.network] || 'card'} •••• ${card.last_four_digits || '????'}`;
  }

  return {
    TRANSFER: 'SEPA transfer',
    INSTANT_TRANSFER: 'SEPA Instant transfer',
    WERO: 'Wero (settled over SEPA Instant)',
    DIRECT_DEBIT: `SEPA direct debit (${p.debit?.mandate_type === 'B2B' ? 'B2B' : 'Core'} mandate)`,
  }[d.payment_type];
}

function disputeFields(d, p) {
  const self = ['APP', 'WEB'].includes(d.channel);
  const paidOn = p.tx
    ? `, ${plural(daysBetween(p.tx.created_at, d.requested_at), 'day')} after the payment`
    : '';

  return {
    dispute_reason: `${capital(reasonWords(d.reason))}: "${d.reason_detail}"`,
    dispute_amount: euros(d.amount),
    dispute_payment: paymentKind(d, p),
    dispute_date: `${stamp(d.requested_at)}${paidOn}`,
    dispute_channel: self
      ? `${d.channel === 'APP' ? 'In the app' : 'On the website'}, filed by the customer`
      : `${
          d.channel === 'PHONE' ? 'On the phone' : `By ${label(d.channel)}`
        }, logged by support (ticket ${d.support_ticket_ref || 'none'})`,
  };
}

// ---- Payment · ---------------------------------------------------------------------------------

const ENTRY = {
  CHIP: 'Chip and PIN at the terminal',
  CONTACTLESS: 'Contactless at the terminal, no PIN',
  MOBILE_WALLET: 'Phone wallet, approved on the phone',
  ONLINE: 'Online',
};
// How a card payment was made, inside a sentence.
const PAID = {
  CHIP: 'paid with chip and PIN',
  CONTACTLESS: 'paid contactless, without PIN',
  MOBILE_WALLET: 'paid with a phone wallet',
  ONLINE: 'approved online with 3-D Secure',
};
const WALLETS = { APPLE_PAY: 'Apple Pay', GOOGLE_PAY: 'Google Pay', SAMSUNG_PAY: 'Samsung Pay' };
const SCA = {
  APP_CONFIRMATION: 'confirmed in our app (strong authentication)',
  SMS_OTP: 'confirmed with a code by SMS (strong authentication)',
  BIOMETRIC: 'confirmed with Face ID or fingerprint (strong authentication)',
  EXEMPTED: 'no strong authentication (exempted: saved payee)',
};

function cardAuthentication(d, card) {
  if (card.entry_mode !== 'ONLINE') return `○ ${ENTRY[card.entry_mode]}`;
  // Who bears a fraud: what matters on an unauthorised claim only.
  const fraud = ['UNAUTHORIZED', 'SCAM'].includes(d.reason);

  if (card.is_3ds) {
    return `○ Online, approved with 3-D Secure in our app${
      fraud ? ': the liability moved to us' : ''
    }`;
  }

  return `○ Online, without 3-D Secure${fraud ? ': the merchant kept the liability' : ''}`;
}

function authentication(d, p) {
  if (p.card) return cardAuthentication(d, p.card);

  if (p.transfer) {
    const check = {
      MATCH: 'name matched',
      CLOSE_MATCH: 'name close',
      NO_MATCH: 'name did not match',
    };

    return `○ ${capital(SCA[p.transfer.sca_method] || 'confirmed in our app')}; payee check: ${
      check[p.transfer.payee_check] || 'not possible'
    }`;
  }

  if (p.debit) {
    const signed = p.debit.mandate?.signed_at
      ? `, signed ${frDate(p.debit.mandate.signed_at)}`
      : '';

    return `○ No authentication: collected under mandate ${
      p.debit.mandate?.mandate_reference || '?'
    }${signed}`;
  }

  return '○ Confirmed in the Wero app (strong authentication)';
}

function device(d, p) {
  if (p.card) {
    const card = p.card.card || {};
    const blocked =
      card.status === 'BLOCKED'
        ? `card blocked (${label(card.blocked_reason)}) on ${stamp(card.blocked_at)}`
        : `card ${label(card.status)}`;
    const where =
      p.card.entry_mode === 'ONLINE'
        ? 'Card details typed on the merchant’s website'
        : `${WALLETS[p.card.wallet_type] || 'Card terminal'} in ${town(p.card.city)} (${
            p.card.country || '?'
          })`;

    return `${where} · ${blocked}`;
  }

  if (!p.device) return p.debit ? 'None: the creditor collects the debit' : 'Not recorded';
  const known = p.device.is_trusted ? 'trusted' : 'not trusted';

  return `${p.device.device_name}, ${known}, used since ${frDate(p.device.first_seen_at)}`;
}

function paymentFields(d, p) {
  const where = p.country ? ` (${p.country})` : '';
  const party = p.transfer
    ? `${p.party}${where} · IBAN ${p.transfer.beneficiary?.iban || '?'}, ${
        p.transfer.beneficiary?.bank_name || 'other bank'
      }`
    : `${p.party}${where}${
        p.card?.merchant?.category ? ` · ${label(p.card.merchant.category)}` : ''
      }`;

  return {
    payment_party: party,
    payment_date: p.tx
      ? `Paid ${stamp(p.tx.created_at)}${
          p.tx.booked_at ? `, booked ${frDate(p.tx.booked_at)}` : ''
        }`
      : 'Not found',
    payment_auth: authentication(d, p),
    payment_device: device(d, p),
  };
}

// ---- Eligibility · -----------------------------------------------------------------------------

/** A card payment: 120 days for the network, 13 months for an unauthorised payment (PSD2). */
function cardDeadline(d, days) {
  const since = plural(days, 'day');
  const left = CARD_DAYS - days;

  if (left < 0 && d.reason === 'UNAUTHORIZED') {
    return days > THIRTEEN_MONTHS
      ? {
          ok: false,
          line: `${BAD} ${since} since the payment: past the 13 months to claim an unauthorised payment (PSD2)`,
        }
      : {
          ok: true,
          late: true,
          line: `${LOOK} ${since} since the payment: past the 120 days card networks allow, within the 13 months to claim an unauthorised payment (PSD2)`,
        };
  }

  if (left < 0) {
    return {
      ok: false,
      line: `${BAD} ${since} since the payment: past the 120 days card networks allow`,
    };
  }

  return {
    ok: true,
    line: `${left <= 10 ? LOOK : OK} ${since} since the payment: ${plural(
      left,
      'day',
    )} left of the 120 card networks allow`,
  };
}

/**
 * Time left to claim, by the rules of the payment's rail. `late` marks an unauthorised card payment
 * past the network's 120 days: no chargeback any more, but the customer still has 13 months (L133-24
 * CMF) and the bank still owes the refund.
 */
function deadline(d, p) {
  if (!p.tx) return { ok: false, line: `${BAD} The payment is not on the statement` };
  const days = daysBetween(p.tx.created_at, d.requested_at);
  const since = plural(days, 'day');
  if (d.payment_type === 'CARD') return cardDeadline(d, days);

  if (d.payment_type === 'DIRECT_DEBIT' && !UNAUTHORISED.includes(d.reason)) {
    if (p.debit?.mandate_type === 'B2B') {
      return { ok: false, line: `${BAD} B2B mandate: an authorised debit cannot be refunded` };
    }

    if (days > SDD_DAYS) {
      return {
        ok: false,
        line: `${BAD} ${since} since the debit: past the 8 weeks of a refund without questions`,
      };
    }

    return {
      ok: true,
      line: `${OK} ${since} since the debit: refunded without questions within 8 weeks (SEPA Core), ${plural(
        SDD_DAYS - days,
        'day',
      )} left`,
    };
  }

  if (days > THIRTEEN_MONTHS) {
    return {
      ok: false,
      line: `${BAD} ${since} since the payment: past the 13 months to claim (PSD2)`,
    };
  }

  const what = d.payment_type === 'DIRECT_DEBIT' ? 'debit' : 'payment';

  return {
    ok: true,
    line: `${OK} ${since} since the ${what}: within the 13 months to claim (PSD2)`,
  };
}

const toPerson = (d, p) => (p.transfer && !p.card) || (p.wero && p.wero.flow !== 'ECOMMERCE');

function merchantContact(d, p) {
  if (toPerson(d, p)) {
    return {
      ok: true,
      line: '○ Not needed: a transfer the customer sent, no merchant to ask first',
    };
  }

  if (!MERCHANT_REASONS.includes(d.reason) || !['CARD', 'DIRECT_DEBIT'].includes(d.payment_type)) {
    return { ok: true, line: `○ Not needed for this kind of claim (${reasonWords(d.reason)})` };
  }

  const who = d.payment_type === 'DIRECT_DEBIT' ? 'creditor' : 'merchant';

  if (d.merchant_contacted_at) {
    return {
      ok: true,
      line: `${OK} Yes, on ${frDate(d.merchant_contacted_at)} (${plural(
        Math.max(0, daysBetween(d.merchant_contacted_at, d.requested_at)),
        'day',
      )} before the claim)`,
    };
  }

  return {
    ok: false,
    line: `${BAD} No: for an order problem, the card rules ask the customer to contact the ${who} first`,
  };
}

async function earlierDisputes(list, d) {
  const since = new Date(new Date(d.requested_at).getTime() - 183 * DAY);
  const earlier = (
    await list(
      'dispute_requests',
      [
        eq('customer_id', d.customer_id),
        eq('payment_type', ['CARD', 'DIRECT_DEBIT']),
        new ConditionTreeLeaf('requested_at', 'GreaterThan', since.toISOString()),
        new ConditionTreeLeaf('requested_at', 'LessThan', new Date(d.requested_at).toISOString()),
      ],
      ['reference', 'requested_at', 'status'],
      { field: 'requested_at', ascending: true },
    )
  ).filter(e => e.reference !== d.reference);
  if (!earlier.length) return `${OK} None in the last 6 months`;
  const refs = earlier.map(e => e.reference).join(', ');
  if (earlier.length < 2) return `${OK} 1 earlier in the last 6 months (${refs})`;
  const [signal] = await list(
    'alerts',
    [eq('customer_id', d.customer_id), eq('alert_type', 'REPEATED_DISPUTES')],
    ['reference', 'status'],
  );
  const raised = signal
    ? `, rule FRD-004 raised ${signal.reference} (${label(signal.status)})`
    : ', rule FRD-004 (3 in 6 months)';

  return `${LOOK} ${earlier.length} earlier in the last 6 months (${refs}): this one makes ${
    earlier.length + 1
  }${raised}; check they are genuine`;
}

/** The movements of these rows, oldest first: [role, amount, booked_at]. */
async function booked(list, rows) {
  if (!rows.length) return [];
  const txs = await list(
    'transactions',
    [
      eq(
        'id',
        rows.map(r => r.transaction_id),
      ),
    ],
    ['id', 'amount', 'booked_at'],
  );
  const byId = new Map<string, RecordData>(txs.map(t => [t.id, t]));

  return rows
    .filter(r => byId.has(r.transaction_id))
    .map(r => ({
      role: r.role,
      amount: byId.get(r.transaction_id).amount,
      at: byId.get(r.transaction_id).booked_at,
    }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Money given back on the request or the case it went to: [role, amount, booked_at]. */
async function moneyBack(list, d) {
  const [chargebacks, sepa] = await Promise.all([
    list('chargebacks', [eq('dispute_request_id', d.id)], ['id']),
    list('sepa_disputes', [eq('dispute_request_id', d.id)], ['id']),
  ]);
  const links = [eq('dispute_request_id', d.id)];

  if (chargebacks.length) {
    links.push(
      eq(
        'chargeback_id',
        chargebacks.map(c => c.id),
      ),
    );
  }

  if (sepa.length) {
    links.push(
      eq(
        'sepa_dispute_id',
        sepa.map(s => s.id),
      ),
    );
  }

  const rows = await list(
    'dispute_transactions',
    [
      ConditionTreeFactory.union(...links),
      eq('role', ['PROVISIONAL_CREDIT', 'REFUND', 'CREDIT_REVERSAL']),
    ],
    ['role', 'transaction_id'],
  );

  return booked(list, rows);
}

function refundByNextDay(d, money, now, checks) {
  if (!UNAUTHORISED.includes(d.reason)) {
    return d.reason === 'SCAM'
      ? '○ Not owed: the customer made this payment themselves (a scam), no refund duty under PSD2'
      : `○ Only owed for an unauthorised payment (here: ${reasonWords(d.reason)})`;
  }

  if (!checks.deadline.ok && !money.length) {
    return '○ Not owed: claimed after the 13 months the law gives (PSD2)';
  }

  if (d.bdf_notified_at) {
    return `○ Refused for now: the bank suspects the customer’s own fraud, reasons sent to the Banque de France on ${frDate(
      d.bdf_notified_at,
    )}`;
  }

  const due = nextBusinessDay(d.requested_at);
  const paid = money.find(m => m.role !== 'CREDIT_REVERSAL');

  if (paid) {
    const late = new Date(paid.at) > due;

    return `${late ? BAD : OK} ${euros(paid.amount)} credited on ${stamp(paid.at)}, ${
      late ? 'after' : 'by'
    } the next business day`;
  }

  if (now > due) return `${BAD} Not refunded, it was due by ${frDate(due)}: late (PSD2)`;

  return `${LOOK} Not refunded yet: due by the end of ${frDate(
    due,
  )} (next business day). Routing it books the money.`;
}

const ROUTE_WORDS = {
  CHARGEBACK: 'Card chargeback',
  SEPA_DISPUTE: 'SEPA dispute',
  BANK_REFUND: 'Bank refund',
  CONTACT_MERCHANT: 'Merchant first',
  DECLINED: 'Not eligible',
};

/** A card payment: the network's claim, or the bank's refund when the merchant cannot be charged. */
function cardRoute(d, card, late) {
  // Too late for the network, still owed by the bank: an unauthorised payment within 13 months.
  if (late) {
    return [
      '✓ Bank refund',
      'past the network’s 120 days, the bank refunds by the next business day (PSD2) and bears the loss',
    ];
  }

  const network = card.card?.network;
  const [code, codeLabel] = cardCode(network, d.reason) || [];

  if (!['UNAUTHORIZED', 'SCAM'].includes(d.reason)) {
    if (!code) {
      return ['✗ Not eligible', `no card network reason code for ${reasonWords(d.reason)}`];
    }

    return ['✓ Card chargeback', `${NETWORKS[network]} ${code} · ${codeLabel}`];
  }

  if (card.entry_mode === 'ONLINE' && !card.is_3ds) {
    return [
      '✓ Card chargeback',
      `fraud code ${code}, the merchant kept the liability (online, no 3-D Secure)`,
    ];
  }

  const how = PAID[card.entry_mode] || 'authenticated';
  const excess =
    card.entry_mode === 'CONTACTLESS' ? ' in full (no 50 EUR excess without a PIN)' : '';

  return [
    '✓ Bank refund',
    `${how}, so no chargeback right; the bank refunds${excess} by the next business day (PSD2) and bears the loss`,
  ];
}

/** A direct debit, a transfer or a Wero payment: what the SEPA rules allow. */
function sepaRoute(d) {
  // Unauthorised: the customer is refunded by the next business day whatever the other bank says.
  const owed = UNAUTHORISED.includes(d.reason)
    ? '; routing it refunds the customer now (PSD2, by the next business day)'
    : '';

  if (d.payment_type === 'DIRECT_DEBIT') {
    const code = SEPA_CODES[SEPA_REASONS[d.reason] || 'CUSTOMER_REQUEST'];

    return [
      '✓ SEPA dispute',
      `refund of the direct debit (${code}) through the ${PROVIDERS.sepa}${owed}`,
    ];
  }

  const reason = SEPA_REASONS[d.reason];

  if (['WRONG_AMOUNT', 'WRONG_IBAN'].includes(reason)) {
    return [
      '✓ SEPA dispute',
      `request for recall (${SEPA_CODES[reason]}) to the payee’s bank; the payee must agree to return it`,
    ];
  }

  if (reason === 'UNAUTHORISED') {
    return [
      '✓ SEPA dispute',
      `recall for fraud (FRAD) to the payee’s bank${owed}, and the bank keeps what the recall brings back`,
    ];
  }

  if (reason === 'FRAUD') {
    return [
      '✓ SEPA dispute',
      'recall for fraud (FRAD) to the payee’s bank, which returns what is left; no refund owed: the customer made the payment',
    ];
  }

  return [
    '✗ Not eligible',
    `a ${label(d.payment_type)} the customer made cannot be taken back for ${reasonWords(
      d.reason,
    )}: only the payee can refund it`,
  ];
}

/** The route the rules point to: [symbol and route name, why]. */
function suggestRoute(d, p, checks) {
  if (!checks.deadline.ok) {
    return ['✗ Not eligible', checks.deadline.line.slice(2).replace(': ', ', ')];
  }

  if (!checks.merchant.ok) {
    return [
      '⚠ Merchant first',
      `${p.party} was not contacted; the customer asks them first and comes back if they do not answer within 15 days`,
    ];
  }

  if (d.payment_type === 'CARD') return cardRoute(d, p.card || {}, checks.deadline.late);

  return sepaRoute(d);
}

// ---- Outcome · ---------------------------------------------------------------------------------

const CB_NEXT = {
  INITIATED: 'in "Chargebacks to file"',
  WAITING_CARDHOLDER: 'waiting on the cardholder',
  PRESENTED: 'filed with the network',
  REPRESENTED: 'the merchant answered',
  PRE_ARBITRATION: 'pre-arbitration filed',
  ARBITRATION: 'in arbitration',
};

async function waitingOutcome(list, d) {
  const [rfi] = await list(
    'information_requests',
    [eq('dispute_request_id', d.id), eq('status', ['SENT', 'OVERDUE'])],
    ['reference', 'sent_at', 'due_at', 'status'],
    { field: 'sent_at', ascending: false },
  );

  return rfi
    ? `${LOOK} Waiting on the customer: ${rfi.reference} sent ${stamp(
        rfi.sent_at,
      )}, answer due ${frDate(rfi.due_at)}${rfi.status === 'OVERDUE' ? ' (overdue)' : ''}`
    : `${LOOK} Waiting on the customer`;
}

async function chargebackOutcome(list, d) {
  const [cb] = await list(
    'chargebacks',
    [eq('dispute_request_id', d.id)],
    ['reference', 'status', 'network', 'reason_code', 'created_at', 'representment_deadline'],
  );
  if (!cb) return `${OK} Routed to a chargeback`;
  const next = CB_NEXT[cb.status] || `decided: ${label(cb.status)}`;
  const due =
    ['INITIATED', 'WAITING_CARDHOLDER'].includes(cb.status) && cb.representment_deadline
      ? `, to file by ${frDate(cb.representment_deadline)}`
      : '';

  return `${OK} Chargeback ${cb.reference} opened ${frDate(cb.created_at)}: ${
    NETWORKS[cb.network]
  } ${cb.reason_code}, ${next}${due}`;
}

async function sepaOutcome(list, d) {
  const [row] = await list(
    'sepa_disputes',
    [eq('dispute_request_id', d.id)],
    ['reference', 'type', 'reason_code', 'requested_at', 'response_due', 'status'],
  );
  if (!row) return `${OK} Routed to a SEPA dispute`;
  const where = {
    OPEN: 'to send',
    WAITING_OTHER_BANK: `the other bank answers by ${frDate(row.response_due)}`,
    ACCEPTED: 'accepted, money back',
    PARTIAL: 'partly returned',
    REFUSED: 'refused by the other bank',
  }[row.status];

  return `${OK} SEPA dispute ${row.reference}: ${label(row.type)} (${
    row.reason_code
  }) sent ${frDate(row.requested_at)} through the ${PROVIDERS.sepa} (simulated), ${
    where || label(row.status)
  }`;
}

/** An unauthorised card payment: the card blocked at intake, or already blocked by the customer. */
function cardBlock(d, p) {
  const card = p.card?.card;

  if (d.payment_type !== 'CARD' || d.reason !== 'UNAUTHORIZED' || card?.status !== 'BLOCKED') {
    return '';
  }

  const name = `card •••• ${card.last_four_digits}`;
  const why = label(card.blocked_reason);

  if (new Date(card.blocked_at) < new Date(d.requested_at)) {
    return ` · ${name} already blocked (${why}) on ${stamp(card.blocked_at)}`;
  }

  return ` · ${name} blocked at intake (${why}) on ${stamp(
    card.blocked_at,
  )} through the card processor (simulated)`;
}

/** Where the request went: waiting, routed (and how the case stands), or closed and why. */
async function routeOutcome(list, d) {
  if (d.status === 'NEW') return 'Not routed yet';
  if (d.status === 'WAITING_CUSTOMER') return waitingOutcome(list, d);

  if (d.status === 'UNDER_INVESTIGATION') {
    return `${LOOK} Under investigation: refund refused for now, Banque de France notified on ${frDate(
      d.bdf_notified_at,
    )}`;
  }

  if (d.route === 'CHARGEBACK') return chargebackOutcome(list, d);
  if (d.route === 'SEPA_DISPUTE') return sepaOutcome(list, d);
  const when = frDate(d.closed_at || d.routed_at);

  if (d.route === 'BANK_REFUND') {
    return `${OK} Closed on ${when}, refunded by the bank: ${d.resolution_notes}`;
  }

  if (d.route === 'CONTACT_MERCHANT') return `○ Closed on ${when}: customer sent to the merchant`;

  return `${BAD} Declined on ${when}: ${d.resolution_notes || 'not eligible'}`;
}

const MONEY_WORDS = {
  PROVISIONAL_CREDIT: 'refund of an unauthorised payment (PSD2) while the chargeback runs',
  REFUND: 'refund',
  CREDIT_REVERSAL: 'taken back',
};

function moneyOutcome(money) {
  if (!money.length) return '○ Nothing paid back yet';

  return money
    .map(m =>
      m.role === 'CREDIT_REVERSAL'
        ? `${BAD} ${euros(m.amount)} taken back on ${frDate(m.at)}`
        : `${OK} ${euros(m.amount)} credited on ${frDate(m.at)} (${MONEY_WORDS[m.role]})`,
    )
    .join(' · ');
}

/** Everything about one request, computed once for all its fields. */
async function disputeFile(list, d, now = new Date()) {
  const p = await paymentOf(list, d);
  const money = await moneyBack(list, d);
  const checks = { deadline: deadline(d, p), merchant: merchantContact(d, p) };
  const open = ['NEW', 'WAITING_CUSTOMER'].includes(d.status);
  const [route, why] = suggestRoute(d, p, checks);

  return {
    ...disputeFields(d, p),
    ...paymentFields(d, p),
    elig_deadline: checks.deadline.line,
    elig_merchant: checks.merchant.line,
    elig_history: await earlierDisputes(list, d),
    elig_refund: refundByNextDay(d, money, now, checks),
    route_suggested: open
      ? `${route}: ${why}`
      : `○ Decided: ${ROUTE_WORDS[d.route] || label(d.status)}`,
    outcome_route: open
      ? await routeOutcome(list, d)
      : `${(await routeOutcome(list, d)).replace(/\.$/, '')}${cardBlock(d, p)}`,
    outcome_money: moneyOutcome(money),
  };
}

// The evidence fields; the prefix of a name groups them.
const FIELDS = [
  'dispute_reason',
  'dispute_amount',
  'dispute_payment',
  'dispute_date',
  'dispute_channel',
  'payment_party',
  'payment_date',
  'payment_auth',
  'payment_device',
  'elig_deadline',
  'elig_merchant',
  'elig_history',
  'elig_refund',
  'route_suggested',
  'outcome_route',
  'outcome_money',
];

/**
 * Route dispute's default note, as the rules give it: why a request is declined, or why the bank
 * refunds an unauthorised card payment past the network's 120 days. Null otherwise.
 */
async function ruledNote(list, d, chosen) {
  const p = await paymentOf(list, d);
  const checks = { deadline: deadline(d, p), merchant: merchantContact(d, p) };
  const [route, why] = suggestRoute(d, p, checks);
  if (chosen === 'DECLINED' && route.endsWith('Not eligible')) return `${capital(why)}.`;

  if (chosen === 'BANK_REFUND' && checks.deadline.late) {
    return 'Past the card network’s 120 days, so no chargeback: the bank refunded the unauthorised payment by the next business day (PSD2) and bears the loss.';
  }

  return null;
}

function addDisputeEvidence(collection) {
  // One computation per request and call, whichever of the fields are asked for.
  const cache = new WeakMap();

  const fileOf = (record, context) => {
    if (!cache.has(record)) cache.set(record, disputeFile(reader(context.dataSource), record));

    return cache.get(record);
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: 'String',
      dependencies: DISPUTE_FIELDS,
      getValues: (records, context) =>
        Promise.all(records.map(async r => (await fileOf(r, context))?.[name] ?? null)),
    }),
  );
}

export {
  FIELDS,
  FRAUD_CODES,
  MERCHANT_REASONS,
  REASON_CODES,
  SEPA_CODES,
  SEPA_REASONS,
  addDisputeEvidence,
  booked,
  UNAUTHORISED,
  rowOf,
  ruledNote,
};
