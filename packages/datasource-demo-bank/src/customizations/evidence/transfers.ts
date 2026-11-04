/**
 * The evidence a payments operator reads before letting a high-value transfer leave, as fields of
 * the transfer: a workflow "read" step only shows fields of one record, so each fact is one short
 * text (the transfer, the payee, the payee check, the account, the risk signals, the call back).
 * The payee check and the call back show once the workflow ran them: their answers are lines of
 * the transfer's history (status_changes), written by the actions in actions/cases.ts.
 */
import { mod97 } from '../../seed/reference';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
// A payee or a device younger than this is new; a change of phone, email or address this recent
// is a signal; a payment this many times the usual largest is unusual.
const NEW_DAYS = 7;
const CHANGE_DAYS = 30;
const UNUSUAL_RATIO = 3;
const FOUR_EYES = 50000;

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
const monthYear = v =>
  new Date(v).toLocaleDateString('fr-FR', {
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });

/** "3 hours", "2 days": how long between two moments, rounded the way people say it. */
function span(from, to) {
  const hours = Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / HOUR);
  if (hours < 1) return 'less than an hour';
  if (hours < 48) return `${Math.round(hours)} hour${Math.round(hours) > 1 ? 's' : ''}`;

  return `${Math.round(hours / 24)} days`;
}

const ago = (from, to) => (new Date(to).getTime() - new Date(from).getTime()) / DAY;

const leaf = (field, value) => ({
  field,
  operator: Array.isArray(value) ? 'In' : 'Equal',
  value,
});
const and = (...conditions) => ({ aggregator: 'And', conditions });

/** list(table, condition, fields, sort, limit): rows through Forest's collections. */
function reader(dataSource) {
  return (table, conditionTree, fields, sort, limit) =>
    dataSource.getCollection(table).list(
      {
        conditionTree,
        ...(sort ? { sort: [sort] } : {}),
        ...(limit ? { page: { skip: 0, limit } } : {}),
      },
      fields,
    );
}

/** A real IBAN check: the two check digits over the moved, letters-as-numbers account number. */
function ibanValid(iban) {
  const text = String(iban || '').replace(/\s/g, '');
  if (text.length < 15) return false;
  const moved = `${text.slice(4)}${text.slice(0, 4)}`.replace(/[A-Z]/g, c =>
    String(c.charCodeAt(0) - 55),
  );

  return mod97(moved) === 1;
}

/** The latest line of the transfer's history for one field (payee_check, call_back...). */
async function lastLine(list, transferId, field) {
  const [line] = await list(
    'status_changes',
    and(
      leaf('record_type', 'OUTGOING_TRANSFERS'),
      leaf('record_id', transferId),
      leaf('field', field),
    ),
    ['new_value', 'reason', 'changed_at', 'changed_by'],
    { field: 'changed_at', ascending: false },
    1,
  );

  return line || null;
}

/** Who signs for the account: the holder, or a company's signatory. */
async function holderOf(list, customerId) {
  const members = await list(
    'customer_members',
    and(leaf('customer_id', customerId), leaf('role', ['HOLDER', 'SIGNATORY'])),
    ['individual_id', 'role'],
  );

  return members[0]?.individual_id || null;
}

/**
 * The number to call back: the one on file, or the one before a change of the last 30 days (a
 * fraudster changes the phone number first, so the real customer still has the old one).
 */
async function phoneToCall(list, customerId, at = new Date()) {
  const individualId = await holderOf(list, customerId);
  if (!individualId) return { number: 'no number on file', note: '' };
  const [person] = await list('individuals', leaf('id', individualId), ['phone']);
  const [change] = await list(
    'customer_change_requests',
    and(leaf('individual_id', individualId), leaf('field', 'PHONE'), leaf('status', 'APPROVED')),
    ['old_value', 'decided_at'],
    { field: 'decided_at', ascending: false },
    1,
  );

  if (change && ago(change.decided_at, at) <= CHANGE_DAYS) {
    return {
      number: change.old_value,
      note: `the number on file before the change of ${frDate(change.decided_at)}`,
    };
  }

  return { number: person?.phone || 'no number on file', note: 'the number on file' };
}

