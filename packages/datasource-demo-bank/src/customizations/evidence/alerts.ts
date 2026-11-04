/**
 * The evidence an alert analyst reads before each decision of the AML and fraud workflows, as
 * fields of the alert: a workflow "read" step only shows fields of one record, so each piece of
 * the file is one short text. Groups: Alert (what fired), Customer (declared profile against the
 * activity), Transactions (the alert's, summed up), Device (the login behind a takeover), Device
 * check (SEON), Payment (the transfer at stake), Call (Aircall), History, Result.
 * Values start with ✓ (fine), ⚠ (look at it), ✗ (problem) or ○ (neutral). Never random: scores
 * and provider ids come from a hash of the alert.
 */
import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';
import { createHash } from 'crypto';

import { reader } from '../shared/case-file';
import { PROVIDERS } from '../shared/providers';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const OK = '✓';
const LOOK = '⚠';
const BAD = '✗';
const NEUTRAL = '○';
// The bank's high-risk list: the EU's high-risk third countries, plus its own additions (AE, TR).
const HIGH_RISK = new Set('AE TR RU BY IR KP MM SY AF YE VE HT CD SS NG'.split(' '));
const CATEGORY = { AML: 'AML', FRAUD: 'Fraud', ACCOUNT_TAKEOVER: 'Account takeover' };
const THRESHOLD = 10000;

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const time = iso => new Date(iso).getTime();
const md5 = text => createHash('md5').update(String(text)).digest('hex');
const hashInt = (text, low, high) => low + (parseInt(md5(text).slice(0, 6), 16) % (high - low + 1));
const providerId = (prefix, seed) => `${prefix}-${md5(seed).slice(0, 8).toUpperCase()}`;
const label = code => (code ? code.replace(/_/g, ' ').toLowerCase() : '');
const title = code => (code ? label(code).replace(/^./, c => c.toUpperCase()) : '');
const frDate = iso => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
const clock = iso =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  });
const stamp = iso => `${frDate(iso)} ${clock(iso)}`;
// Whole euros, but cents under 100 EUR (card tests are a few euros each).
const euros = n =>
  Math.abs(Number(n)) < 100
    ? `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`
    : `${Math.round(Number(n)).toLocaleString('fr-FR')} EUR`;
