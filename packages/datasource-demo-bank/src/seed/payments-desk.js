/**
 * The open work of the payments desk, one case per path of its two guided workflows: high-value
 * transfers waiting for validation and recalls other banks sent us. Written once every other wave is done, on customers no other case touches, with
 * no draw from the seeded stream: ids, amounts and numbers come from hashes, so the rest of the
 * data stays exactly as it was. Each case belongs to a customer picked by a rule (the first
 * customer, in the order they were created, that fits), so the same people carry the same story.
 *
 * Transfers to validate:
 * - a flat deposit to a notary: new payee, first payment, far above the usual (call, confirmed);
 * - an account takeover: new phone, phone number changed the day before, new payee abroad, most of
 *   the balance (call, the customer denies);
 * - a supplier invoice paid through the API to an account in another name (payee check no match);
 * - a regular supplier, nothing unusual (approve).
 * Recalls we received:
 * - fraud, the money still there (escalate, hold, return);
 * - fraud, the money forwarded abroad within the hour (refuse, AM04);
 * - a duplicate (ask our customer's consent);
 * - a wrong IBAN, our customer agreed (return);
 * - a wrong amount, our customer refused (refuse, CUST).
 */
const { createHash } = require('crypto');

const { DAY, NOW, iso, isoDate, round2 } = require('./random');
const { frenchIban, mod97 } = require('./reference');

const HOUR = 3600 * 1000;
const PAYMENTS = 'elodie.fontaine@forest-lab-bank.fr';
const SUPPORT = 'yanis.mercier@forest-lab-bank.fr';

// ---- deterministic ids and numbers (no draw from the seeded stream) ------------------------------

const hash = key => createHash('md5').update(`forest-lab-payments:${key}`).digest('hex');