const TRANSFER_FIELDS = [
  'id',
  'transaction_id',
  'beneficiary_id',
  'scheme',
  'initiated_via',
  'sca_method',
  'requested_execution_date',
  'payee_check',
  'validation_status',
  'is_standing_order',
];

/** Everything known about one transfer, from its own rows (no outside check involved). */
async function facts(list, transfer) {
  const [tx] = await list('transactions', leaf('id', transfer.transaction_id), [
    'id',
    'account_id',
    'amount',
    'status',
    'created_at',
    'device_id',
    'description',
    'reference',
  ]);
  if (!tx) return null;
  const [[account], [payee], device] = await Promise.all([
    list('accounts', leaf('id', tx.account_id), [
      'id',
      'iban',
      'balance',
      'available_balance',
      'customer_id',
    ]),
    list('sct_beneficiaries', leaf('id', transfer.beneficiary_id), [
      'id',
      'iban',
      'bic',
      'bank_name',
      'is_saved',
      'added_at',
      'added_from_device_id',
      'payee_check',
      'payee_check_name',
      'counterparty_id',
    ]),
    tx.device_id
      ? list('devices', leaf('id', tx.device_id), [
          'device_name',
          'platform',
          'first_seen_at',
        ]).then(rows => rows[0] || null)
      : null,
  ]);
  // Computed fields see the tables before their links are added: no relation paths here.
  const [[customer], [counterparty]] = await Promise.all([
    list('customers', leaf('id', account.customer_id), ['display_name', 'customer_type']),
    payee ? list('counterparties', leaf('id', payee.counterparty_id), ['name', 'country']) : [],
  ]);
  if (payee) payee.counterparty = counterparty || null;
  const since = new Date(new Date(tx.created_at).getTime() - 180 * DAY).toISOString();
  const [earlier, debits, changes, alerts] = await Promise.all([
    list('outgoing_transfers', leaf('beneficiary_id', transfer.beneficiary_id), [
      'id',
      'transaction_id',
    ]).then(rows => {
      const ids = rows.filter(o => o.id !== transfer.id).map(o => o.transaction_id);

      return ids.length
        ? list('transactions', and(leaf('id', ids), leaf('status', 'BOOKED')), [
            'amount',
            'created_at',
          ])
        : [];
    }),
    list(
      'transactions',
      and(
        leaf('account_id', account.id),
        leaf('direction', 'DEBIT'),
        leaf('status', 'BOOKED'),
        { field: 'rail', operator: 'NotIn', value: ['FEE', 'INTERNAL'] },
        { field: 'created_at', operator: 'GreaterThan', value: since },
      ),
      ['id', 'amount', 'description', 'created_at'],
      { field: 'amount', ascending: false },
      2,
    ),
    list(
      'customer_change_requests',
      leaf('customer_id', account.customer_id),
      ['field', 'status', 'channel', 'requested_at'],
      { field: 'requested_at', ascending: false },
    ),
    list(
      'alerts',
      and(leaf('customer_id', account.customer_id), leaf('status', ['OPEN', 'IN_REVIEW'])),
      ['reference', 'alert_type', 'triggered_at'],
    ),
  ]);

  return {
    transfer,
    tx,
    account,
    customer,
    payee,
    device,
    paid: earlier,
    largest: debits.find(d => d.id !== tx.id) || null,
    changes: changes.filter(c => ago(c.requested_at, tx.created_at) <= CHANGE_DAYS),
    alerts,
  };
}

const PAYEE_NAME = f => f.payee?.counterparty?.name || 'the payee';
const isNewPayee = f => !f.payee?.is_saved || ago(f.payee.added_at, f.tx.created_at) <= NEW_DAYS;
const isNewDevice = f => f.device && ago(f.device.first_seen_at, f.tx.created_at) <= NEW_DAYS;
/** What a takeover looks like: a device seen for 2 days at most, plus a change or a new payee. */
const looksLikeTakeover = f =>
  Boolean(f.device) &&
  ago(f.device.first_seen_at, f.tx.created_at) <= 2 &&
  (f.changes.some(c => ago(c.requested_at, f.tx.created_at) <= NEW_DAYS) ||
    f.payee?.added_from_device_id === f.tx.device_id);