const cents = n =>
  `${Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
const regions = new Intl.DisplayNames(['en'], { type: 'region' });
const country = code => (code ? `${regions.of(code)} (${code})` : 'unknown country');
const sum = list => list.reduce((total, tx) => total + Number(tx.amount), 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const duration = ms => {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 90) return plural(minutes, 'minute');
  const hours = Math.round(minutes / 60);

  return hours < 48 ? plural(hours, 'hour') : plural(Math.round(hours / 24), 'day');
};

const ratio = (amount, expected) =>
  Number(expected) > 0 ? Math.round((amount / Number(expected)) * 10) / 10 : null;

// ---- the alert, its customer and its transactions ---------------------------------------------

const ALERT_FIELDS = [
  'id',
  'reference',
  'customer_id',
  'alert_type',
  'category',
  'rule_id',
  'source',
  'created_by',
  'score',
  'severity',
  'status',
  'triggered_at',
  'login_event_id',
  'investigation_id',
  'clearance_reason',
  'resolution_notes',
  'resolved_at',
  'escalated_at',
  'reviewed_by',
  'assigned_to',
  'device_checked_at',
  'called_at',
  'call_outcome',
];

/** The customer, the person who holds the account (retail) and the company (business). */
async function customerOf(list, customerId) {
  const [customer] = await list(
    'customers',
    [eq('id', customerId)],
    [
      'id',
      'display_name',
      'customer_type',
      'business_id',
      'risk_rating',
      'expected_monthly_in',
      'expected_monthly_out',
      'next_review_at',
    ],
  );
  const members = await list(
    'customer_members',
    [eq('customer_id', customerId), new ConditionTreeLeaf('until', 'Missing')],
    ['individual_id', 'is_primary_contact'],
  );
  const contact = members.find(m => m.is_primary_contact) || members[0];
  const [person] = contact
    ? await list(
        'individuals',
        [eq('id', contact.individual_id)],
        [
          'id',
          'first_name',
          'last_name',
          'phone',
          'occupation',
          'employer',
          'employment_status',
          'income_band',
          'source_of_funds',
          'city',
          'country_of_residence',
          'is_pep',
        ],
      )
    : [];
  const [business] = customer.business_id
    ? await list(
        'businesses',
        [eq('id', customer.business_id)],
        ['legal_form', 'industry', 'nace_code', 'city', 'country', 'source_of_funds'],
      )
    : [];

  return { customer, person: person || null, business: business || null };
}

const TX_FIELDS = [
  'id',
  'account_id',
  'counterparty_id',
  'amount',
  'direction',
  'rail',
  'status',
  'status_reason',
  'created_at',
  'booked_at',
  'description',
  'reference',
];

/** The alert's transactions, oldest first, each with its counterparty. */
async function alertTransactions(list, alertId) {
  const links = await list('alert_transactions', [eq('alert_id', alertId)], ['transaction_id']);
  if (!links.length) return [];
  const txs = await list(
    'transactions',
    [
      eq(
        'id',
        links.map(l => l.transaction_id),
      ),
    ],
    TX_FIELDS,
  );
  const ids = [...new Set(txs.map(tx => tx.counterparty_id).filter(Boolean))];
  const parties = ids.length
    ? await list(
        'counterparties',
        [eq('id', ids)],
        ['id', 'name', 'country', 'first_seen_at', 'counterparty_type'],
      )
    : [];
  // A transfer's country is its IBAN's; a payee is new when it was added lately.
  const [payees, payers] = ids.length
    ? await Promise.all([
        list(
          'sct_beneficiaries',
          [eq('counterparty_id', ids)],
          ['counterparty_id', 'iban', 'added_at'],
        ),
        list('sct_emitters', [eq('counterparty_id', ids)], ['counterparty_id', 'iban']),
      ])
    : [[], []];
  const accountOf = new Map([...payers, ...payees].map(a => [a.counterparty_id, a]));
  const byId = new Map(
    parties.map(p => {
      const account = accountOf.get(p.id);

      return [
        p.id,
        {
          ...p,
          country: account?.iban ? account.iban.slice(0, 2) : p.country,
          since: account?.added_at || p.first_seen_at,
        },
      ];
    }),
  );

  return txs
    .map(tx => ({ ...tx, party: byId.get(tx.counterparty_id) || null }))
    .sort((a, b) => time(a.created_at) - time(b.created_at));
}

/** The transfer at stake on a fraud alert: the alert's transfer out, with its payee. */
async function paymentOf(list, alert, txs) {
  const tx = txs.find(t => t.rail === 'TRANSFER' && t.direction === 'DEBIT');
  if (!tx) return null;
  const [transfer] = await list(
    'outgoing_transfers',
    [eq('transaction_id', tx.id)],
    ['id', 'scheme', 'payee_check', 'beneficiary_id', 'validation_status', 'validated_at'],
  );
  const [payee] = transfer?.beneficiary_id
    ? await list(
        'sct_beneficiaries',
        [eq('id', transfer.beneficiary_id)],
        ['iban', 'bic', 'added_at', 'added_from_device_id', 'payee_check', 'payee_check_name'],
      )
    : [];
  const [recall] = await list(
    'sepa_disputes',
    [eq('transaction_id', tx.id), eq('type', 'RECALL'), eq('side', 'WE_ASKED')],
    [
      'id',
      'reference',
      'status',
      'requested_at',
      'response_due',
      'other_bank_bic',
      'amount_returned',
    ],
  );
  // The customer's refund of an unauthorised transfer is listed on its recall.
  const [move] = recall
    ? await list(
        'dispute_transactions',
        [eq('sepa_dispute_id', recall.id), eq('role', 'REFUND')],
        ['transaction_id'],
      )
    : [];
  const [refund] = move
    ? await list('transactions', [eq('id', move.transaction_id)], ['amount', 'booked_at'])
    : [];

  return {
    tx,
    transfer: transfer || null,
    payee: payee || null,
    recall: recall || null,
    refund: refund || null,
  };
}

// ---- Alert · -----------------------------------------------------------------------------------

async function alertFields(list, alert) {
  const category = CATEGORY[alert.category] || title(alert.category);
  let rule = `${category} · raised by hand by ${alert.created_by}`;

  if (alert.rule_id) {
    const [found] = await list('rules', [eq('id', alert.rule_id)], ['code', 'name', 'description']);
    rule = `${category} · ${found.code} ${found.name}: ${found.description}`;
  } else {
    const [first] = await list(
      'status_changes',
      [eq('record_id', alert.id), eq('new_value', 'OPEN')],
      ['reason'],
    );
    if (first?.reason) rule += `: ${first.reason}`;
  }

  const score = Number(alert.score);
  let mark = NEUTRAL;
  if (alert.score !== null && alert.score !== undefined) mark = score >= 85 ? BAD : LOOK;
  const scoreText =
    alert.score === null || alert.score === undefined
      ? 'no score (raised by hand)'
      : `${score.toFixed(1)} / 100, ${label(alert.severity)}`;

  return {
    alert_rule: rule,
    alert_score: `${mark} ${scoreText} · triggered ${stamp(alert.triggered_at)}`,
  };
}

// ---- Customer · --------------------------------------------------------------------------------

function profileText({ customer, person, business }) {
  if (business) {
    return `Company: ${business.industry || 'industry not stated'} (NACE ${
      business.nace_code || '?'
    }), ${business.legal_form} · ${business.city}, ${business.country} · funds from ${label(
      business.source_of_funds,
    )}`;
  }

  if (!person) return `${customer.display_name}: no account holder on file`;
  const job = person.occupation
    ? `${person.occupation}${person.employer ? ` at ${person.employer}` : ''} (${label(
        person.employment_status,
      )})`
    : title(person.employment_status);

  return `${job} · income ${label(person.income_band).replace('from ', '')} · funds from ${label(
    person.source_of_funds,
  )} · lives in ${person.city}, ${person.country_of_residence}`;
}

/** Money in and out over the 30 days up to the alert, on the customer's accounts. */
async function activity(list, customer, until) {
  const accounts = await list('accounts', [eq('customer_id', customer.id)], ['id', 'type']);
  const own = accounts.filter(a => a.type !== 'SAVINGS').map(a => a.id);
  if (!own.length) return { in: 0, out: 0 };
  const from = new Date(time(until) - 30 * DAY).toISOString();
  const txs = await list(
    'transactions',
    [
      eq('account_id', own),
      eq('status', ['BOOKED', 'HELD']),
      new ConditionTreeLeaf('created_at', 'GreaterThan', from),
      new ConditionTreeLeaf('created_at', 'LessThan', new Date(time(until) + 1000).toISOString()),
    ],
    ['amount', 'direction', 'rail'],
  );
  // Moves between the customer's own accounts are not money in or out.
  const counted = txs.filter(tx => tx.rail !== 'INTERNAL');

  return {
    in: sum(counted.filter(tx => tx.direction === 'CREDIT')),
    out: sum(counted.filter(tx => tx.direction === 'DEBIT')),
  };
}

async function riskText(list, { customer, person }) {
  const cases = await list(
    'kyc_cases',
    [eq('customer_id', customer.id)],
    ['reference', 'type', 'status', 'resolved_at'],
    { field: 'opened_at', ascending: false },
  );
  const approved = cases.find(k => k.type === 'ONBOARDING' && k.status === 'APPROVED');
  const open = cases.find(k => !['APPROVED', 'REJECTED'].includes(k.status));
  const parts = [`${customer.risk_rating} risk`];
  parts.push(approved ? `KYC approved ${frDate(approved.resolved_at)}` : 'no approved KYC');
  if (open) parts.push(`${label(open.type)} ${open.reference} ${label(open.status)}`);
  if (customer.next_review_at) parts.push(`next review ${frDate(customer.next_review_at)}`);
  if (person?.is_pep) parts.push('PEP');
  let mark = customer.risk_rating === 'LOW' ? OK : NEUTRAL;
  if (customer.risk_rating === 'HIGH' || open || person?.is_pep || !approved) mark = LOOK;

  return `${mark} ${parts.join(' · ')}`;
}

async function customerFields(list, alert, who) {
  const { customer } = who;
  const seen = await activity(list, customer, alert.triggered_at);
  const inRatio = ratio(seen.in, customer.expected_monthly_in);
  const outRatio = ratio(seen.out, customer.expected_monthly_out);
  const worst = Math.max(inRatio || 0, outRatio || 0);
  let mark = OK;
  if (worst > 3) mark = BAD;
  else if (worst > 1.5) mark = LOOK;
  const times = r => (r === null ? '' : ` (${String(r).replace('.', ',')}× declared)`);

  return {
    customer_profile: profileText(who),
    customer_expected: `${euros(customer.expected_monthly_in || 0)} in, ${euros(
      customer.expected_monthly_out || 0,
    )} out a month, as declared at onboarding`,
    customer_activity: `${mark} 30 days to the alert: ${euros(seen.in)} in${times(
      inRatio,
    )}, ${euros(seen.out)} out${times(outRatio)}`,
    customer_risk: await riskText(list, who),
  };
}

// ---- Transactions · ----------------------------------------------------------------------------

function summaryText(txs, alert) {
  if (!txs.length) {
    return `${NEUTRAL} No transaction on this alert${
      alert.login_event_id ? ': it is about a login' : ''
    }`;
  }

  const ins = txs.filter(tx => tx.direction === 'CREDIT');
  const outs = txs.filter(tx => tx.direction === 'DEBIT');
  const sides = [
    ins.length && `${ins.length} in (${euros(sum(ins))})`,
    outs.length && `${outs.length} out (${euros(sum(outs))})`,
  ].filter(Boolean);
  const first = frDate(txs[0].created_at);
  const last = frDate(txs[txs.length - 1].created_at);
  const when = first === last ? `on ${first}` : `from ${first} to ${last}`;

  const largest = txs.slice().sort((a, b) => b.amount - a.amount)[0];
  const what = largest.reference || largest.description;

  return `${plural(txs.length, 'transaction')}, ${euros(sum(txs))} ${when}: ${sides.join(
    ', ',
  )}; largest ${euros(largest.amount)}${what ? ` "${what}"` : ''}`;
}

function partyName(tx, alert) {
  const p = tx.party;
  if (!p) return tx.description;
  const isNew = p.since && time(alert.triggered_at) - time(p.since) < 30 * DAY;
  const extra = [p.country && p.country !== 'FR' && p.country, isNew && 'new'].filter(Boolean);

  return `${p.name}${extra.length ? ` (${extra.join(', ')})` : ''}`;
}

function counterpartiesText(txs, alert) {
  if (!txs.length) return `${NEUTRAL} None`;

  const side = (direction, word) => {
    const names = [
      ...new Set(txs.filter(tx => tx.direction === direction).map(tx => partyName(tx, alert))),
    ];
    if (!names.length) return null;
    const shown = names.slice(0, 4).join(', ');

    return `${word} ${shown}${names.length > 4 ? ` and ${names.length - 4} more` : ''}`;
  };

  const text = [side('CREDIT', 'In from'), side('DEBIT', 'Out to')].filter(Boolean).join(' · ');
  const fresh = txs.some(tx => partyName(tx, alert).includes('new)'));

  return `${fresh ? LOOK : NEUTRAL} ${text}`;
}

function countriesText(txs) {
  if (!txs.length) return `${NEUTRAL} None`;
  const abroad = [
    ...new Set<string>(txs.map(tx => tx.party?.country).filter(c => c && c !== 'FR')),
  ];
  if (!abroad.length) return `${OK} All in France`;
  const risky = abroad.filter(c => HIGH_RISK.has(c));
  const names = abroad.map(
    c => `${country(c)}${HIGH_RISK.has(c) ? ', on the high-risk list' : ''}`,
  );

  return `${risky.length ? BAD : LOOK} Abroad: ${names.join(', ')}`;
}

function flowText(txs) {
  const ins = txs.filter(tx => tx.direction === 'CREDIT');
  const outs = txs.filter(tx => tx.direction === 'DEBIT');
  const near = outs.filter(tx => tx.amount >= THRESHOLD * 0.9 && tx.amount < THRESHOLD);

  if (near.length >= 3) {
    const span = duration(time(near[near.length - 1].created_at) - time(near[0].created_at));

    return `${BAD} ${near.length} payments out between 9 000 and 10 000 EUR within ${span}, just under the validation threshold`;
  }

  if (!txs.length) return `${NEUTRAL} No money moved`;
  if (!outs.length) return `${NEUTRAL} Money in only`;
  if (!ins.length) return `${NEUTRAL} Money out only`;
  const share = Math.min(1, sum(outs) / sum(ins));
  const span = duration(time(outs[outs.length - 1].created_at) - time(ins[0].created_at));
  const pct = `${Math.round(share * 100)}%`;
  const fast = time(outs[outs.length - 1].created_at) - time(ins[0].created_at) < 3 * DAY;
  if (fast && share >= 0.8) return `${BAD} ${pct} of the money received left again within ${span}`;
  if (fast && share >= 0.5) return `${LOOK} ${pct} of the money received left again within ${span}`;

  return `${NEUTRAL} ${pct} of the money received left again, over ${span}`;
}

function transactionFields(txs, alert) {
  return {
    tx_summary: summaryText(txs, alert),
    tx_counterparties: counterpartiesText(txs, alert),
    tx_countries: countriesText(txs),
    tx_flow: flowText(txs),
  };
}

// ---- Device · and Device check · (SEON) -------------------------------------------------------

const DEVICE_NAMES = { IOS: 'iPhone', ANDROID: 'Android phone', WEB: 'web browser' };
const deviceName = d => d.device_name || DEVICE_NAMES[d.platform] || 'device';

/**
 * The login behind the alert and what surrounds it: the device (new or known), where it logged
 * in against the usual place, an MFA reset, contact details changed. A takeover is a new device
 * plus one of the others. Shared with "Check device and IP" and "Call the customer".
 */
async function loginFacts(list, alert) {
  if (!alert.login_event_id) return null;
  const [login] = await list(
    'login_events',
    [eq('id', alert.login_event_id)],
    ['id', 'individual_id', 'device_id', 'ip_address', 'country', 'city', 'created_at'],
  );
  if (!login) return null;
  const [person] = await list(
    'individuals',
    [eq('id', login.individual_id)],
    ['id', 'first_name', 'last_name', 'phone', 'city', 'country_of_residence'],
  );
  const devices = await list(
    'devices',
    [eq('individual_id', login.individual_id)],
    ['id', 'device_name', 'platform', 'first_seen_at', 'revoked_at'],
  );
  const device = devices.find(d => d.id === login.device_id) || null;
  const at = time(login.created_at);
  const isNew = Boolean(device && at - time(device.first_seen_at) < 48 * HOUR);
  const others = await list(
    'login_events',
    [
      eq('individual_id', login.individual_id),
      new ConditionTreeLeaf('created_at', 'GreaterThan', new Date(at - 30 * DAY).toISOString()),
    ],
    ['id', 'device_id', 'city', 'country', 'event_type', 'success', 'created_at'],
  );
  const before = others.filter(l => time(l.created_at) <= at && l.id !== login.id);
  // Where the customer usually logs in from: every login before, but a new device's.
  const usualLogins = before.filter(
    l => l.success && l.event_type === 'LOGIN' && (!isNew || l.device_id !== login.device_id),
  );
  const places = new Map();
  usualLogins.forEach(l => {
    const key = `${l.city}, ${l.country}`;
    places.set(key, (places.get(key) || 0) + 1);
  });
  const [usualPlace, usualCount] = [...places].sort((a, b) => b[1] - a[1])[0] || [
    `${person.city}, ${person.country_of_residence}`,
    0,
  ];
  const usualDevice = devices
    .filter(d => d.id !== login.device_id && time(d.first_seen_at) < at)
    .sort((a, b) => time(a.first_seen_at) - time(b.first_seen_at))
    .find(d => d.platform !== 'WEB');
  const reset = before.find(
    l =>
      l.event_type === 'MFA_RESET' &&
      l.device_id === login.device_id &&
      at - time(l.created_at) < 3 * HOUR,
  );
  const changes = await list(
    'customer_change_requests',
    [
      eq('individual_id', login.individual_id),
      new ConditionTreeLeaf('requested_at', 'GreaterThan', new Date(at - 7 * DAY).toISOString()),
    ],
    ['field', 'status', 'requested_at', 'requested_from_device_id'],
  );
  const abroad = login.country !== person.country_of_residence;
  const contact = changes.filter(c => ['PHONE', 'EMAIL'].includes(c.field));
  const takeover = isNew && (abroad || Boolean(reset) || contact.length > 0);
  // Logged in from abroad in the last day: the customer is travelling right now.
  const travelling = others.find(
    l =>
      l.success &&
      l.country !== person.country_of_residence &&
      Date.now() - time(l.created_at) < DAY,
  );

  return {
    login,
    person,
    device,
    isNew,
    usualPlace,
    usualCount,
    usualDevice,
    reset,
    changes,
    abroad,
    takeover,
    travelling: travelling || null,
  };
}

function loginDeviceText(f) {
  if (!f.device) return `${NEUTRAL} Login without a known device`;
  const since = f.usualDevice
    ? ` (usual: ${deviceName(f.usualDevice)} since ${frDate(f.usualDevice.first_seen_at)})`
    : '';

  if (f.isNew) {
    const gap = duration(time(f.login.created_at) - time(f.device.first_seen_at));

    return `${f.takeover ? BAD : LOOK} New device: ${deviceName(f.device)} first seen ${stamp(
      f.device.first_seen_at,
    )}, ${gap} before this login${since}`;
  }

  const revoked = f.device.revoked_at ? `, revoked ${stamp(f.device.revoked_at)}` : '';

  return `${OK} Known device: ${deviceName(f.device)}, used since ${frDate(
    f.device.first_seen_at,
  )}${revoked}`;
}

function placeText(f) {
  const here = `${f.login.city}, ${f.login.country}`;
  const usual = f.usualCount
    ? `usually ${f.usualPlace} (${f.usualCount} of the last ${plural(f.usualCount, 'login')})`
    : `lives in ${f.usualPlace}`;
  if (here === f.usualPlace) return `${OK} ${here}, like usual · IP ${f.login.ip_address}`;

  return `${f.abroad ? BAD : LOOK} ${here} (IP ${f.login.ip_address}) · ${usual}`;
}

function timingText(f, payment) {
  const login = time(f.login.created_at);
  if (!payment) return `${NEUTRAL} No payment after this login`;
  const paid = time(payment.tx.created_at);
  const steps = [`login ${clock(f.login.created_at)}`];

  if (payment.payee?.added_at && time(payment.payee.added_at) >= login - HOUR) {
    steps.push(`payee added ${clock(payment.payee.added_at)}`);
  }

  steps.push(`payment ${clock(payment.tx.created_at)}`);
  const quick = paid - login < HOUR;
  let mark = OK;
  if (quick) mark = f.takeover ? BAD : LOOK;

  return `${mark} ${steps.join(', ')}: ${duration(paid - login)} from login to payment`;
}

function changesText(f) {
  const parts = [];
  if (f.reset) parts.push(`MFA reset at ${clock(f.reset.created_at)} on this device`);
  f.changes.forEach(c => {
    const from = c.requested_from_device_id === f.login.device_id ? ' from this device' : '';
    parts.push(
      `${label(c.field)} change asked ${stamp(c.requested_at)}${from} (${label(c.status)})`,
    );
  });
  if (!parts.length) return `${OK} No MFA reset, no change of phone, email or address in 7 days`;
  const risky = f.reset || f.changes.some(c => ['PHONE', 'EMAIL'].includes(c.field));

  return `${risky ? BAD : NEUTRAL} ${parts.join(' · ')}`;
}

const NO_LOGIN = `${NEUTRAL} No login on this alert`;

function deviceFields(f, payment) {
  if (!f) {
    return {
      device_login: NO_LOGIN,
      device_place: NO_LOGIN,
      device_timing: NO_LOGIN,
      device_changes: NO_LOGIN,
    };
  }

  return {
    device_login: loginDeviceText(f),
    device_place: placeText(f),
    device_timing: timingText(f, payment),
    device_changes: changesText(f),
  };
}

/** What SEON answers about the login's device and IP, from the login itself. */
function seonVerdict(alert, f) {
  const ip = f.login.ip_address;
  let network = `home broadband in ${f.login.city} (${f.login.country}), the provider of the usual logins`;

  if (f.takeover && f.abroad) {
    network = `a hosting provider in ${f.login.city} (${f.login.country}), on ${hashInt(
      `${ip}reports`,
      3,
      14,
    )} fraud reports this month`;
  } else if (f.abroad) {
    network =
      f.device?.platform === 'WEB'
        ? `a public Wi-Fi network in ${f.login.city} (${f.login.country})`
        : `a mobile network in ${f.login.city} (${f.login.country}), roaming`;
  }

  const device = f.isNew
    ? `${deviceName(f.device)} first seen ${duration(
        time(f.login.created_at) - time(f.device.first_seen_at),
      )} before the login`
    : `the customer's ${deviceName(f.device)} since ${frDate(f.device.first_seen_at)}`;
  const id = providerId('CHK', `${alert.id}:seon`);

  if (f.takeover) {
    const why = [
      f.reset && 'MFA reset on it',
      f.changes.some(c => c.field === 'PHONE') && 'phone number change asked',
      f.changes.some(c => c.field === 'EMAIL') && 'email change asked',
    ].filter(Boolean);

    return {
      takeover: true,
      score: hashInt(`${alert.id}seon`, 88, 97),
      id,
      network,
      device,
      text: `Takeover signals: ${device}, IP ${ip} of ${network}${
        why.length ? `, ${why.join(', ')}` : ''
      }`,
    };
  }

  return {
    takeover: false,
    score: hashInt(`${alert.id}seon`, f.abroad ? 22 : 6, f.abroad ? 35 : 18),
    id,
    network,
    device,
    text: `No takeover signal: ${device}, IP ${ip} of ${network}, no MFA reset, no change of phone or email`,
  };
}

