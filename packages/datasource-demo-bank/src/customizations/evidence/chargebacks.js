/**
 * What a disputes agent reads before each decision on a chargeback, as fields of the chargeback:
 * the claim (network, reason code, amount, deadline, round), the card, the cardholder's evidence,
 * the merchant's answer once it came, and what the card network and the money say after each
 * action (filed, pushed back, refunded, credit taken back).
 */
const { ConditionTreeFactory, ConditionTreeLeaf } = require('@forestadmin/datasource-toolkit');

const { FRAUD_CODES, MERCHANT_REASONS, booked, rowOf } = require('./disputes');
const { reader } = require('../shared/case-file');
const { PROVIDERS } = require('../shared/providers');

const DAY = 24 * 3600 * 1000;
const OK = '✓';
const LOOK = '⚠';
const BAD = '✗';
// Below this, fighting costs the bank more than refunding.
const SMALL = 50;
// Days the cardholder has to cancel an order made at a distance (EU withdrawal right).
const WITHDRAWAL_DAYS = 14;

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const zone = { timeZone: 'Europe/Paris' };
const frDate = d => (d ? new Date(d).toLocaleDateString('fr-FR', zone) : 'no date');
const stamp = d =>
  new Date(d).toLocaleString('fr-FR', { ...zone, dateStyle: 'short', timeStyle: 'short' });