const takesMost = f => {
  const left = Number(f.account.available_balance);

  return Number(f.tx.amount) / (Math.max(left, 0) + Number(f.tx.amount)) >= 0.9;
};

const unusual = f => f.largest && Number(f.tx.amount) > UNUSUAL_RATIO * Number(f.largest.amount);

const SCHEMES = {
  SEPA: 'SEPA credit transfer: arrives the next business day',
  SEPA_INSTANT: 'SEPA Instant: arrives in seconds, cannot be stopped once sent',
};
const SCA = {
  APP_CONFIRMATION: `${OK} Confirmed in the banking app`,
  BIOMETRIC: `${OK} Face or fingerprint in the banking app`,
  EXEMPTED: '○ Exempted: standing order set up earlier',
};

function transferFields(f) {
  const { transfer, tx, account, customer } = f;
  const phoneChange = f.changes.find(c => c.field === 'PHONE');
  let sca = SCA[transfer.sca_method] || '○ Not recorded';

  if (transfer.sca_method === 'SMS_OTP') {
    sca = phoneChange
      ? `${LOOK} SMS code, sent to the phone number changed on ${frDate(phoneChange.requested_at)}`
      : `${OK} SMS code sent to the phone number on file`;
  }

  const via =
    transfer.initiated_via === 'API'
      ? 'API: sent by the company’s accounting software'
      : `Banking app${f.device ? `, on ${f.device.device_name}` : ''}`;

  return {
    tr_amount: `${euros(tx.amount)} from ${customer.display_name} (${account.iban})${
      Number(tx.amount) > FOUR_EYES
        ? ` · above ${euros(FOUR_EYES)}: a second operator approves`
        : ''
    }`,
    tr_scheme: SCHEMES[transfer.scheme] || transfer.scheme,
    tr_requested: `Asked on ${stamp(tx.created_at)}, to send on ${frDate(
      transfer.requested_execution_date,
    )}${transfer.is_standing_order ? ' (standing order)' : ''}${
      tx.reference ? ` · reference "${tx.reference}"` : ''
    }`,
    tr_via: via,
    tr_sca: sca,
  };
}

function payeeFields(f) {
  const { payee, tx, paid } = f;
  if (!payee) return { py_beneficiary: `${BAD} No payee on file` };
  let saved = `${OK} Saved payee since ${frDate(payee.added_at)}`;

  if (!payee.is_saved) {
    saved = `${LOOK} One-off payee, not saved`;
  } else if (isNewPayee(f)) {
    const from =
      payee.added_from_device_id && payee.added_from_device_id === tx.device_id && f.device
        ? `, from ${f.device.device_name}, the device that sends the transfer`
        : '';
    saved = `${LOOK} New payee: added ${span(
      payee.added_at,
      tx.created_at,
    )} before the transfer (${stamp(payee.added_at)})${from}`;
  }

  const largest = paid.reduce((max, p) => Math.max(max, Number(p.amount)), 0);
  const first = paid.map(p => p.created_at).sort()[0];

  return {
    py_beneficiary: `${PAYEE_NAME(f)} · ${payee.iban} · ${payee.bank_name} (${payee.bic}) · ${
      payee.counterparty?.country || '?'
    }`,
    py_saved: saved,
    py_history: paid.length
      ? `${OK} ${paid.length} earlier payment${paid.length > 1 ? 's' : ''} since ${frDate(
          first,
        )}, largest ${euros(largest)}`
      : `${LOOK} First payment to this payee`,
  };
}

const VOP = {
  MATCH: f => `${OK} Match: "${PAYEE_NAME(f)}" is the name on the account`,
  CLOSE_MATCH: f =>
    `${LOOK} Close match: the name on the account is "${
      f.payee.payee_check_name || '?'
    }" (the customer typed "${PAYEE_NAME(f)}")`,
  NO_MATCH: f =>
    `${BAD} No match: the account is not in the name of "${PAYEE_NAME(
      f,
    )}" (the other bank does not say whose it is)`,
  NOT_POSSIBLE: () => `${LOOK} Not possible: the other bank does not answer name checks`,
};