const uid = key => {
  const h = hash(key);

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
    20,
    32,
  )}`;
};

const digits = (key, n) =>
  String(parseInt(hash(key).slice(0, 12), 16))
    .slice(-n)
    .padStart(n, '0');
// Each case keeps its own minutes past the hour, the same on every build (never after now).
const hoursAgo = (h, key) =>
  new Date(NOW.getTime() - h * HOUR + (Number(digits(`${key}:minutes`, 2)) % 55) * 60000);
const plusHours = (date, h) => new Date(new Date(date).getTime() + h * HOUR);
const toDate = v => new Date(String(v).replace(' +00:00', 'Z').replace(' ', 'T'));

const BANKS = {
  CDC: ['40031', 'CDCGFRPPXXX', 'Caisse des Dépôts'],
  BNP: ['30004', 'BNPAFRPPXXX', 'BNP Paribas'],
  SG: ['30003', 'SOGEFRPPXXX', 'Société Générale'],
  LCL: ['30002', 'CRLYFRPPXXX', 'LCL'],
  BOURSO: ['40618', 'BOUSFRPPXXX', 'Boursorama'],
  QONTO: ['16958', 'QNTOFRP1XXX', 'Qonto'],
};

function bankAccount(key, bank) {
  const [code, bic, name] = BANKS[bank];

  return {
    iban: frenchIban(Number(digits(`${key}:account`, 11)), code, digits(`${key}:branch`, 5)),
    bic,
    bank_name: name,
  };
}

/** An account at the Lithuanian e-money bank the mule rings use (reference.js FOREIGN_BANKS). */
function lithuanianAccount(key) {
  const bban = `32500${digits(`${key}:lt`, 11)}`;
  const check = String(98 - mod97(`${bban}212900`)).padStart(2, '0');

  return {
    iban: `LT${check}${bban}`.replace(/(.{4})/g, '$1 ').trim(),
    bic: 'BALTLT22XXX',
    bank_name: 'UAB Baltic Pay',
  };
}

// ---- the ledger: a booked line lands in date order, the running balance follows -----------------

const signed = tx => (tx.direction === 'CREDIT' ? Number(tx.amount) : -Number(tx.amount));

function bookedLines(state, account) {
  return (state.txOf.get(account.id) || [])
    .filter(t => t.status === 'BOOKED')
    .sort((a, b) => (a.booked_at < b.booked_at ? -1 : 1));
}

/** Books a line in the past: every later running balance and the account move with it. */
function book(state, account, tx) {
  const lines = bookedLines(state, account);
  const before = lines.filter(t => t.booked_at <= tx.booked_at);
  const first = lines[0];
  const opening = first ? round2(Number(first.balance_after) - signed(first)) : 0;
  const previous = before.length ? Number(before[before.length - 1].balance_after) : opening;
  Object.assign(tx, { balance_after: round2(previous + signed(tx)) });
  lines
    .filter(t => t.booked_at > tx.booked_at)
    .forEach(t => {
      Object.assign(t, { balance_after: round2(Number(t.balance_after) + signed(tx)) });
    });
  state.rows.transactions.push(tx);
  state.txOf.get(account.id).push(tx);
  const last = [...lines, tx].reduce((a, b) => (a.booked_at > b.booked_at ? a : b));
  Object.assign(account, {
    balance: round2(Number(account.balance) + signed(tx)),
    available_balance: round2(Number(account.available_balance) + signed(tx)),
    last_activity_at: last.booked_at,
  });
}

/** The lowest the balance goes from `date` on: what can leave the account without overdraft. */
function lowestFrom(state, account, date) {
  const lines = bookedLines(state, account);
  const before = lines.filter(t => t.booked_at < date);
  // The balance at `date`, then every balance after it.
  const start = before.length ? Number(before[before.length - 1].balance_after) : Infinity;

  return lines
    .filter(t => t.booked_at >= date)
    .reduce((low, t) => Math.min(low, Number(t.balance_after)), start);
}

function txRow(key, account, fields) {
  return {
    id: uid(`${key}:tx`),
    account_id: account.id,
    counterparty_id: null,
    initiated_by_id: null,
    device_id: null,
    rail: 'TRANSFER',
    currency: 'EUR',
    status: 'BOOKED',
    booked_at: null,
    value_date: null,
    balance_after: null,
    reference: null,
    status_reason: null,
    reversed_at: null,
    category: 'TRANSFERS',
    ...fields,
  };
}

// ---- references and history ---------------------------------------------------------------------

/** The next number of a series this year, after the highest one given so far. */
function nextReference(list, prefix, key) {
  const year = String(NOW.getUTCFullYear());
  const start = `${prefix}-${year}-`;
  const top = list
    .map(r => r.reference)
    .filter(r => r && r.startsWith(start))
    .reduce((max, r) => Math.max(max, Number(r.slice(start.length))), 100);

  return `${start}${String(top + 1 + (Number(digits(key, 1)) % 9)).padStart(6, '0')}`;
}

function trail(rows, type, record, steps) {
  let previous = null;
  steps.forEach(([status, when, by, reason], k) => {
    rows.status_changes.push({
      id: uid(`${record.id}:history:${k}`),
      record_type: type,
      record_id: record.id,
      field: 'status',
      old_value: previous,
      new_value: status,
      changed_by: by || 'system',
      changed_at: iso(when),
      reason: reason || null,
    });
    previous = status;
  });
}

// ---- who carries which case ---------------------------------------------------------------------

/**
 * Customers a case can land on: active, outside the stories, their account open. Only what is
 * fixed when a customer is created decides who comes first (balances and the other cases change
 * with the date of the build), so the same customer carries the same case on every build.
 */
function freeCustomers(state) {
  const { rows, stories } = state;
  const gone = new Set();
  (rows.insolvency_proceedings || []).forEach(r => gone.add(r.customer_id));
  // Nor a customer whose holder died, or who is leaving the bank.
  const dead = new Set((rows.deceased_cases || []).map(d => d.individual_id));
  rows.customer_members
    .filter(m => dead.has(m.individual_id))
    .forEach(m => gone.add(m.customer_id));
  (rows.closures || []).filter(c => c.status !== 'CANCELLED').forEach(c => gone.add(c.customer_id));

  return rows.customers.filter(
    c => c.status === 'ACTIVE' && !gone.has(c.id) && !stories?.has(c.id),
  );
}

function partyOf(state, customer) {
  const { rows } = state;
  const account = rows.accounts.find(
    a => a.customer_id === customer.id && a.status === 'ACTIVE' && a.type !== 'SAVINGS',
  );
  const member = rows.customer_members.find(
    m =>
      m.customer_id === customer.id &&
      ['HOLDER', 'SIGNATORY'].includes(m.role) &&
      m.can_initiate_payments &&
      !m.until,
  );
  const person = member && rows.individuals.find(i => i.id === member.individual_id);
  const device = person
    ? rows.devices
        .filter(
          d =>
            d.individual_id === person.id &&
            !d.revoked_at &&
            NOW - toDate(d.first_seen_at) > 60 * DAY,
        )
        .sort((a, b) => (a.first_seen_at < b.first_seen_at ? 1 : -1))[0]
    : null;

  const savings = rows.accounts.find(
    a => a.customer_id === customer.id && a.status === 'ACTIVE' && a.type === 'SAVINGS',
  );

  return account && person ? { customer, account, person, device, savings } : null;
}

/** The first free customer of that type the rule accepts, never one already given a case. */
function pickCustomer(state, type, accepts) {
  for (const customer of state.free) {
    if (customer.customer_type === type && !state.taken.has(customer.id)) {
      const party = partyOf(state, customer);

      if (party && accepts(party)) {
        state.taken.add(customer.id);

        return party;
      }
    }
  }

  return null;
}

const available = party => Number(party.account.available_balance);
const withDevice = party => Boolean(party.device);
// The sanctions wave freezes a foreign customer first (disputes.js): our cases go to French ones.
const french = party => party.person.nationality === 'FR';
// A comfortable income (set when the customer is created): the account is not overdrawn.
const wellOff = party => Number(party.customer.expected_monthly_in) >= 3000;
const savingsOf = party => Number(party.savings?.balance || 0);

/** Money moved from the customer's savings account to their current account, booked on both. */
function fromSavings(state, key, party, { amount, at, device }) {
  const when = iso(at);
  const fields = {
    rail: 'INTERNAL',
    amount,
    initiated_by_id: party.person.id,
    device_id: device?.id || null,
    created_at: when,
    booked_at: when,
    value_date: isoDate(at),
  };
  book(
    state,
    party.savings,
    txRow(`${key}:savings-out`, party.savings, {
      ...fields,
      direction: 'DEBIT',
      description: 'VIR INTERNE VERS COMPTE COURANT',
    }),
  );
  book(
    state,
    party.account,
    txRow(`${key}:savings-in`, party.account, {
      ...fields,
      direction: 'CREDIT',
      description: 'VIR INTERNE DEPUIS LIVRET',
    }),
  );
}

function counterparty(state, key, type, name, country, since) {
  const row = {
    id: uid(`${key}:counterparty`),
    counterparty_type: type,
    name,
    country,
    risk_level: 'LOW',
    is_blocked: false,
    first_seen_at: iso(since),
    last_screened_at: iso(since),
    blocked_at: null,
    block_reason: null,
  };
  state.rows.counterparties.push(row);

  return row;
}

/** A transfer another bank's customer sent ours, booked on the account. */
function credit(state, key, party, { payer, bank, amount, at, remittance, instant }) {
  const dates = Array.isArray(at) ? at : [at];
  const party2 = counterparty(state, key, 'SCT_EMITTER', payer, 'FR', plusHours(dates[0], -1));
  const emitter = {
    id: uid(`${key}:emitter`),
    counterparty_id: party2.id,
    customer_id: party.customer.id,
    ...bankAccount(key, bank),
  };
  state.rows.sct_emitters.push(emitter);
  const payments = dates.map((when, k) => {
    const tx = txRow(`${key}:${k}`, party.account, {
      counterparty_id: party2.id,
      direction: 'CREDIT',
      amount,
      description: `VIR SEPA ${instant ? 'INST ' : ''}${payer.toUpperCase()} ${remittance}`,
      reference: remittance,
      created_at: iso(when),
      booked_at: iso(when),
      value_date: isoDate(when),
    });
    book(state, party.account, tx);
    const incoming = {
      id: uid(`${key}:${k}:incoming`),
      transaction_id: tx.id,
      emitter_id: emitter.id,
      scheme: instant ? 'SEPA_INSTANT' : 'SEPA',
      end_to_end_id: `E2E${hash(`${key}:${k}:e2e`).slice(0, 13).toUpperCase()}`,
      purpose_code: null,
      remittance_info: remittance,
    };
    state.rows.incoming_transfers.push(incoming);

    return { tx, incoming };
  });

  return { emitter, payments };
}

/** A client's payment to a company short of money for the case: its account can pay. */
function topUp(state, key, party, needed) {
  const short = needed - available(party);
  if (short <= 0) return;
  const amount = Math.ceil((short + 5000) / 1000) * 1000;
  credit(state, `${key}:client`, party, {
    payer: 'Groupe Hexa Distribution',
    bank: 'SG',
    amount,
    at: hoursAgo(30, key),
    remittance: `REGLEMENT FACTURE ${digits(`${key}:client`, 4)}`,
  });
}

// ---- transfers to validate ----------------------------------------------------------------------

function newPayee(state, key, party, { name, country, bankAccount: bank, added, device, check }) {
  const party2 = counterparty(state, `${key}:payee`, 'SCT_BENEFICIARY', name, country, added);
  const row = {
    id: uid(`${key}:payee`),
    counterparty_id: party2.id,
    customer_id: party.customer.id,
    added_from_device_id: device?.id || null,
    ...bank,
    nickname: name.split(' ')[0],
    is_saved: true,
    payee_check: check,
    payee_check_name: null,
    is_trusted: false,
    added_at: iso(added),
    removed_at: null,
    last_used_at: null,
  };
  state.rows.sct_beneficiaries.push(row);

  return row;
}

/** A transfer above the threshold, waiting: the money is reserved, nothing is booked yet. */
function waitingTransfer(state, key, party, payee, fields) {
  const { account, person } = party;
  const { created } = fields;
  const tx = txRow(key, account, {
    counterparty_id: payee.counterparty_id,
    initiated_by_id: person.id,
    device_id: fields.device === undefined ? party.device.id : fields.device?.id || null,
    direction: 'DEBIT',
    amount: fields.amount,
    status: 'PENDING',
    description: fields.description,
    reference: fields.reference || null,
    created_at: iso(created),
  });
  state.rows.transactions.push(tx);
  state.txOf.get(account.id).push(tx);
  state.rows.outgoing_transfers.push({
    id: uid(`${key}:transfer`),
    transaction_id: tx.id,
    beneficiary_id: payee.id,
    scheme: fields.scheme || 'SEPA',
    initiated_via: fields.via || 'BANKING_APP',
    end_to_end_id: `E2E${hash(`${key}:e2e`).slice(0, 13).toUpperCase()}`,
    payee_check: payee.payee_check,
    validation_status: 'PENDING',
    validated_by: null,
    validated_at: null,
    requested_execution_date: isoDate(created),
    rejection_reason: null,
    sca_method: fields.sca,
    purpose_code: fields.purpose || null,
    is_standing_order: false,
  });
  Object.assign(account, {
    available_balance: round2(Number(account.available_balance) - fields.amount),
  });
  Object.assign(payee, { last_used_at: iso(created) });

  return tx;
}

/** Someone buying a flat: a deposit to the notary, a payee added the day before. */
function flatDeposit(state) {
  const party = pickCustomer(
    state,
    'RETAIL',
    p => french(p) && withDevice(p) && savingsOf(p) >= 40000,
  );
  if (!party) return;
  const key = 'flat-deposit';
  const added = hoursAgo(26, key);
  // The deposit comes from the savings, moved the day before.
  fromSavings(state, key, party, { amount: 30000, at: hoursAgo(25, key), device: party.device });
  const payee = newPayee(state, key, party, {
    name: 'Étude notariale Vasseur',
    country: 'FR',
    bankAccount: bankAccount(key, 'CDC'),
    added,
    device: party.device,
    check: 'MATCH',
  });
  waitingTransfer(state, key, party, payee, {
    created: hoursAgo(3, key),
    amount: 27000,
    description: 'VIR SEPA ETUDE NOTARIALE VASSEUR DEPOT DE GARANTIE',
    reference: 'DEPOT DE GARANTIE ACHAT APPARTEMENT',
    sca: 'BIOMETRIC',
  });
}

/**
 * An account takeover: the phone number changed through support the day before, then a new phone
 * logs in, adds a payee abroad and sends most of the balance; the SMS code goes to the new number.
 */
function takeover(state) {
  const party = pickCustomer(
    state,
    'RETAIL',
    p => french(p) && withDevice(p) && savingsOf(p) >= 15000,
  );
  if (!party) return;
  const key = 'takeover';
  const { rows } = state;
  const { person, customer } = party;
  const oldPhone = person.phone;
  const newPhone = `+33 7 ${digits(`${key}:phone`, 8).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  const change = {
    id: uid(`${key}:change`),
    reference: nextReference(rows.customer_change_requests, 'CHG', key),
    customer_id: customer.id,
    individual_id: person.id,
    requested_from_device_id: null,
    field: 'PHONE',
    old_value: oldPhone,
    new_value: newPhone,
    channel: 'PHONE',
    risk_flags:
      'Caller could not give the last card payment; asked to skip the code to the old phone',
    status: 'APPROVED',
    requested_at: iso(hoursAgo(27, key)),
    decided_by: SUPPORT,
    decided_at: iso(hoursAgo(26.8, key)),
    verification_method: 'NONE',
    rejection_reason: null,
  };
  rows.customer_change_requests.push(change);
  trail(rows, 'CUSTOMER_CHANGE_REQUESTS', change, [
    ['PENDING', hoursAgo(27, key), 'customer'],
    ['APPROVED', hoursAgo(26.8, key), SUPPORT],
  ]);
  Object.assign(person, { phone: newPhone });
  const device = {
    id: uid(`${key}:device`),
    individual_id: person.id,
    fingerprint: hash(`${key}:fingerprint`),
    platform: 'ANDROID',
    device_name: 'Samsung Galaxy A15',
    app_version: '7.14.2',
    first_seen_at: iso(hoursAgo(4.5, key)),
    last_seen_at: iso(hoursAgo(2.5, key)),
    is_trusted: false,
    revoked_at: null,
  };
  rows.devices.push(device);
  rows.login_events.push({
    id: uid(`${key}:login`),
    individual_id: person.id,
    device_id: device.id,
    ip_address: `185.107.${Number(digits(`${key}:ip1`, 3)) % 250}.${
      Number(digits(`${key}:ip2`, 3)) % 250
    }`,
    country: 'FR',
    city: 'Marseille',
    success: true,
    risk_score: 81.5,
    created_at: iso(hoursAgo(4.5, key)),
    event_type: 'LOGIN',
    auth_method: 'SMS_OTP',
    failure_reason: null,
  });
  const payee = newPayee(state, key, party, {
    name: 'Dylan Marchetti',
    country: 'LT',
    bankAccount: lithuanianAccount(key),
    added: hoursAgo(3.5, key),
    device,
    check: 'MATCH',
  });
  // First the savings, moved to the current account from the new phone, then everything out.
  const moved = Math.min(20000, Math.floor((savingsOf(party) - 50) / 100) * 100);
  fromSavings(state, key, party, { amount: moved, at: hoursAgo(3.2, key), device });
  waitingTransfer(state, key, party, payee, {
    created: hoursAgo(3, key),
    amount: Math.floor((available(party) * 0.95) / 10) * 10,
    description: 'VIR SEPA INST DYLAN MARCHETTI',
    reference: 'REMBOURSEMENT',
    scheme: 'SEPA',
    sca: 'SMS_OTP',
    device,
  });
}