const euros = n => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`;
const label = code => (code ? code.replace(/_/g, ' ').toLowerCase() : '');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const NETWORKS = { VISA: 'Visa', MASTERCARD: 'Mastercard' };
const TOOLS = { VISA: 'Visa Resolve Online', MASTERCARD: 'Mastercom' };
const ENTRY = {
  CHIP: 'Paid with chip and PIN',
  CONTACTLESS: 'Paid contactless',
  MOBILE_WALLET: 'Paid with a phone wallet',
};

const CHARGEBACK_FIELDS = [
  'id',
  'reference',
  'status',
  'customer_id',
  'transaction_id',
  'card_transaction_id',
  'dispute_request_id',
  'network',
  'source',
  'reason_code',
  'reason_description',
  'amount',
  'created_at',
  'filed_at',
  'evidence_submitted_at',
  'processor_dispute_id',
  'representment_deadline',
  'representment_received_at',
  'representment_reason',
  'pre_arbitration_filed_at',
  'decision_at',
  'resolution_notes',
  'provisional_credit_issued',
];

async function facts(list, cb) {
  const payment =
    (await rowOf(list, 'card_transactions', cb.card_transaction_id, [
      'entry_mode',
      'is_3ds',
      'card_id',
      'merchant_id',
    ])) || {};
  const merchant =
    (await rowOf(list, 'card_merchants', payment.merchant_id, [
      'mcc_code',
      'acquirer',
      'city',
      'counterparty_id',
    ])) || {};
  const [card, party, dispute, tx, requests, moves] = await Promise.all([
    rowOf(list, 'cards', payment.card_id, [
      'network',
      'last_four_digits',
      'status',
      'blocked_at',
      'blocked_reason',
    ]),
    rowOf(list, 'counterparties', merchant.counterparty_id, ['name', 'country']),
    rowOf(list, 'dispute_requests', cb.dispute_request_id, [
      'reason',
      'merchant_contacted_at',
      'requested_at',
      'routed_at',
    ]),
    rowOf(list, 'transactions', cb.transaction_id, ['created_at']),
    list(
      'information_requests',
      [
        cb.dispute_request_id
          ? ConditionTreeFactory.union(
              eq('chargeback_id', cb.id),
              eq('dispute_request_id', cb.dispute_request_id),
            )
          : eq('chargeback_id', cb.id),
        eq('status', ['SENT', 'OVERDUE', 'ANSWERED']),
      ],
      ['reference', 'status', 'sent_at', 'due_at', 'answered_at', 'answer'],
      { field: 'sent_at', ascending: true },
    ),
    list(
      'dispute_transactions',
      [eq('chargeback_id', cb.id), eq('role', ['PROVISIONAL_CREDIT', 'REFUND', 'CREDIT_REVERSAL'])],
      ['role', 'transaction_id'],
    ),
  ]);
  const fraud = FRAUD_CODES.includes(cb.reason_code);

  return {
    payment,
    card: card || {},
    merchant: { ...merchant, name: party?.name, country: party?.country },
    dispute: dispute || {},
    paidAt: tx?.created_at,
    // The question that serves this chargeback: the last one asked.
    request: requests[requests.length - 1] || null,
    money: await booked(list, moves),
    fraud,
    reason: dispute?.reason || (fraud ? 'UNAUTHORIZED' : null),
  };
}

// ---- Chargeback · ------------------------------------------------------------------------------

const daysLeft = due => Math.ceil((new Date(due) - Date.now()) / DAY);

function deadlineLine(cb) {
  const due = cb.representment_deadline;
  if (!due) return `○ Closed on ${frDate(cb.decision_at)}: no deadline left`;
  const left = daysLeft(due);
  const sign = left < 0 ? BAD : (left <= 3 && LOOK) || OK;
  const time = left < 0 ? `passed ${plural(-left, 'day')} ago` : `${plural(left, 'day')} left`;

  if (['INITIATED', 'WAITING_CARDHOLDER'].includes(cb.status)) {
    return `${sign} File by ${frDate(due)}: ${time} (120 days from the payment)`;
  }

  if (cb.status === 'REPRESENTED') return `${sign} Push back by ${frDate(due)}: ${time}`;

  return `○ The other side answers by ${frDate(due)} (${time})`;
}

function roundLine(cb, f) {
  return {
    INITIATED: `Initiated on ${frDate(cb.created_at)}: preparing the file, not filed yet`,
    WAITING_CARDHOLDER: `Waiting on the cardholder since ${frDate(f.request?.sent_at)}${
      f.request ? ` (${f.request.reference})` : ''
    }: not filed yet`,
    PRESENTED: `Presented to ${NETWORKS[cb.network]} on ${frDate(
      cb.filed_at,
    )}: the merchant’s bank may answer`,
    REPRESENTED: `Represented: the merchant answered on ${frDate(cb.representment_received_at)}`,
    PRE_ARBITRATION: `Pre-arbitration filed on ${frDate(
      cb.pre_arbitration_filed_at,
    )}: last round before the network decides`,
    ARBITRATION: 'Arbitration: the network decides',
    WON: `Won on ${frDate(cb.decision_at)}`,
    LOST: `Lost on ${frDate(cb.decision_at)}`,
    WITHDRAWN: `Withdrawn on ${frDate(cb.decision_at)}`,
  }[cb.status];
}

function chargebackFields(cb, f) {
  const holder = `card •••• ${f.card.last_four_digits || '????'}`;

  return {
    cb_network: `${NETWORKS[cb.network]} · ${holder} · ${
      cb.source === 'FRAUD_DETECTION' ? 'found by our fraud team' : 'from the customer’s dispute'
    }`,
    cb_reason: f.fraud
      ? `${LOOK} Fraud code ${cb.reason_code} · ${cb.reason_description}: the cardholder did not make this payment`
      : `○ ${cb.reason_code} · ${cb.reason_description}: a dispute with the merchant, not fraud`,
    cb_amount:
      Number(cb.amount) < SMALL
        ? `${LOOK} ${euros(cb.amount)}: under ${SMALL} EUR, refunding costs less than fighting`
        : `${OK} ${euros(cb.amount)}`,
    cb_deadline: deadlineLine(cb),
    cb_round: roundLine(cb, f),
  };
}

// ---- Card · ------------------------------------------------------------------------------------

function cardLine(f) {
  const card = `${NETWORKS[f.card.network] || 'Card'} •••• ${f.card.last_four_digits || '????'}`;

  if (f.card.status === 'BLOCKED') {
    // Blocked when the dispute was routed: the intake desk did it, nothing left to do here.
    const routed = f.dispute.routed_at && new Date(f.dispute.routed_at);
    const atIntake =
      routed && Math.abs(new Date(f.card.blocked_at) - routed) < DAY ? ' at intake' : '';

    return `${OK} ${card} blocked${atIntake} (${label(f.card.blocked_reason)}) on ${stamp(
      f.card.blocked_at,
    )} · ${PROVIDERS.cardProcessor} card processor (simulated)`;
  }

  if (f.card.status !== 'ACTIVE') return `○ ${card} ${label(f.card.status)}`;

  return f.fraud
    ? `${LOOK} ${card} still active: block it so it cannot be used again`
    : `○ ${card} active: no block needed, not a fraud claim`;
}

// ---- Evidence · --------------------------------------------------------------------------------

function answersLine(cb, f) {
  const r = f.request;

  if (r?.status === 'ANSWERED') {
    return `${OK} ${r.reference} answered on ${frDate(r.answered_at)}: "${r.answer}"`;
  }

  if (r) {
    return `${BAD} ${r.reference} sent ${frDate(r.sent_at)}, no answer yet (due ${frDate(
      r.due_at,
    )}${r.status === 'OVERDUE' ? ', overdue' : ''})`;
  }

  if (cb.evidence_submitted_at) {
    return `${OK} Collected with the dispute, sent to the network on ${frDate(
      cb.evidence_submitted_at,
    )}`;
  }

  return `${BAD} Not asked yet`;
}

function documentsLine(cb, f) {
  const answered = f.request?.status === 'ANSWERED' || cb.evidence_submitted_at;
  const when = frDate(f.request?.answered_at || cb.evidence_submitted_at);

  if (f.fraud) {
    return answered
      ? `${OK} Fraud declaration signed in the app on ${when}`
      : `${BAD} No fraud declaration from the cardholder yet`;
  }

  const merchant = f.merchant.name || 'the merchant';
  let what = 'receipt and statement line';

  if (f.reason === 'CANCELLED_RECURRING') {
    what = `confirmation that the subscription was cancelled, and messages with ${merchant}`;
  } else if (MERCHANT_REASONS.includes(f.reason)) {
    what = `order confirmation and messages with ${merchant}`;
  }

  return answered ? `${OK} The ${what}, received ${when}` : `${BAD} Missing: the ${what}`;
}

function secureLine(f) {
  if (f.payment.entry_mode !== 'ONLINE') {
    return `○ ${ENTRY[f.payment.entry_mode] || 'In person'}: 3-D Secure does not apply`;
  }

  if (f.fraud) {
    return f.payment.is_3ds
      ? `${BAD} Approved with 3-D Secure: the liability moved to us, the merchant wins`
      : `${OK} No 3-D Secure: the merchant kept the liability`;
  }

  return `○ ${
    f.payment.is_3ds ? 'Approved with' : 'No'
  } 3-D Secure: it does not decide a dispute with the merchant`;
}

function completeLine(cb, f) {
  const answered = f.request?.status === 'ANSWERED' || cb.evidence_submitted_at;

  if (answered) {
    return `${OK} Yes: the cardholder’s ${
      f.fraud ? 'declaration is' : 'answer and documents are'
    } on file`;
  }

  if (f.request) return `${BAD} No: waiting for the cardholder’s answer to ${f.request.reference}`;

  return `${BAD} No: the cardholder was not asked yet, ask them`;
}

// ---- Merchant · --------------------------------------------------------------------------------

function merchantName(f) {
  const m = f.merchant;
  const where = [m.city, m.country].filter(Boolean).join(', ');

  return `${m.name || 'Unknown'}${where ? ` · ${where}` : ''} · MCC ${
    m.mcc_code || '?'
  } · acquirer ${m.acquirer || '?'}`;
}

function answerLine(cb) {
  if (cb.representment_received_at) {
    return `${LOOK} Answered on ${frDate(cb.representment_received_at)}: "${
      cb.representment_reason
    }"`;
  }

  if (cb.status === 'PRESENTED') {
    return `○ No answer yet: the merchant’s bank has until ${frDate(cb.representment_deadline)}`;
  }

  if (['WON', 'LOST', 'WITHDRAWN'].includes(cb.status)) return '○ No answer: the case is closed';

  return '○ Not filed yet';
}