/** The Verification of Payee, once "Check the payee" ran: its answer is a history line. */
function payeeCheckFields(f, line) {
  if (!line) {
    const waiting = 'Not checked yet: the workflow runs "Check the payee"';

    return { pc_result: waiting, pc_iban: waiting };
  }

  const [ref] = String(line.reason || '').split(' · ');
  const seen =
    line.new_value !== 'MATCH' && f.transfer.payee_check === line.new_value
      ? ' The customer saw the same warning when sending it and went on.'
      : '';
  const { payee } = f;

  return {
    pc_result: `${(VOP[line.new_value] || VOP.NOT_POSSIBLE)(f)} (${ref}, ${stamp(
      line.changed_at,
    )}).${seen}`,
    pc_iban: ibanValid(payee.iban)
      ? `${OK} Valid IBAN, account open at ${payee.bank_name} (${payee.bic}), ${
          payee.counterparty?.country || '?'
        }`
      : `${BAD} Invalid IBAN: the check digits do not add up`,
  };
}

function accountFields(f) {
  const { tx, account, largest } = f;
  const waiting = ['PENDING', 'HELD'].includes(tx.status);
  const left = Number(waiting ? account.available_balance : account.balance);
  const share = Math.round((Number(tx.amount) / (Math.max(left, 0) + Number(tx.amount))) * 100);
  let usual = `○ No other payment in 6 months`;

  if (largest) {
    const what = `${euros(largest.amount)}, ${largest.description}, ${frDate(largest.created_at)}`;
    usual = unusual(f)
      ? `${LOOK} ${
          Math.round((Number(tx.amount) / Number(largest.amount)) * 10) / 10
        } times the largest payment of the last 6 months (${what})`
      : `${OK} Largest payment of the last 6 months: ${what}`;
  }

  return {
    ac_after: takesMost(f)
      ? `${LOOK} ${euros(
          left,
        )} left once sent: this transfer takes ${share}% of the money on the account`
      : `${OK} ${euros(left)} left once sent (${share}% of the money on the account goes)`,
    ac_usual: usual,
  };
}

const CHANNEL_WORDS = {
  APP: 'in the app',
  WEB: 'on the website',
  PHONE: 'by phone to support',
  BRANCH: 'at a branch',
};
const CHANGE_WORDS = { PHONE: 'Phone number', EMAIL: 'Email', ADDRESS: 'Address', NAME: 'Name' };
const ALERT_WORDS = code => code.replace(/_/g, ' ').toLowerCase();

function deviceText(f) {
  const { tx, device } = f;
  if (!device) return '○ Sent through the API: no phone or browser involved';

  return isNewDevice(f)
    ? `${LOOK} New device: ${device.device_name} (${device.platform}), first seen ${span(
        device.first_seen_at,
        tx.created_at,
      )} before the transfer`
    : `${OK} Usual device: ${device.device_name}, used since ${monthYear(device.first_seen_at)}`;
}

/** Every risk signal of the transfer, in a few words each. */
function signalsOf(f, vop) {
  const check = vop?.new_value || f.transfer.payee_check;
  const change = f.changes[0];

  return [
    isNewPayee(f) && (f.payee?.is_saved ? 'new payee' : 'one-off payee'),
    !f.paid.length && 'first payment to this payee',
    check && check !== 'MATCH' && `payee check ${check.replace('_', ' ').toLowerCase()}`,
    isNewDevice(f) && 'new device',
    change &&
      `${CHANGE_WORDS[change.field].toLowerCase()} changed ${span(
        change.requested_at,
        f.tx.created_at,
      )} before`,
    f.alerts.length && 'an open alert',
    unusual(f) && 'amount far above the usual',
    takesMost(f) && 'empties the account',
  ].filter(Boolean);
}

const changeText = (c, f) =>
  `${CHANGE_WORDS[c.field]} changed ${span(c.requested_at, f.tx.created_at)} before (${stamp(
    c.requested_at,
  )}, ${CHANNEL_WORDS[c.channel] || c.channel}, ${c.status.toLowerCase()})`;
const alertText = a =>
  `${a.reference}: ${ALERT_WORDS(a.alert_type)}, open since ${frDate(a.triggered_at)}`;