function deviceCheckText(alert, f) {
  if (!f) return `${NEUTRAL} No login to check on this alert`;
  if (!alert.device_checked_at) return 'Not checked yet: the workflow runs "Check device and IP"';
  const v = seonVerdict(alert, f);

  return `${v.takeover ? BAD : OK} ${v.text}; risk ${v.score}/100 (${PROVIDERS.deviceIntel} ${
    v.id
  }, ${stamp(alert.device_checked_at)})`;
}

// ---- Payment · ---------------------------------------------------------------------------------

/** A recall we sent on the payment: waiting for the other bank, or its answer. */
function recallText(recall) {
  if (recall.status === 'WAITING_OTHER_BANK') {
    return `${LOOK} Recall ${recall.reference} sent through ${PROVIDERS.sepa} on ${stamp(
      recall.requested_at,
    )}: waiting for the other bank (${recall.other_bank_bic || 'BIC unknown'}), answer due ${frDate(
      recall.response_due,
    )}`;
  }

  return `${recall.status === 'ACCEPTED' ? OK : LOOK} Recall ${recall.reference}: ${label(
    recall.status,
  )}${recall.amount_returned ? `, ${cents(recall.amount_returned)} back` : ''}`;
}

/** The refund owed on a transfer the customer did not make (PSD2, next business day). */
function refundText(alert, refund) {
  if (refund) {
    return `; ${OK} customer refunded ${cents(refund.amount)} on ${stamp(
      refund.booked_at,
    )} (PSD2: an unauthorised transfer is refunded by the next business day)`;
  }

  return alert.call_outcome === 'DENIED'
    ? `; ${LOOK} customer not refunded yet: owed by the end of the next business day (PSD2)`
    : '';
}