/** What the rules say about the merchant's answer: a starting point, the agent decides. */
function suggestion(cb, f) {
  if (cb.status === 'PRE_ARBITRATION') {
    return `○ Pushed back on ${frDate(
      cb.pre_arbitration_filed_at,
    )}: waiting for the merchant’s bank`;
  }

  if (cb.status !== 'REPRESENTED') return '○ Nothing to decide: the merchant has not answered';

  if (Number(cb.amount) < SMALL) {
    return `${BAD} Accept: under ${SMALL} EUR, a pre-arbitration costs more than it can recover`;
  }

  if (f.fraud) {
    return f.payment.is_3ds
      ? `${BAD} Accept: the payment was approved with 3-D Secure, the liability is ours`
      : `${OK} Push back: our records show no 3-D Secure on this payment, the liability stays with the merchant`;
  }

  const contacted = f.dispute.merchant_contacted_at;

  if (f.reason === 'CANCELLED_ORDER' && contacted && f.paidAt) {
    const days = Math.floor((new Date(contacted) - new Date(f.paidAt)) / DAY);

    if (days <= WITHDRAWAL_DAYS) {
      return `${OK} Push back: the cardholder cancelled on ${frDate(contacted)}, ${plural(
        days,
        'day',
      )} after paying, within the 14-day withdrawal period; their email is in the file`;
    }

    return `${BAD} Accept: the cardholder cancelled ${plural(
      days,
      'day',
    )} after paying, after the 14-day withdrawal period`;
  }

  return (
    {
      ITEM_NOT_RECEIVED: `${BAD} Accept: a proof of delivery signed at the customer’s address usually wins; push back only if the cardholder disputes the signature`,
      CANCELLED_RECURRING: `${LOOK} Compare the cancellation date with the billing date: push back if the cardholder cancelled before the period charged${
        contacted ? ` (they cancelled on ${frDate(contacted)})` : ''
      }`,
      SERVICE_NOT_RENDERED: `${LOOK} Look at the usage logs: push back if the cardholder cancelled before the period charged${
        contacted ? ` (they cancelled on ${frDate(contacted)})` : ''
      }`,
      DUPLICATE_CHARGE: `${LOOK} Look at the two invoices: push back if they are the same order`,
      WRONG_AMOUNT: `${LOOK} Compare the price at checkout with the cardholder’s receipt: push back if they differ`,
    }[f.reason] || `${LOOK} Compare the merchant’s answer with the cardholder’s evidence`
  );
}

