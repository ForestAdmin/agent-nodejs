/**
 * The evidence a payments operator reads before answering a recall another bank sent us, as fields
 * of the SEPA dispute: why the money is asked back and by when, the payment it is about, whether
 * the money is still there, our customer's consent, and the answer we sent through STET. Recalls
 * we receive only (side WE_ARE_ASKED); the others show nothing in these fields.
 */
const { createHash } = require('crypto');

const { OTHER_BANKS } = require('../../seed/reference');

const DAY = 24 * 3600 * 1000;
const OK = '✓';
const LOOK = '⚠';
const BAD = '✗';

const euros = n =>
  `${Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
const frDate = v => new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
const stamp = v =>
  new Date(v).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
const leaf = (field, value) => ({
  field,
  operator: Array.isArray(value) ? 'In' : 'Equal',
  value,
});
const and = (...conditions) => ({ aggregator: 'And', conditions });

function reader(dataSource) {
  return (table, conditionTree, fields, sort) =>
    dataSource
      .getCollection(table)
      .list({ conditionTree, ...(sort ? { sort: [sort] } : {}) }, fields);
}

const BANK_OF_BIC = new Map(OTHER_BANKS.map(([, bic, name]) => [bic, name]));
const bankOf = bic => (bic ? `${BANK_OF_BIC.get(bic) || 'another bank'} (${bic})` : 'unknown bank');

/** The interbank message we answer with, same reference every time for the same recall. */
const stetRef = (id, kind) =>
  `${kind === 'return' ? 'pacs.004' : 'camt.029'} ${createHash('md5')
    .update(`${id}${kind}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase()}`;

const REASONS = {
  FRAUD: 'FRAD · Fraud: the payer says they were tricked into paying',
  DUPLICATE: 'DUPL · Duplicate: the payer’s bank says it sent this transfer twice',
  TECHNICAL: 'TECH · Technical problem at the payer’s bank',
  WRONG_IBAN: 'AC03 · Wrong account: the payer typed a wrong IBAN',
  WRONG_AMOUNT: 'AM09 · Wrong amount: the payer sent more than they meant to',
  CUSTOMER_REQUEST: 'MD06 · The payer asks for the money back',
};
const SCHEMES = {
  SCT: 'SEPA credit transfer',
  SCT_INST: 'SEPA Instant credit transfer',
  SDD_CORE: 'SEPA direct debit',
  SDD_B2B: 'SEPA business direct debit',
};
const ANSWERED = ['ACCEPTED', 'REFUSED', 'PARTIAL'];
// Recalls answered without our customer's consent: the payer was defrauded.
const NO_CONSENT = ['FRAUD'];

const SEPA_FIELDS = [
  'id',
  'reference',
  'side',
  'type',
  'reason',
  'amount',
  'scheme',
  'requested_at',
  'response_due',
  'status',
  'customer_id',
  'transaction_id',
  'incoming_transfer_id',
  'alert_id',
  'customer_consent_at',
  'answered_at',
  'amount_returned',
  'return_transaction_id',
  'other_bank_bic',
];

/** What our customer still has of the money: free on the account, or held for this recall. */
async function money(list, row, accountId) {
  const [[account], holds] = await Promise.all([
    list('accounts', leaf('id', accountId), ['iban', 'balance', 'available_balance']),
    list(
      'holds',
      leaf('sepa_dispute_id', row.id),
      [
        'reference',
        'amount',
        'status',
        'reason',
        'placed_at',
        'released_at',
        'release_reason',
        'alert_id',
      ],
      { field: 'placed_at', ascending: false },
    ),
  ]);
  const held = holds
    .filter(h => h.status === 'ACTIVE')
    .reduce((sum, h) => sum + Number(h.amount), 0);
  const free = Math.max(0, Number(account.available_balance));
  const returnable = Math.round(Math.min(Number(row.amount), held + free) * 100) / 100;

  return { account, holds, held, free, returnable };
}

async function facts(list, row) {
  const [[tx], [incoming], [customer], requests] = await Promise.all([
    list('transactions', leaf('id', row.transaction_id), [
      'id',
      'account_id',
      'amount',
      'booked_at',
      'created_at',
    ]),
    row.incoming_transfer_id
      ? list('incoming_transfers', leaf('id', row.incoming_transfer_id), [
          'id',
          'emitter_id',
          'remittance_info',
        ])
      : [],
    list('customers', leaf('id', row.customer_id), [
      'display_name',
      'customer_type',
      'created_at',
      'risk_rating',
    ]),
    list(
      'information_requests',
      leaf('sepa_dispute_id', row.id),
      [
        'reference',
        'status',
        'sent_at',
        'due_at',
        'answered_at',
        'answer',
        'cancel_reason',
        'channel',
      ],
      { field: 'created_at', ascending: false },
    ),
  ]);
  // Computed fields see the tables before their links are added: no relation paths here.
  const [emitter] = incoming
    ? await list('sct_emitters', leaf('id', incoming.emitter_id), [
        'iban',
        'bank_name',
        'counterparty_id',
      ])
    : [];
  if (incoming) incoming.emitter = emitter || null;
  const [payer] = emitter
    ? await list('counterparties', leaf('id', emitter.counterparty_id), ['name'])
    : [];
  const funds = await money(list, row, tx.account_id);
  const after = tx.booked_at || tx.created_at;
  const [spent, twins, alerts, lines] = await Promise.all([
    list(
      'transactions',
      and(leaf('account_id', tx.account_id), leaf('direction', 'DEBIT'), leaf('status', 'BOOKED'), {
        field: 'booked_at',
        operator: 'GreaterThan',
        value: after,
      }),
      ['amount'],
    ),
    incoming
      ? list(
          'incoming_transfers',
          and(leaf('emitter_id', incoming.emitter_id), {
            field: 'id',
            operator: 'NotEqual',
            value: incoming.id,
          }),
          ['transaction_id'],
        ).then(rows =>
          rows.length
            ? list(
                'transactions',
                leaf(
                  'id',
                  rows.map(r => r.transaction_id),
                ),
                ['amount', 'created_at'],
              )
            : [],
        )
      : [],
    row.alert_id ? list('alerts', leaf('id', row.alert_id), ['reference', 'status']) : [],
    list(
      'status_changes',
      and(leaf('record_type', 'SEPA_DISPUTES'), leaf('record_id', row.id)),
      ['new_value', 'reason', 'changed_at'],
      { field: 'changed_at', ascending: false },
    ),
  ]);

  return {
    row,
    tx,
    incoming,
    payer: payer?.name || 'unknown payer',
    customer,
    requests,
    ...funds,
    spent,
    twin: twins.find(
      t =>
        Math.abs(Number(t.amount) - Number(tx.amount)) < 0.01 &&
        Math.abs(new Date(t.created_at) - new Date(tx.created_at)) < 2 * DAY,
    ),
    alert: alerts[0] || null,
    answer: lines.find(l => ANSWERED.includes(l.new_value)) || null,
  };
}

function recallFields(f) {
  const { row } = f;
  const left = Math.ceil((new Date(`${row.response_due}T21:59:59Z`) - Date.now()) / DAY);
  let deadline = `${OK} Answer by ${frDate(row.response_due)}: ${left} days left`;
  if (ANSWERED.includes(row.status)) deadline = `○ Answered on ${frDate(row.answered_at)}`;
  else if (left < 0) deadline = `${BAD} Deadline passed on ${frDate(row.response_due)}`;
  else if (left <= 3) deadline = `${LOOK} Answer by ${frDate(row.response_due)}: ${left} days left`;

  return {
    rc_reason: `${REASONS[row.reason] || row.reason}${
      row.type === 'REQUEST_FOR_RECALL' ? ' (request for recall by the payer)' : ''
    }`,
    rc_bank: `${bankOf(row.other_bank_bic)}, received ${stamp(row.requested_at)} · ${
      row.reference
    }`,
    rc_amount: `${euros(row.amount)}, ${SCHEMES[row.scheme] || row.scheme}`,
    rc_deadline: deadline,
  };
}

function originalFields(f) {
  const { tx, incoming, customer, account } = f;
  const twin = f.twin
    ? ` · Same amount from the same payer on ${stamp(f.twin.created_at)} too`
    : '';

  return {
    og_received: `Credited on ${stamp(tx.booked_at || tx.created_at)} to ${account.iban} (${
      customer.display_name
    })`,
    og_payer: `${f.payer} · ${incoming?.emitter?.iban || '?'} (${
      incoming?.emitter?.bank_name || '?'
    })${incoming?.remittance_info ? ` · "${incoming.remittance_info}"` : ''}${twin}`,
  };
}

/** Whether the money can still go back: all of it, part of it, or none (spent since). */
function thereText(f) {
  const { row, held, free, returnable, account, spent } = f;
  if (row.status === 'REFUSED') return '○ Answered: refused, nothing sent back';

  if (ANSWERED.includes(row.status)) {
    return `○ Answered: ${euros(row.amount_returned)} sent back on ${frDate(row.answered_at)}`;
  }

  const parts = [held && `${euros(held)} on hold for this recall`, free && `${euros(free)} free`]
    .filter(Boolean)
    .join(', ');

  if (returnable >= Number(row.amount) - 0.01) {
    return `${OK} All there: ${euros(row.amount)} can go back (${parts})`;
  }

  if (returnable > 0) {
    return `${LOOK} Part left: ${euros(returnable)} of ${euros(row.amount)} (${parts})`;
  }

  const out = spent.reduce((sum, t) => sum + Number(t.amount), 0);

  return `${BAD} Spent: nothing left to send back (available ${euros(
    account.available_balance,
  )}); ${spent.length} payments (${euros(out)}) left the account since it arrived`;
}

/** The money held for this recall, and the fraud alert behind a fraud hold. */
function holdText(f) {
  const { row, holds, returnable } = f;
  const alert = f.alert
    ? `, fraud alert ${f.alert.reference} (${f.alert.status.toLowerCase()})`
    : '';
  const active = holds.find(h => h.status === 'ACTIVE');
  const released = holds.find(h => h.status === 'RELEASED');

  if (active) {
    const until = NO_CONSENT.includes(row.reason) ? '' : '; the customer agreed, it goes back';

    return `${OK} ${euros(active.amount)} on hold for this recall since ${stamp(
      active.placed_at,
    )} (${active.reference}${alert}${until})`;
  }

  if (released) {
    return `○ ${released.reference} released on ${frDate(released.released_at)}: ${
      released.release_reason
    }`;
  }

  if (ANSWERED.includes(row.status)) return `○ Nothing on hold${alert}`;

  // Not a fraud: nothing is held before our customer agrees, the money is theirs until then.
  if (!NO_CONSENT.includes(row.reason)) {
    return row.customer_consent_at
      ? '○ Nothing on hold'
      : '○ Nothing on hold: the money is the customer’s until they agree';
  }

  if (returnable > 0 && !f.alert) {
    return `${LOOK} Nothing on hold yet: the workflow runs "Escalate to fraud"`;
  }

  return `○ Nothing on hold: ${
    returnable > 0 ? 'not escalated yet' : 'no money left to hold'
  }${alert}`;
}

const fundsFields = f => ({ fd_there: thereText(f), fd_holds: holdText(f) });

function consentText(f) {
  const { row, requests } = f;

  if (NO_CONSENT.includes(row.reason)) {
    return '○ Not needed: a fraud recall is answered without the customer’s consent';
  }

  const asked = requests[0];

  if (row.customer_consent_at) {
    const said = asked?.answer ? `: "${asked.answer}"` : '';

    return `${OK} Agreed on ${stamp(row.customer_consent_at)}${said}`;
  }

  if (!asked) return `${LOOK} Not asked yet: the money stays theirs until they agree`;

  if (['SENT', 'OVERDUE'].includes(asked.status)) {
    return `${LOOK} Asked on ${stamp(asked.sent_at)} (${asked.reference}, ${String(
      asked.channel,
    ).toLowerCase()}), answer due ${frDate(asked.due_at)}: no answer yet`;
  }

  if (asked.status === 'ANSWERED') {
    return `${BAD} Refused on ${stamp(asked.answered_at)}: "${asked.answer}"`;
  }

  return `${BAD} No answer: ${asked.reference} ${asked.cancel_reason || 'closed'}`;
}

function customerFields(f) {
  const { customer } = f;
  const since = customer.created_at ? ` since ${frDate(customer.created_at)}` : '';

  return {
    cu_holder: `${customer.display_name} · ${String(
      customer.customer_type,
    ).toLowerCase()} customer${since} · risk ${String(customer.risk_rating || '?').toLowerCase()}`,
    cu_consent: consentText(f),
  };
}

function answerFields(f) {
  const { row, answer } = f;
  const bank = bankOf(row.other_bank_bic);

  if (!ANSWERED.includes(row.status)) {
    const waiting =
      row.status === 'WAITING_CUSTOMER'
        ? 'Not answered yet: waiting for the customer’s consent'
        : 'Not answered yet: the workflow runs "Accept and return funds" or "Refuse with a reason"';

    return { an_result: waiting, an_message: waiting };
  }

  if (row.status === 'REFUSED') {
    return {
      an_result: `${BAD} Refused on ${stamp(row.answered_at)}: ${
        String(answer?.reason || 'no reason recorded').split(' · ')[0]
      }`,
      an_message: `${stetRef(row.id, 'refusal')}: negative answer sent to ${bank} through STET`,
    };
  }

  return {
    an_result: `${row.status === 'ACCEPTED' ? OK : LOOK} ${
      row.status === 'ACCEPTED' ? 'Accepted' : 'Partly accepted'
    }: ${euros(row.amount_returned)} of ${euros(row.amount)} sent back on ${stamp(
      row.answered_at,
    )}`,
    an_message: `${stetRef(row.id, 'return')}: return of funds sent to ${bank} through STET`,
  };
}

async function evidence(list, row) {
  if (row.side !== 'WE_ARE_ASKED' || !row.transaction_id) return {};
  const f = await facts(list, row);

  return {
    ...recallFields(f),
    ...originalFields(f),
    ...fundsFields(f),
    ...customerFields(f),
    ...answerFields(f),
  };
}

// field: label. The prefix groups them, so a workflow step can read one group by its name.
const LABELS = {
  rc_reason: 'Recall · Reason',
  rc_bank: 'Recall · Asking bank',
  rc_amount: 'Recall · Amount',
  rc_deadline: 'Recall · Deadline',
  og_received: 'Original payment · Received',
  og_payer: 'Original payment · Payer',
  fd_there: 'Funds · On the account',
  fd_holds: 'Funds · Holds',
  cu_holder: 'Customer · Account holder',
  cu_consent: 'Customer · Consent',
  an_result: 'Answer · Result',
  an_message: 'Answer · Message',
};
const FIELDS = Object.keys(LABELS);

function addSepaEvidence(collection) {
  const cache = new WeakMap();

  const evidenceOf = (record, context) => {
    if (!cache.has(record)) cache.set(record, evidence(reader(context.dataSource), record));

    return cache.get(record);
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: 'String',
      dependencies: SEPA_FIELDS,
      getValues: (records, context) =>
        Promise.all(records.map(async r => (await evidenceOf(r, context))?.[name] ?? null)),
    }),
  );
}

module.exports = { FIELDS, LABELS, NO_CONSENT, addSepaEvidence, money, reader, stetRef };