/** An invoice paid through the accounting software, to an account that is not the supplier's. */
function supplierNoMatch(state) {
  const party = pickCustomer(state, 'BUSINESS', () => true);
  if (!party) return;
  const key = 'supplier-no-match';
  topUp(state, key, party, 25000);
  const payee = newPayee(state, key, party, {
    name: 'Lefort Emballages',
    country: 'FR',
    bankAccount: bankAccount(key, 'BOURSO'),
    added: hoursAgo(5, key),
    device: null,
    check: 'NO_MATCH',
  });
  waitingTransfer(state, key, party, payee, {
    created: hoursAgo(2, key),
    amount: 18460,
    description: 'VIR SEPA LEFORT EMBALLAGES FACT LE-2026-0412 LEFORT EMBALLAGES',
    reference: 'FACTURE LE-2026-0412',
    purpose: 'SUPP',
    via: 'API',
    sca: 'APP_CONFIRMATION',
    device: null,
  });
}

const largestOf = lines => Math.max(0, ...lines.map(t => Number(t.amount)));

/** A supplier the company has paid every month: nothing to look at, approve. */
function regularSupplier(state) {
  const { rows } = state;
  const payeesOf = new Map();
  rows.outgoing_transfers.forEach(o => {
    if (!payeesOf.has(o.beneficiary_id)) payeesOf.set(o.beneficiary_id, []);
    payeesOf.get(o.beneficiary_id).push(o);
  });
  const txById = new Map(rows.transactions.map(t => [t.id, t]));
  let regular = null;
  const party = pickCustomer(state, 'BUSINESS', p => {
    if (!withDevice(p)) return false;
    [regular] = rows.sct_beneficiaries
      .filter(b => b.customer_id === p.customer.id && b.is_saved && b.payee_check === 'MATCH')
      .map(b => ({
        payee: b,
        paid: (payeesOf.get(b.id) || [])
          .map(o => txById.get(o.transaction_id))
          .filter(t => t?.status === 'BOOKED'),
      }))
      .filter(r => r.paid.length && NOW - toDate(r.payee.added_at) > 60 * DAY)
      .sort((a, b) => largestOf(b.paid) - largestOf(a.paid));

    return Boolean(regular);
  });
  if (!party) return;
  const key = 'regular-supplier';
  const largest = largestOf(regular.paid);
  const amount = round2(Math.max(10600, largest * 1.08));
  topUp(state, key, party, amount * 3);
  const name = rows.counterparties.find(c => c.id === regular.payee.counterparty_id)?.name || '';
  const invoice = digits(`${key}:invoice`, 5);
  waitingTransfer(state, key, party, regular.payee, {
    created: hoursAgo(1, key),
    amount,
    description: `VIR SEPA ${name.toUpperCase()} FACT ${invoice} ${name.toUpperCase()}`,
    reference: `FACTURE ${invoice}`,
    purpose: 'SUPP',
    sca: 'APP_CONFIRMATION',
  });
}