function signalFields(f, vop) {
  const found = signalsOf(f, vop);

  return {
    sg_device: deviceText(f),
    sg_changes: f.changes.length
      ? `${LOOK} ${f.changes.map(c => changeText(c, f)).join(' · ')}`
      : `${OK} No change of phone, email or address in the last ${CHANGE_DAYS} days`,
    sg_alerts: f.alerts.length
      ? `${LOOK} ${f.alerts.map(alertText).join(' · ')}`
      : `${OK} No open alert on this customer`,
    sg_result: found.length
      ? `${LOOK} ${found.length} risk signal${found.length > 1 ? 's' : ''}: ${found.join(', ')}`
      : `${OK} No risk signal: known payee, usual device, usual amounts`,
  };
}

const CALL = {
  CONFIRMED: `${OK} Confirmed by the customer`,
  DENIED: `${BAD} The customer denies making it`,
  NOT_REACHED: `${LOOK} Not reached`,
};

/** The call back, once "Call customer back" ran: what the customer said, as a history line. */
async function callFields(list, f, line) {
  if (!line) {
    const waiting = 'Not called yet: the workflow runs "Call customer back"';

    return { call_result: waiting, call_number: waiting };
  }

  const phone = await phoneToCall(list, f.account.customer_id, f.tx.created_at);

  return {
    call_result: `${CALL[line.new_value] || line.new_value}: ${line.reason} (${stamp(
      line.changed_at,
    )}, ${line.changed_by})`,
    call_number: `${phone.number}, ${phone.note}`,
  };
}

/** What the customer says when called, for the demo: a takeover victim denies, others confirm. */
function scriptedAnswer(f) {
  if (looksLikeTakeover(f)) {
    return ['Customer denies', 'Did not make this transfer, and did not change their phone number'];
  }

  return [
    'Confirmed by customer',
    `Confirms the ${euros(f.tx.amount)} to ${PAYEE_NAME(f)}${
      f.tx.reference ? ` (${f.tx.reference.toLowerCase()})` : ''
    }`,
  ];
}

async function evidence(list, transfer) {
  const f = await facts(list, transfer);
  if (!f) return {};
  const [vop, call] = await Promise.all([
    lastLine(list, transfer.id, 'payee_check'),
    lastLine(list, transfer.id, 'call_back'),
  ]);

  return {
    ...transferFields(f),
    ...payeeFields(f),
    ...payeeCheckFields(f, vop),
    ...accountFields(f),
    ...signalFields(f, vop),
    ...(await callFields(list, f, call)),
  };
}

// field: label. The prefix groups them, so a workflow step can read one group by its name.
const LABELS = {
  tr_amount: 'Transfer · Amount',
  tr_scheme: 'Transfer · Scheme',
  tr_requested: 'Transfer · Requested',
  tr_via: 'Transfer · Initiated via',
  tr_sca: 'Transfer · Customer authentication',
  py_beneficiary: 'Payee · Beneficiary',
  py_saved: 'Payee · Saved or new',
  py_history: 'Payee · Earlier payments',
  pc_result: 'Payee check · Result',
  pc_iban: 'Payee check · IBAN',
  ac_after: 'Account · Balance after',
  ac_usual: 'Account · Usual largest payment',
  sg_device: 'Signals · Device',
  sg_changes: 'Signals · Recent changes',
  sg_alerts: 'Signals · Alerts',
  sg_result: 'Signals · Result',
  call_result: 'Call · Result',
  call_number: 'Call · Number called',
};
const FIELDS = Object.keys(LABELS);

function addTransferEvidence(collection) {
  // One computation per transfer and request, whichever fields are asked for.
  const cache = new WeakMap();

  const evidenceOf = (record, context) => {
    if (!cache.has(record)) cache.set(record, evidence(reader(context.dataSource), record));

    return cache.get(record);
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: 'String',
      dependencies: TRANSFER_FIELDS,
      getValues: (records, context) =>
        Promise.all(records.map(async r => (await evidenceOf(r, context))?.[name] ?? null)),
    }),
  );
}

export {
  FIELDS,
  LABELS,
  TRANSFER_FIELDS,
  addTransferEvidence,
  facts,
  ibanValid,
  lastLine,
  phoneToCall,
  reader,
  scriptedAnswer,
};
