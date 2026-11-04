/**
 * The open alerts the guided AML and fraud workflows need, so each queue holds one alert per path
 * whatever the hour: the stories (stories.js) give the mules,
 * the split payments and the takeovers; this wave adds what they lack.
 *
 * - AML, explained by the profile: a yearly bonus from the customer's own employer pushes the
 *   month's income above twice the declared one (rule AML-003).
 * - Takeover where the money already left: the instant transfer of the 30-hours-old takeover went
 *   through before the rule fired (booked, not held): only a recall can bring it back.
 * - New phone, genuine: a customer sets up a new phone at home and pays a new landlord's deposit;
 *   held by rule ATO-001, the customer confirms on the phone.
 * - Login abroad, customer travelling: two logins too far apart (rule ATO-002); the customer does
 *   not pick up, the alert goes to a senior.
 * - The device check and the call of the alerts decided before (the takeover closed last month).
 *
 * Runs last and draws nothing from the shared random stream: ids and choices come from hashes, so
 * the rest of the data stays the same. Customers are picked by a hash among stable candidates.
 */
const { createHash } = require('crypto');

const { ledger, rebalance } = require('./ledger');
const { DAY, NOW, iso, isoDate, round2 } = require('./random');
const { frenchIban } = require('./reference');

const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;
const md5 = text => createHash('md5').update(String(text)).digest('hex');