// ---- recalls we received ------------------------------------------------------------------------

const REASON_CODES = {
  FRAUD: 'FRAD',
  DUPLICATE: 'DUPL',
  WRONG_IBAN: 'AC03',
  WRONG_AMOUNT: 'AM09',
};

function recall(state, key, party, payment, emitter, fields) {
  const { rows } = state;
  const row = {
    id: uid(`${key}:recall`),
    reference: nextReference(rows.sepa_disputes, 'SEP', key),
    customer_id: party.customer.id,
    transaction_id: payment.tx.id,
    direct_debit_id: null,
    incoming_transfer_id: payment.incoming.id,
    outgoing_transfer_id: null,
    dispute_request_id: null,
    alert_id: null,
    return_transaction_id: null,
    scheme: payment.incoming.scheme === 'SEPA_INSTANT' ? 'SCT_INST' : 'SCT',
    side: 'WE_ARE_ASKED',
    amount: payment.tx.amount,
    amount_returned: null,
    customer_consent_at: null,
    answered_at: null,
    assigned_to: null,
    other_bank_bic: emitter.bic,
    status: 'OPEN',
    ...fields,
  };
  row.reason_code = REASON_CODES[row.reason];
  row.response_due = isoDate(new Date(toDate(row.requested_at).getTime() + 21 * DAY));
  rows.sepa_disputes.push(row);
  rows.dispute_transactions.push({
    id: uid(`${key}:disputed`),
    transaction_id: payment.tx.id,
    role: 'DISPUTED',
    dispute_request_id: null,
    chargeback_id: null,
    sepa_dispute_id: row.id,
  });

  return row;
}