// ---- Outcome · ---------------------------------------------------------------------------------

function caseLine(cb, f) {
  const tool = TOOLS[cb.network];
  const due = cb.representment_deadline ? frDate(cb.representment_deadline) : null;

  switch (cb.status) {
    case 'INITIATED':
      return `Not filed yet${due ? `: file by ${due}` : ''}`;
    case 'WAITING_CARDHOLDER':
      return `${LOOK} Not filed: waiting on the cardholder${
        f.request ? ` (${f.request.reference}, due ${frDate(f.request.due_at)})` : ''
      }`;
    case 'PRESENTED':
      return `${OK} ${tool} case ${cb.processor_dispute_id}, presented ${stamp(
        cb.filed_at,
      )} (simulated): the merchant’s bank answers by ${due}`;
    case 'REPRESENTED':
      return `${LOOK} ${tool} case ${cb.processor_dispute_id}: the merchant answered, push back by ${due}`;
    case 'PRE_ARBITRATION':
      return `${OK} ${tool} case ${cb.processor_dispute_id}, pre-arbitration filed ${stamp(
        cb.pre_arbitration_filed_at,
      )} (simulated): the merchant’s bank answers by ${due}`;
    case 'ARBITRATION':
      return `${LOOK} ${tool} case ${cb.processor_dispute_id}: in arbitration, the network decides`;
    case 'WON':
      return `${OK} Won on ${frDate(cb.decision_at)}: ${cb.resolution_notes}`;
    case 'LOST':
      return `${BAD} Lost on ${frDate(cb.decision_at)}: ${cb.resolution_notes}`;
    default:
      return `○ Withdrawn on ${frDate(cb.decision_at)}: ${cb.resolution_notes}`;
  }
}