function paymentStatusText(alert, p) {
  if (!p) return `${NEUTRAL} No transfer on this alert`;
  const { tx, transfer, recall } = p;
  const to = tx.party?.name || 'the payee';
  const amount = cents(tx.amount);
  if (recall) return `${recallText(recall)}${refundText(alert, p.refund)}`;
  if (tx.status === 'HELD') return `${LOOK} Held: ${amount} to ${to}, waiting for your decision`;

  if (tx.status === 'REJECTED') {
    return `${NEUTRAL} Stopped: ${amount} to ${to} rejected (${
      tx.status_reason || 'no reason'
    }); the money stayed on the account`;
  }

  const released =
    transfer?.validation_status === 'APPROVED' &&
    transfer.validated_at &&
    time(transfer.validated_at) > time(alert.triggered_at);

  if (released) {
    return `${OK} Released: ${amount} to ${to}, approved ${stamp(transfer.validated_at)}`;
  }

  const how = transfer?.scheme === 'SEPA_INSTANT' ? 'by SEPA Instant' : 'by SEPA transfer';

  return `${BAD} Sent: ${amount} to ${to} left ${how} on ${stamp(
    tx.created_at,
  )}; only a recall can bring it back`;
}

function payeeText(p, f) {
  if (!p?.payee) return `${NEUTRAL} No payee on this alert`;
  const { payee, tx } = p;
  const plain = payee.iban.replace(/ /g, '');
  const iban = `${plain.slice(0, 4)} … ${plain.slice(-4)}`;
  const fresh = time(tx.created_at) - time(payee.added_at) < 7 * DAY;
  const fromNew = f?.isNew && payee.added_from_device_id === f.login.device_id;
  const check = {
    MATCH: 'payee check matches the name',
    CLOSE_MATCH: `payee check close match (${payee.payee_check_name || 'other spelling'})`,
    NO_MATCH: `payee check: the IBAN belongs to ${payee.payee_check_name || 'someone else'}`,
    NOT_POSSIBLE: 'payee check not possible (bank outside the scheme)',
  }[payee.payee_check];
  const added = `added ${stamp(payee.added_at)}${fromNew ? ' from the new device' : ''}`;
  let mark = fresh ? LOOK : OK;
  if (payee.payee_check === 'NO_MATCH' || (fromNew && f.takeover)) mark = BAD;

  return `${mark} ${fresh ? 'New payee' : 'Known payee'} ${
    tx.party?.name || ''
  }, IBAN ${iban}, ${added}, ${check}`;
}