/** Monitoring raises a money mule alert when a fraud recall arrives (rule INCOMING_FRAUD_RECALL). */
function muleAlert(state, key, party, row, payment) {
  const { rows } = state;
  const rule = rows.rules.find(r => r.name === 'Incoming fraud recall');
  const triggered = plusHours(row.requested_at, 0.5);
  const alert = {
    id: uid(`${key}:alert`),
    reference: nextReference(rows.alerts, 'ALR', key),
    alert_type: 'INCOMING_FRAUD_RECALL',
    category: rule.category,
    rule_id: rule.id,
    source: 'RULE',
    created_by: 'system',
    customer_id: party.customer.id,
    login_event_id: null,
    investigation_id: null,
    severity: rule.default_severity,
    score: 88,
    status: 'OPEN',
    triggered_at: iso(triggered),
    assigned_to: null,
    reviewed_by: null,
    escalated_at: null,
    resolved_at: null,
    clearance_reason: null,
    resolution_notes: null,
  };
  rows.alerts.push(alert);
  rows.alert_transactions.push({
    alert_id: alert.id,
    transaction_id: payment.tx.id,
    role: 'TRIGGER',
  });
  trail(rows, 'ALERTS', alert, [['OPEN', triggered, 'system', rule.code]]);
  Object.assign(row, { alert_id: alert.id });
}