/**
 * Nothing booked yet on this chargeback: why. French practice: only an unauthorised payment is
 * credited at once (PSD2, by the next business day); every other chargeback once won.
 */
function noMoneyLine(cb, f) {
  if (f.fraud) {
    return '○ Nothing credited yet: an unauthorised payment is refunded by the next business day';
  }

  if (['LOST', 'WITHDRAWN'].includes(cb.status)) return '○ Nothing credited: the claim was not won';

  return '○ Nothing credited: the customer is credited only if the chargeback is won';
}

function moneyLine(cb, f) {
  if (!f.money.length) return noMoneyLine(cb, f);
  const lines = f.money.map(m => {
    if (m.role === 'CREDIT_REVERSAL') {
      return `${BAD} ${euros(m.amount)} taken back on ${frDate(m.at)}`;
    }

    if (m.role === 'REFUND' && cb.status === 'WON') {
      return `${OK} ${euros(m.amount)} credited on ${frDate(m.at)}: the chargeback was won`;
    }

    if (m.role === 'REFUND') {
      return `${OK} ${euros(m.amount)} refunded on ${frDate(m.at)} (the bank took the loss)`;
    }

    return `${OK} ${euros(m.amount)} credited on ${frDate(m.at)} (provisional credit${
      f.fraud ? ', final: unauthorised payment' : ''
    })`;
  });

  if (cb.status === 'LOST' && f.fraud && !f.money.some(m => m.role === 'CREDIT_REVERSAL')) {
    lines.push('○ Kept by the customer: the bank bears the loss of an unauthorised payment');
  }

  return lines.join(' · ');
}

/** Everything about one chargeback, computed once for all its fields. */
async function chargebackFile(list, cb) {
  const f = await facts(list, cb);

  return {
    ...chargebackFields(cb, f),
    card_status: cardLine(f),
    ev_answers: answersLine(cb, f),
    ev_documents: documentsLine(cb, f),
    ev_3ds: secureLine(f),
    ev_complete: completeLine(cb, f),
    merchant_name: merchantName(f),
    merchant_answer: answerLine(cb),
    merchant_suggested: suggestion(cb, f),
    outcome_case: caseLine(cb, f),
    outcome_money: moneyLine(cb, f),
  };
}

// field: label. The prefix groups them, so a workflow step can read one group by its name.
const LABELS = {
  cb_network: 'Chargeback · Network',
  cb_reason: 'Chargeback · Reason code',
  cb_amount: 'Chargeback · Amount',
  cb_deadline: 'Chargeback · Deadline',
  cb_round: 'Chargeback · Round',
  card_status: 'Card · Status',
  ev_answers: 'Evidence · Cardholder answers',
  ev_documents: 'Evidence · Documents',
  ev_3ds: 'Evidence · 3-D Secure',
  ev_complete: 'Evidence · Complete',
  merchant_name: 'Merchant · Name',
  merchant_answer: 'Merchant · Answer',
  merchant_suggested: 'Merchant · Suggested decision',
  outcome_case: 'Outcome · Network case',
  outcome_money: 'Outcome · Money',
};
const FIELDS = Object.keys(LABELS);

function addChargebackEvidence(collection) {
  const cache = new WeakMap();

  const fileOf = (record, context) => {
    if (!cache.has(record)) cache.set(record, chargebackFile(reader(context.dataSource), record));

    return cache.get(record);
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: 'String',
      dependencies: CHARGEBACK_FIELDS,
      getValues: (records, context) =>
        Promise.all(records.map(async r => (await fileOf(r, context))?.[name] ?? null)),
    }),
  );
}

module.exports = { FIELDS, LABELS, SMALL, addChargebackEvidence };