// ---- Call · (Aircall) ---------------------------------------------------------------------------

/** The number to call: the one on file before the last approved change (a fraudster changes it). */
async function phoneOnFile(list, person) {
  if (!person) return { number: null, note: '' };
  const [change] = await list(
    'customer_change_requests',
    [eq('individual_id', person.id), eq('field', 'PHONE'), eq('status', 'APPROVED')],
    ['old_value'],
    { field: 'decided_at', ascending: false },
  );

  return change
    ? { number: change.old_value, note: ' (number on file before the last change)' }
    : { number: person.phone, note: ' (number on file)' };
}

/**
 * What the customer says on the phone, from the data: a takeover is denied, a customer abroad
 * right now does not pick up, anyone else confirms. Shared with "Call the customer".
 */
function callAnswer(f, p) {
  const payment = p ? `the payment of ${cents(p.tx.amount)} to ${p.tx.party?.name}` : null;

  if (f?.takeover) {
    return {
      outcome: 'DENIED',
      text: `the customer did not log in from ${f.login.city} and did not ask for ${
        payment || 'any change'
      }; their own phone is with them`,
    };
  }

  if (f?.travelling) {
    return {
      outcome: 'NOT_REACHED',
      text: `no answer, voicemail left asking to call the fraud line back; last login from ${
        f.travelling.city
      }, ${f.travelling.country} at ${stamp(f.travelling.created_at)}: the customer is travelling`,
    };
  }

  const phone = f?.isNew
    ? `new ${deviceName(f.device)} set up ${frDate(f.device.first_seen_at)}`
    : null;

  return {
    outcome: 'CONFIRMED',
    text: `the customer confirms ${
      [phone, payment].filter(Boolean).join(' and ') || 'the activity'
    }${p?.tx.reference ? ` (${p.tx.reference.toLowerCase()})` : ''}`,
  };
}