/** A scam victim's money reached our customer: still on the account, nothing held yet. */
function fraudFundsThere(state) {
  const party = pickCustomer(state, 'RETAIL', p => french(p) && wellOff(p));
  if (!party) return;
  const key = 'fraud-funds-there';
  const { emitter, payments } = credit(state, key, party, {
    payer: 'Martine Royer',
    bank: 'BNP',
    amount: 1850,
    at: hoursAgo(70, key),
    remittance: 'LOCATION VACANCES ARCACHON ACOMPTE',
    instant: true,
  });
  const row = recall(state, key, party, payments[0], emitter, {
    type: 'RECALL',
    reason: 'FRAUD',
    requested_at: iso(hoursAgo(5, key)),
  });
  muleAlert(state, key, party, row, payments[0]);
  trail(state.rows, 'SEPA_DISPUTES', row, [
    ['OPEN', hoursAgo(5, key), 'other bank', 'Fraud recall (FRAD) from the payer’s bank'],
  ]);
}

/** The money came in and left within the hour, to a payee abroad: nothing to send back. */
function fraudFundsGone(state) {
  const party = pickCustomer(
    state,
    'RETAIL',
    p => french(p) && withDevice(p) && Number(p.customer.expected_monthly_in) < 2000,
  );
  if (!party) return;
  const key = 'fraud-funds-gone';
  const arrived = hoursAgo(46, key);
  const { emitter, payments } = credit(state, key, party, {
    payer: 'Bruno Carpentier',
    bank: 'LCL',
    amount: 2400,
    at: arrived,
    remittance: 'ACOMPTE TRAVAUX TOITURE',
    instant: true,
  });
  const payee = newPayee(state, key, party, {
    name: 'Remigijus Kazlauskas',
    country: 'LT',
    bankAccount: lithuanianAccount(key),
    added: plusHours(arrived, 0.5),
    device: party.device,
    check: 'MATCH',
  });
  // From 40 minutes later, everything that can leave without overdraft, in instant transfers
  // under the 10,000 EUR validation threshold.
  [0, 1, 2].forEach(k => {
    const out = plusHours(arrived, 0.7 + k / 3);
    const left = round2(Math.min(lowestFrom(state, party.account, iso(out)), available(party)));
    const amount = Math.min(9900, left);
    if (amount <= 0) return;
    const tx = txRow(`${key}:out:${k}`, party.account, {
      counterparty_id: payee.counterparty_id,
      initiated_by_id: party.person.id,
      device_id: party.device.id,
      direction: 'DEBIT',
      amount,
      description: 'VIR SEPA INST REMIGIJUS KAZLAUSKAS',
      reference: 'PRET',
      created_at: iso(out),
      booked_at: iso(out),
      value_date: isoDate(out),
    });
    book(state, party.account, tx);
    Object.assign(payee, { last_used_at: iso(out) });
    state.rows.outgoing_transfers.push({
      id: uid(`${key}:transfer:${k}`),
      transaction_id: tx.id,
      beneficiary_id: payee.id,
      scheme: 'SEPA_INSTANT',
      initiated_via: 'BANKING_APP',
      end_to_end_id: `E2E${hash(`${key}:out:${k}:e2e`).slice(0, 13).toUpperCase()}`,
      payee_check: 'MATCH',
      validation_status: 'NOT_REQUIRED',
      validated_by: null,
      validated_at: null,
      requested_execution_date: isoDate(out),
      rejection_reason: null,
      sca_method: 'BIOMETRIC',
      purpose_code: null,
      is_standing_order: false,
    });
  });
  const row = recall(state, key, party, payments[0], emitter, {
    type: 'RECALL',
    reason: 'FRAUD',
    requested_at: iso(hoursAgo(7, key)),
  });
  muleAlert(state, key, party, row, payments[0]);
  trail(state.rows, 'SEPA_DISPUTES', row, [
    ['OPEN', hoursAgo(7, key), 'other bank', 'Fraud recall (FRAD) from the payer’s bank'],
  ]);
}