/** A UUID v4 from a name: the same on every run, never drawn. */
const idFor = name => {
  const h = md5(`forest-lab-alert-cases:${name}`);

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
    20,
    32,
  )}`;
};

const hashInt = (text, low, high) => low + (parseInt(md5(text).slice(0, 8), 16) % (high - low + 1));
const ago = hours => new Date(NOW.getTime() - hours * HOUR);
const toDate = value => new Date(String(value).replace(' +00:00', 'Z').replace(' ', 'T'));
const upper = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** One line of an alert's status history, the first one. */
function opened(ctx, alert, by, reason) {
  ctx.rows.status_changes.push({
    id: idFor(`history:${alert.id}`),
    record_type: 'ALERTS',
    record_id: alert.id,
    field: 'status',
    old_value: null,
    new_value: 'OPEN',
    changed_by: by,
    changed_at: alert.triggered_at,
    reason,
  });
}

function newAlert(ctx, key, { type, customer, triggered, score, loginEvent, lines = [] }) {
  const rule = ctx.rules.get(type);
  const row = {
    id: idFor(`alert:${key}`),
    reference: null,
    alert_type: type,
    category: rule.category,
    rule_id: rule.id,
    source: 'RULE',
    created_by: 'system',
    customer_id: customer.id,
    login_event_id: loginEvent?.id || null,
    investigation_id: null,
    severity: score >= 90 ? 'CRITICAL' : rule.default_severity,
    score,
    status: 'OPEN',
    triggered_at: iso(triggered),
    assigned_to: null,
    reviewed_by: null,
    escalated_at: null,
    resolved_at: null,
    clearance_reason: null,
    resolution_notes: null,
  };
  ctx.rows.alerts.push(row);
  lines.forEach((tx, k) =>
    ctx.rows.alert_transactions.push({
      alert_id: row.id,
      transaction_id: tx.id,
      role: k === 0 ? 'TRIGGER' : 'CONTEXT',
    }),
  );
  opened(ctx, row, 'system', rule.code);

  return row;
}

/**
 * Retail customers no story uses, active, with one holder living in France, a phone and a current
 * account, ordered by a hash of their id and the case: the same pick on every build.
 */
function candidates(ctx, key, used) {
  return ctx.rows.customers
    .filter(c => c.customer_type === 'RETAIL' && c.status === 'ACTIVE' && !ctx.stories.has(c.id))
    .filter(c => !used.has(c.id) && !c.display_name.includes('&'))
    .map(customer => {
      const holder = ctx.holderOf(customer);
      const account = (ctx.accountsOf.get(customer.id) || []).find(
        a => a.type === 'CURRENT' && a.status === 'ACTIVE',
      );
      const phone = holder
        ? (ctx.devicesOf.get(holder.id) || []).find(d => d.platform !== 'WEB' && !d.revoked_at)
        : null;

      return { customer, holder, account, phone };
    })
    .filter(c => c.holder?.country_of_residence === 'FR' && c.account && c.phone)
    .sort((a, b) => md5(`${key}${a.customer.id}`).localeCompare(md5(`${key}${b.customer.id}`)));
}

const lastLogin = (ctx, person) =>
  (ctx.loginsOf.get(person.id) || [])
    .filter(l => l.success && l.event_type === 'LOGIN' && l.country === person.country_of_residence)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

function loginRow(ctx, key, person, device, date, fields) {
  const row = {
    id: idFor(`login:${key}`),
    individual_id: person.id,
    device_id: device.id,
    ip_address: null,
    country: person.country_of_residence,
    city: person.city,
    success: true,
    risk_score: hashInt(`${key}risk`, 300, 1800) / 100,
    created_at: iso(date),
    event_type: 'LOGIN',
    auth_method: 'BIOMETRIC',
    failure_reason: null,
    ...fields,
  };
  ctx.rows.login_events.push(row);
  if (!ctx.loginsOf.has(person.id)) ctx.loginsOf.set(person.id, []);
  ctx.loginsOf.get(person.id).push(row);

  return row;
}

// ---- AML: a bonus from the employer --------------------------------------------------------

// When the bonus lands: 30 hours ago.
const BONUS_PAID = ago(30);

/** The customer's salary payer, when it is the employer they declared. */
function employerOf(ctx, c) {
  // A yearly bonus a third of a year's pay: people earning well, in a company.
  const band = ['FROM_40K_TO_70K', 'FROM_70K_TO_120K', 'ABOVE_120K'].includes(c.holder.income_band);
  if (c.holder.employment_status !== 'EMPLOYED' || !c.holder.employer || !band) return null;
  if (/^(Ministère|Hôpital|Mairie|Région|Département)/.test(c.holder.employer)) return null;
  const salaries = ctx.rows.transactions.filter(
    tx =>
      tx.account_id === c.account.id &&
      tx.category === 'SALARY' &&
      tx.direction === 'CREDIT' &&
      tx.status === 'BOOKED',
  );
  const party = ctx.rows.counterparties.find(
    p => p.name === c.holder.employer && salaries.some(tx => tx.counterparty_id === p.id),
  );
  if (!party) return null;
  // The last salary before the bonus: the month the alert compares with.
  const last = salaries
    .filter(tx => tx.counterparty_id === party.id && toDate(tx.created_at) < BONUS_PAID)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (!last) return null;
  const detail = ctx.rows.incoming_transfers.find(i => i.transaction_id === last.id);

  return detail && BONUS_PAID - toDate(last.created_at) < 35 * DAY ? { party, last, detail } : null;
}

function bonusCase(ctx, used) {
  const found = candidates(ctx, 'bonus', used)
    .map(c => ({ ...c, employer: employerOf(ctx, c) }))
    .find(c => c.employer);
  if (!found) return;
  used.add(found.customer.id);
  const { customer, account, employer } = found;
  const paid = BONUS_PAID;
  const amount = round2(Math.round((Number(customer.expected_monthly_in) * 1.3) / 10) * 10);
  const year = NOW.getUTCFullYear();
  const tx = {
    ...employer.last,
    id: idFor('bonus:tx'),
    amount,
    created_at: iso(paid),
    booked_at: iso(paid),
    value_date: isoDate(paid),
    balance_after: null,
    description: `VIR SEPA ${upper(employer.party.name)} PRIME ${year}`,
    reference: `PRIME ANNUELLE ${year}`,
  };
  // The ledger knows the account before the bonus lands: then its balances are written again.
  ledger(ctx);
  rebalance(ctx, account);
  ctx.rows.transactions.push(tx);
  ctx.rows.incoming_transfers.push({
    ...employer.detail,
    id: idFor('bonus:detail'),
    transaction_id: tx.id,
    end_to_end_id: `E2E${md5('bonus:e2e').slice(0, 13).toUpperCase()}`,
    purpose_code: 'BONU',
    remittance_info: tx.reference,
  });
  ctx.txOf.get(account.id).push(tx);
  rebalance(ctx, account);
  newAlert(ctx, 'bonus', {
    type: 'UNUSUAL_VOLUME',
    customer,
    triggered: new Date(paid.getTime() + 3 * HOUR + 12 * MINUTE),
    score: hashInt('bonus:score', 5200, 6400) / 100,
    lines: [tx, employer.last],
  });
}

// ---- Fraud: the takeover whose money already left ------------------------------------------

/** The open takeover (30 hours old): its instant transfer went out before the rule fired. */
function takeoverSent(ctx) {
  const story = [...ctx.stories.values()].find(s => s.kind === 'TAKEOVER' && s.outcome === 'OPEN');
  const tx = story?.lines.find(l => l.event.role === 'TAKEOVER_OUT')?.tx;
  if (!tx || tx.status !== 'HELD') return;
  const account = ctx.rows.accounts.find(a => a.id === tx.account_id);
  ledger(ctx);
  rebalance(ctx, account);
  const sent = new Date(toDate(tx.created_at).getTime() + 8000);
  Object.assign(tx, {
    status: 'BOOKED',
    status_reason: null,
    booked_at: iso(sent),
    value_date: isoDate(sent),
  });
  // It no longer waits as a pending payment: the balance goes down instead.
  ctx.waiting.set(account.id, round2(ctx.waiting.get(account.id) - Number(tx.amount)));
  rebalance(ctx, account);
}

// ---- Fraud: a genuine new phone and a new payee --------------------------------------------

const LANDLORDS = ['SCI Les Tilleuls', 'SCI du Parc Monceau', 'SCI Les Glycines', 'SCI Belvédère'];

function newPhoneCase(ctx, used) {
  const amount = 1850;
  const taken = new Set(ctx.rows.counterparties.map(p => p.name));
  const name = LANDLORDS.find(n => !taken.has(n));
  const found = candidates(ctx, 'new-phone', used).find(
    c => Number(c.account.available_balance) > amount + 500 && lastLogin(ctx, c.holder),
  );
  if (!found || !name) return;
  used.add(found.customer.id);
  const { customer, holder, account, phone } = found;
  const home = lastLogin(ctx, holder);
  const { platform } = phone;
  const device = {
    id: idFor('new-phone:device'),
    individual_id: holder.id,
    fingerprint: md5('new-phone:fingerprint'),
    platform,
    device_name: platform === 'IOS' ? 'iPhone 16 Pro' : 'Google Pixel 9',
    app_version: phone.app_version,
    first_seen_at: iso(ago(26)),
    last_seen_at: iso(ago(2.5)),
    is_trusted: false,
    revoked_at: null,
  };
  ctx.rows.devices.push(device);
  loginRow(ctx, 'new-phone:setup', holder, device, ago(26), {
    ip_address: home.ip_address,
    auth_method: 'SMS_OTP',
  });
  const login = loginRow(ctx, 'new-phone:login', holder, device, ago(3), {
    ip_address: home.ip_address,
  });
  const party = {
    id: idFor('new-phone:party'),
    counterparty_type: 'SCT_BENEFICIARY',
    name,
    country: 'FR',
    risk_level: 'LOW',
    is_blocked: false,
    first_seen_at: iso(ago(2.9)),
    last_screened_at: iso(ago(2.9)),
    blocked_at: null,
    block_reason: null,
  };
  ctx.rows.counterparties.push(party);
  const payee = {
    id: idFor('new-phone:payee'),
    counterparty_id: party.id,
    customer_id: customer.id,
    added_from_device_id: device.id,
    iban: frenchIban(hashInt('new-phone:account', 10000000, 99999999), '30003', '01745'),
    bic: 'SOGEFRPPXXX',
    bank_name: 'Société Générale',
    nickname: 'Dépôt de garantie',
    is_saved: true,
    payee_check: 'MATCH',
    payee_check_name: null,
    is_trusted: false,
    added_at: iso(ago(2.9)),
    removed_at: null,
    last_used_at: iso(ago(2.75)),
  };
  ctx.rows.sct_beneficiaries.push(payee);
  const created = ago(2.75);
  const tx = {
    id: idFor('new-phone:tx'),
    account_id: account.id,
    counterparty_id: party.id,
    initiated_by_id: holder.id,
    device_id: device.id,
    currency: 'EUR',
    status: 'HELD',
    booked_at: null,
    value_date: null,
    balance_after: null,
    reference: 'DEPOT DE GARANTIE APPARTEMENT',
    status_reason: 'Held by fraud rules: new device and new payee',
    reversed_at: null,
    rail: 'TRANSFER',
    direction: 'DEBIT',
    amount,
    category: 'TRANSFERS',
    description: `VIR SEPA ${upper(name)}`,
    created_at: iso(created),
  };
  ctx.rows.transactions.push(tx);
  ctx.rows.outgoing_transfers.push({
    id: idFor('new-phone:transfer'),
    transaction_id: tx.id,
    beneficiary_id: payee.id,
    scheme: 'SEPA',
    initiated_via: 'BANKING_APP',
    end_to_end_id: `E2E${md5('new-phone:e2e').slice(0, 13).toUpperCase()}`,
    payee_check: 'MATCH',
    validation_status: 'NOT_REQUIRED',
    validated_by: null,
    validated_at: null,
    requested_execution_date: isoDate(created),
    rejection_reason: null,
    sca_method: 'BIOMETRIC',
    purpose_code: null,
    is_standing_order: false,
  });
  // Held: the money is set aside until someone decides.
  account.available_balance = round2(Number(account.available_balance) - amount);
  newAlert(ctx, 'new-phone', {
    type: 'NEW_DEVICE_NEW_PAYEE',
    customer,
    triggered: new Date(created.getTime() + 40000),
    score: hashInt('new-phone:score', 7000, 7800) / 100,
    loginEvent: login,
    lines: [tx],
  });
}

// ---- Fraud: a login abroad while the customer travels --------------------------------------

function travelCase(ctx, used) {
  const found = candidates(ctx, 'travel', used).find(c => lastLogin(ctx, c.holder));
  if (!found) return;
  used.add(found.customer.id);
  const { customer, holder, phone } = found;
  const home = lastLogin(ctx, holder);
  loginRow(ctx, 'travel:home', holder, phone, ago(4.2), { ip_address: home.ip_address });
  const abroad = loginRow(ctx, 'travel:abroad', holder, phone, ago(2.1), {
    country: 'PT',
    city: 'Lisbon',
    ip_address: `85.243.${hashInt('travel:ip3', 1, 254)}.${hashInt('travel:ip4', 1, 254)}`,
    risk_score: hashInt('travel:risk', 3000, 4200) / 100,
  });
  phone.last_seen_at = abroad.created_at;
  newAlert(ctx, 'travel', {
    type: 'IMPOSSIBLE_TRAVEL',
    customer,
    triggered: new Date(ago(2.1).getTime() + 30000),
    score: hashInt('travel:score', 3800, 4600) / 100,
    loginEvent: abroad,
  });
}

// ---- what was recorded on the alerts decided before ----------------------------------------

/** The device check and the call behind the decided takeover and travel alerts. */
function pastChecks(ctx) {
  ctx.rows.alerts
    .filter(a => a.category === 'ACCOUNT_TAKEOVER' && ['CLEARED', 'ESCALATED'].includes(a.status))
    .forEach(a => {
      const triggered = toDate(a.triggered_at);
      a.device_checked_at = iso(new Date(triggered.getTime() + 6 * MINUTE));

      // The takeover closed last month: confirmed by phone, as its change request says.
      if (a.alert_type === 'NEW_DEVICE_NEW_PAYEE') {
        a.called_at = iso(new Date(triggered.getTime() + 18 * MINUTE));
        a.call_outcome = 'DENIED';
      }
    });
}

function alertCases(ctx) {
  const used = new Set();
  takeoverSent(ctx);
  bonusCase(ctx, used);
  newPhoneCase(ctx, used);
  travelCase(ctx, used);
  pastChecks(ctx);
  // Kept out of the compliance queues, which pick their customers last (crime.js).
  ctx.reserved = new Set([...(ctx.reserved || []), ...used]);
}

module.exports = { alertCases };