const CALL_MARK = { CONFIRMED: OK, DENIED: BAD, NOT_REACHED: LOOK };
const CALL_TITLE = {
  CONFIRMED: 'It was the customer',
  DENIED: 'Not the customer',
  NOT_REACHED: 'Not reached',
};

async function callFields(list, alert, f, p, who) {
  if (alert.category === 'AML') {
    const quiet = `${NEUTRAL} No call on an AML alert: the customer must not learn of it (tipping off)`;

    return { call_result: quiet, call_details: quiet };
  }

  if (!alert.called_at) {
    const waiting = 'Not called yet: the workflow runs "Call the customer"';

    return { call_result: waiting, call_details: waiting };
  }

  const answer = callAnswer(f, p);
  const phone = await phoneOnFile(list, f?.person || who.person);
  const outcome = alert.call_outcome || answer.outcome;
  const minutes = outcome === 'NOT_REACHED' ? 1 : hashInt(`${alert.id}call`, 2, 6);

  return {
    call_result: `${CALL_MARK[outcome]} ${CALL_TITLE[outcome]}: ${answer.text}`,
    call_details: `${PROVIDERS.phone} ${providerId('CALL', `${alert.id}:call`)}, ${stamp(
      alert.called_at,
    )}, ${plural(minutes, 'minute')}, to ${phone.number || 'no number'}${phone.note}`,
  };
}