/** The payer's bank sent the same transfer twice: our customer has both, nobody asked them yet. */
function duplicate(state) {
  const party = pickCustomer(state, 'RETAIL', p => french(p) && wellOff(p));
  if (!party) return;
  const key = 'duplicate';
  const first = hoursAgo(98, key);
  const { emitter, payments } = credit(state, key, party, {
    payer: 'Garage Lemaire',
    bank: 'SG',
    amount: 1240,
    at: [first, plusHours(first, 0.05)],
    remittance: 'REMBOURSEMENT DEVIS 2026-118',
  });
  const row = recall(state, key, party, payments[1], emitter, {
    type: 'RECALL',
    reason: 'DUPLICATE',
    requested_at: iso(hoursAgo(20, key)),
  });
  trail(state.rows, 'SEPA_DISPUTES', row, [
    ['OPEN', hoursAgo(20, key), 'other bank', 'The payer’s bank sent this transfer twice (DUPL)'],
  ]);
}

/** The amount held once our customer agreed to send it back: it waits for the return. */
function agreedHold(state, key, party, row, placed) {
  const { rows } = state;
  const { amount } = row;
  const hold = {
    id: uid(`${key}:hold`),
    reference: nextReference(rows.holds, 'HLD', key),
    account_id: party.account.id,
    amount,
    reason: 'DISPUTE',
    authority_request_id: null,
    investigation_id: null,
    alert_id: null,
    insolvency_proceeding_id: null,
    screening_hit_id: null,
    chargeback_id: null,
    sepa_dispute_id: row.id,
    placed_by: PAYMENTS,
    placed_at: iso(placed),
    status: 'ACTIVE',
    released_at: null,
    released_by: null,
    release_reason: null,
    expires_at: `${row.response_due} 21:59:59.000 +00:00`,
  };
  rows.holds.push(hold);
  trail(rows, 'HOLDS', hold, [['ACTIVE', placed, PAYMENTS]]);
  Object.assign(party.account, {
    available_balance: round2(Number(party.account.available_balance) - Number(amount)),
  });
}

/** Our customer was asked, answered in the app, and the recall came back to the queue. */
function answeredRecall(state, key, { reason, payer, bank, amount, remittance, agreed, words }) {
  const party = pickCustomer(state, 'RETAIL', p => french(p) && wellOff(p));
  if (!party) return;
  const { rows } = state;
  const { emitter, payments } = credit(state, key, party, {
    payer,
    bank,
    amount,
    at: hoursAgo(9 * 24 + 5, key),
    remittance,
  });
  const requested = hoursAgo(6 * 24 + 2, key);
  const sent = hoursAgo(5 * 24 + 3, key);
  const answered = hoursAgo(26, key);
  const row = recall(state, key, party, payments[0], emitter, {
    type: 'REQUEST_FOR_RECALL',
    reason,
    requested_at: iso(requested),
    assigned_to: PAYMENTS,
    customer_consent_at: agreed ? iso(answered) : null,
  });
  const rfi = {
    id: uid(`${key}:rfi`),
    reference: nextReference(rows.information_requests, 'RFI', key),
    customer_id: party.customer.id,
    addressed_to_id: party.person.id,
    context: 'SEPA_DISPUTE',
    kyc_case_id: null,
    investigation_id: null,
    change_request_id: null,
    dispute_request_id: null,
    chargeback_id: null,
    loan_application_id: null,
    complaint_id: null,
    sepa_dispute_id: row.id,
    collection_case_id: null,
    guarantee_id: null,
    channel: 'APP',
    questions: `The bank of the payer says the transfer of ${amount.toFixed(
      2,
    )} EUR you received was sent by mistake. Do you agree that we return it? The money stays yours, and free to use, unless you agree.`,
    requested_by: PAYMENTS,
    created_at: iso(plusHours(sent, -0.2)),
    sent_at: iso(sent),
    due_at: iso(plusHours(sent, 7 * 24)),
    reminders_sent: 0,
    last_reminder_at: null,
    status: 'ANSWERED',
    answered_at: iso(answered),
    answer: words,
    cancel_reason: null,
  };
  rows.information_requests.push(rfi);
  trail(rows, 'INFORMATION_REQUESTS', rfi, [
    ['DRAFT', plusHours(sent, -0.2), PAYMENTS],
    ['SENT', sent, PAYMENTS],
    ['ANSWERED', answered, 'customer'],
  ]);
  // Not a fraud: nothing held while we asked. Once our customer agrees, the amount is held until
  // the return goes out; when they refuse, the money was always theirs.
  if (agreed) agreedHold(state, key, party, row, plusHours(answered, 0.05));
  trail(rows, 'SEPA_DISPUTES', row, [
    [
      'OPEN',
      requested,
      'other bank',
      `The payer says the payment was a mistake (${row.reason_code})`,
    ],
    ['WAITING_CUSTOMER', sent, PAYMENTS, `${rfi.reference} sent`],
    ['OPEN', answered, 'system', `${rfi.reference} answered: ${agreed ? 'agrees' : 'refuses'}`],
  ]);
}

function paymentsDesk(rows, stories, reserved) {
  const state = { rows, stories, taken: new Set(), txOf: new Map() };
  rows.transactions.forEach(tx => {
    if (!state.txOf.has(tx.account_id)) state.txOf.set(tx.account_id, []);
    state.txOf.get(tx.account_id).push(tx);
  });
  state.free = freeCustomers(state);
  flatDeposit(state);
  takeover(state);
  supplierNoMatch(state);
  regularSupplier(state);
  fraudFundsThere(state);
  fraudFundsGone(state);
  duplicate(state);
  answeredRecall(state, 'wrong-iban', {
    reason: 'WRONG_IBAN',
    payer: 'Hélène Brunet',
    bank: 'QONTO',
    amount: 980,
    remittance: 'LOYER OCTOBRE',
    agreed: true,
    words: 'Yes, I don’t know this person, please send it back.',
  });
  answeredRecall(state, 'wrong-amount', {
    reason: 'WRONG_AMOUNT',
    payer: 'Rolland Utilitaires',
    bank: 'LCL',
    amount: 3200,
    remittance: 'FACTURE 2026-0877',
    agreed: false,
    words:
      'No: 3,200 EUR is the price of the van I sold them, invoice 2026-0877. Nothing to send back.',
  });
  // Kept out of the compliance queues, which pick their customers after this (crime.js).
  state.taken.forEach(id => reserved?.add(id));

  return rows;
}

module.exports = { paymentsDesk };