// ---- History · and Result · ---------------------------------------------------------------------

async function historyFields(list, alert) {
  const earlier = (
    await list(
      'alerts',
      [
        eq('customer_id', alert.customer_id),
        new ConditionTreeLeaf('triggered_at', 'LessThan', alert.triggered_at),
      ],
      ['reference', 'alert_type', 'status', 'clearance_reason', 'triggered_at'],
      { field: 'triggered_at', ascending: false },
    )
  ).filter(a => a.reference !== alert.reference);
  const cases = await list(
    'investigations',
    [eq('customer_id', alert.customer_id)],
    ['reference', 'type', 'status', 'decision', 'decided_at', 'opened_at'],
    { field: 'opened_at', ascending: false },
  );
  const alertLine = a =>
    `${a.reference} ${label(a.alert_type)}, ${label(a.status)}${
      a.clearance_reason ? ` (${label(a.clearance_reason)})` : ''
    }, ${frDate(a.triggered_at)}`;
  let alertsText = `${OK} No earlier alert on this customer`;

  if (earlier.length) {
    const live = earlier.some(a => a.status !== 'CLEARED');
    alertsText = `${live ? LOOK : NEUTRAL} ${plural(earlier.length, 'earlier alert')}: ${earlier
      .slice(0, 3)
      .map(alertLine)
      .join(' · ')}${earlier.length > 3 ? ' …' : ''}`;
  }

  const caseLine = c =>
    c.status === 'CLOSED'
      ? `${c.reference} ${label(c.type)}, closed ${frDate(c.decided_at)}: ${label(c.decision)}`
      : `${c.reference} ${label(c.type)}, ${label(c.status)} since ${frDate(c.opened_at)}`;
  let casesText = `${OK} No investigation on this customer`;

  if (cases.length) {
    const open = cases.some(c => c.status !== 'CLOSED');
    casesText = `${open ? BAD : NEUTRAL} ${cases.slice(0, 3).map(caseLine).join(' · ')}`;
  }

  return { history_alerts: alertsText, history_cases: casesText };
}

async function resultText(list, alert) {
  if (alert.status === 'OPEN') return `${NEUTRAL} Open, waiting in the queue`;

  if (alert.status === 'IN_REVIEW') {
    return `${NEUTRAL} In review by ${alert.assigned_to || 'an analyst'}`;
  }

  if (alert.status === 'CLEARED') {
    return `${OK} Cleared ${stamp(alert.resolved_at)} by ${alert.reviewed_by} (${label(
      alert.clearance_reason,
    )})${alert.resolution_notes ? `: ${alert.resolution_notes}` : ''}`;
  }

  const [last] = await list(
    'status_changes',
    [eq('record_id', alert.id), eq('new_value', alert.status)],
    ['reason', 'changed_at', 'changed_by'],
    { field: 'changed_at', ascending: false },
  );

  if (alert.status === 'SECOND_LOOK') {
    return `${LOOK} With a senior for a second look since ${stamp(
      last?.changed_at || Date.now(),
    )}, sent by ${last?.changed_by || 'an analyst'}: ${last?.reason || 'no reason given'}`;
  }

  const [inv] = alert.investigation_id
    ? await list(
        'investigations',
        [eq('id', alert.investigation_id)],
        ['id', 'reference', 'type', 'status', 'priority', 'opened_at'],
      )
    : [];
  if (!inv) return `${BAD} Escalated ${stamp(alert.escalated_at)}`;
  // A new investigation names this alert in its first history line ("From ALR-…").
  const [birth] = await list(
    'status_changes',
    [eq('record_id', inv.id), eq('new_value', 'OPEN')],
    ['reason'],
  );
  const joined = birth?.reason !== `From ${alert.reference}`;
  const attached = await list(
    'investigation_transactions',
    [eq('investigation_id', inv.id)],
    ['investigation_id', 'transaction_id'],
  );

  return `${BAD} Escalated ${stamp(alert.escalated_at)} to ${inv.reference}: ${
    joined ? 'added to the customer’s open investigation' : 'new investigation'
  } (${label(inv.type)}, ${label(inv.status)}${
    inv.priority ? `, priority ${label(inv.priority)}` : ''
  }), ${plural(attached.length, 'transaction')} attached`;
}

/** Everything about one alert, computed once for all its fields. */
async function alertFile(list, record) {
  const [alert] = await list('alerts', [eq('id', record.id)], ALERT_FIELDS);
  const who = await customerOf(list, alert.customer_id);
  const txs = await alertTransactions(list, alert.id);
  // The payment at stake is a fraud matter; an AML alert reads its transactions as a whole.
  const [payment, facts] = await Promise.all([
    alert.category === 'AML' ? null : paymentOf(list, alert, txs),
    loginFacts(list, alert),
  ]);

  return {
    ...(await alertFields(list, alert)),
    ...(await customerFields(list, alert, who)),
    ...transactionFields(txs, alert),
    ...deviceFields(facts, payment),
    device_check: deviceCheckText(alert, facts),
    payment_status:
      alert.category === 'AML'
        ? `${NEUTRAL} AML alert: its money is in the "Transactions ·" lines`
        : paymentStatusText(alert, payment),
    payment_payee: payeeText(payment, facts),
    ...(await callFields(list, alert, facts, payment, who)),
    ...(await historyFields(list, alert)),
    result_outcome: await resultText(list, alert),
  };
}

// field: label. The prefix groups them, so a workflow step can read one group by its name.
const LABELS = {
  alert_rule: 'Alert · Rule',
  alert_score: 'Alert · Score and time',
  customer_profile: 'Customer · Declared profile',
  customer_expected: 'Customer · Expected each month',
  customer_activity: 'Customer · Activity against declared',
  customer_risk: 'Customer · Risk and KYC',
  tx_summary: 'Transactions · Summary',
  tx_counterparties: 'Transactions · Counterparties',
  tx_countries: 'Transactions · Countries',
  tx_flow: 'Transactions · Money in, money out',
  device_login: 'Device · Login device',
  device_place: 'Device · Login place',
  device_timing: 'Device · Login to payment',
  device_changes: 'Device · Security and contact changes',
  device_check: 'Device check · Result',
  payment_status: 'Payment · Status',
  payment_payee: 'Payment · Payee',
  call_result: 'Call · Outcome',
  call_details: 'Call · Details',
  history_alerts: 'History · Earlier alerts',
  history_cases: 'History · Investigations',
  result_outcome: 'Result · Outcome',
};
const FIELDS = Object.keys(LABELS);

function addAlertEvidence(collection) {
  // One computation per alert and request, whichever of the fields are asked for.
  const cache = new WeakMap();

  const fileOf = (record, context) => {
    if (!cache.has(record)) cache.set(record, alertFile(reader(context.dataSource), record));

    return cache.get(record);
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: 'String',
      dependencies: ['id'],
      getValues: (records, context) =>
        Promise.all(records.map(async r => (await fileOf(r, context))?.[name] ?? null)),
    }),
  );
}

export {
  FIELDS,
  LABELS,
  addAlertEvidence,
  alertTransactions,
  callAnswer,
  loginFacts,
  paymentOf,
  paymentStatusText,
  phoneOnFile,
  seonVerdict,
};
