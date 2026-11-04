/**
 * Wave B: KYC and financial crime, written once every statement exists.
 *
 * - Devices and logins: each person who uses the app has a phone (and maybe a computer); the
 *   transfers they make and the payees they add come from those devices.
 * - KYC: every customer's onboarding case with its documents, periodic reviews on the risk cycle,
 *   reviews triggered by an expired ID, requests for information sent to clients.
 * - Screening: sanctions and PEP lists, hits on customers and on one payment.
 * - Alerts, investigations and SARs: raised by the rules on the stories of stories.js (mules,
 *   split payments, takeovers, card testing, high-risk countries) and on everyday activity (a
 *   month with unusual income, a login abroad), most of which turn out to be false positives.
 * - The status history of every case, and readable references numbered in date order.
 */
import { createHash } from 'crypto';

import { hex, toDate } from './banking';
import {
  DAY,
  NOW,
  addWorkingDays,
  ascii,
  between,
  chance,
  daysAgo,
  eighteenth,
  iso,
  isoDate,
  pick,
  random as rand,
  round2,
  scanFlaw,
  uuid,
  weighted,
  withTime,
  workBefore,
  workMoment,
} from './random';
import { frenchIban } from './reference';
import { REFUSAL, refusalReason } from './refusals';
import { homeAddress } from './retail';
import { SANCTIONED } from './stories';

const HOUR = 3600000;
const MINUTE = 60000;
const at = (date, hours) => new Date(date.getTime() + hours * HOUR);
const later = (a, b) => (a > b ? a : b);
const earlier = (a, b) => (a < b ? a : b);
const past = date => earlier(date, new Date(NOW.getTime() - 5 * MINUTE));
const mail = name => `${name}@forest-lab-bank.fr`;

// Who works the cases, by team (fictional staff of the fictional bank).
const TEAM = {
  onboarding: ['lea.girard', 'thomas.renaud', 'ines.bouaziz'],
  l1: ['nadia.cheriet', 'paul.vasseur', 'camille.roux'],
  l2: ['marc.olivier', 'sarah.benali'],
  mlro: ['anne.delorme'],
  disputes: ['julie.marchand', 'karim.haddad'],
  payments: ['elodie.fontaine', 'antoine.giraud'],
  support: ['yanis.mercier', 'chloe.lefevre', 'manon.dubois'],
  credit: ['baptiste.renard', 'amandine.colin'],
  collections: ['florian.marty', 'coralie.huet', 'samuel.roche'],
  // Wave D, lifecycle: seizures, insolvencies, estates; and the quality reviewers.
  legal: ['helene.lacombe', 'damien.royer'],
  qa: ['margaux.lebrun', 'olivier.chauvin'],
};
const op = team => mail(pick(TEAM[team]));

/** One line of a record's status history. */
function trail(rows, type, record, steps) {
  let previous = null;
  let last = 0;
  steps.forEach(([status, when, by, reason]) => {
    // Never in the future, never before the previous step.
    const date = new Date(
      Math.max(last + 1000, earlier(when, new Date(NOW.getTime() - MINUTE)).getTime()),
    );
    last = date.getTime();
    rows.status_changes.push({
      id: uuid(),
      record_type: type,
      record_id: record.id,
      field: 'status',
      old_value: previous,
      new_value: status,
      changed_by: by || 'system',
      changed_at: iso(date),
      reason: reason || null,
    });
    previous = status;
  });
}

/** PREFIX-YEAR-NUMBER, numbered in date order within each year. */
function numberReferences(list, prefix, dateField) {
  const counters = {};
  list
    .slice()
    .sort((a, b) => (a[dateField] < b[dateField] ? -1 : 1))
    .forEach(row => {
      const year = row[dateField].slice(0, 4);
      counters[year] = (counters[year] || between(120, 480)) + between(1, 2);
      row.reference = `${prefix}-${year}-${String(counters[year]).padStart(6, '0')}`;
    });
}

// ---- context: who belongs to which customer -----------------------------------------------------

function context(rows, stories) {
  const people = new Map(rows.individuals.map(i => [i.id, i]));
  const membersOf = new Map();
  const customersOf = new Map();
  rows.customer_members.forEach(m => {
    if (!membersOf.has(m.customer_id)) membersOf.set(m.customer_id, []);
    membersOf.get(m.customer_id).push(m);
    if (!customersOf.has(m.individual_id)) customersOf.set(m.individual_id, []);
    customersOf.get(m.individual_id).push(m.customer_id);
  });
  const accountsOf = new Map();
  rows.accounts.forEach(a => {
    if (!accountsOf.has(a.customer_id)) accountsOf.set(a.customer_id, []);
    accountsOf.get(a.customer_id).push(a);
  });
  const customers = new Map(rows.customers.map(c => [c.id, c]));
  const holderOf = customer =>
    people.get(
      (membersOf.get(customer.id) || []).find(m => ['HOLDER', 'SIGNATORY'].includes(m.role))
        ?.individual_id,
    );

  return {
    rows,
    stories,
    people,
    membersOf,
    customersOf,
    accountsOf,
    customers,
    holderOf,
    businesses: new Map(rows.businesses.map(b => [b.id, b])),
    devicesOf: new Map(),
    loginsOf: new Map(),
    investigations: [],
  };
}

// ---- devices and logins -----------------------------------------------------------------------

const PHONES = {
  IOS: ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 16'],
  ANDROID: ['Samsung Galaxy S23', 'Samsung Galaxy A54', 'Google Pixel 8', 'Xiaomi Redmi Note 13'],
};
const BROWSERS = [
  'Chrome on macOS',
  'Safari on macOS',
  'Chrome on Windows',
  'Edge on Windows',
  'Firefox on Windows',
];
const ISP_PREFIX = {
  FR: ['90.', '82.', '176.', '92.', '78.'],
  DE: ['84.', '91.'],
  ES: ['83.', '88.'],
  IT: ['79.', '151.'],
  BE: ['81.', '109.'],
};
const HOLIDAYS = [
  ['ES', 'Barcelona'],
  ['IT', 'Rome'],
  ['PT', 'Lisbon'],
  ['GR', 'Athens'],
  ['MA', 'Marrakesh'],
];
const ip = country =>
  `${pick(ISP_PREFIX[country] || ISP_PREFIX.FR)}${between(1, 254)}.${between(1, 254)}.${between(
    1,
    254,
  )}`;
const appVersion = () => `7.${between(8, 14)}.${between(0, 5)}`;

function device(ctx, person, platform, firstSeen, extra = {}) {
  const row = {
    id: uuid(),
    individual_id: person.id,
    fingerprint: hex(32),
    platform,
    device_name: platform === 'WEB' ? pick(BROWSERS) : pick(PHONES[platform]),
    app_version: platform === 'WEB' ? null : appVersion(),
    first_seen_at: iso(firstSeen),
    last_seen_at: null,
    is_trusted: platform !== 'WEB',
    revoked_at: null,
    ...extra,
  };
  ctx.rows.devices.push(row);
  if (!ctx.devicesOf.has(person.id)) ctx.devicesOf.set(person.id, []);
  ctx.devicesOf.get(person.id).push(row);

  return row;
}

/** Until when a person could use the app: offboarding or a freeze ends it. */
function accessEnd(ctx, person) {
  const ends = (ctx.customersOf.get(person.id) || []).map(id => {
    const customer = ctx.customers.get(id);
    if (customer.status === 'OFFBOARDED') return toDate(customer.updated_at);
    if (customer.status === 'PROSPECT') return null;

    return NOW;
  });

  return ends.filter(Boolean).sort((a, b) => b - a)[0] || null;
}

/** A phone (replaced after a few years), sometimes a computer too. */
function devicesFor(ctx, person, mule?) {
  const end = accessEnd(ctx, person);
  if (!end) return;
  const start = toDate(person.created_at);
  const platform = chance(0.55) ? 'IOS' : 'ANDROID';
  let since = start;

  if ((end - start.getTime()) / DAY > 900 && chance(0.6)) {
    const replaced = withTime(
      new Date(start.getTime() + between(500, (end - start.getTime()) / DAY - 60) * DAY),
    );
    device(ctx, person, platform, start, {
      last_seen_at: iso(replaced),
      revoked_at: iso(at(replaced, 0.5)),
      is_trusted: false,
    });
    since = replaced;
  }

  const extra = mule ? { fingerprint: mule.fingerprint } : {};
  device(ctx, person, platform, since, {
    last_seen_at: iso(past(withTime(new Date(end.getTime() - between(0, 6) * DAY)))),
    ...extra,
  });

  if (chance(0.3)) {
    device(ctx, person, 'WEB', withTime(new Date(since.getTime() + between(1, 60) * DAY)), {
      last_seen_at: iso(past(withTime(new Date(end.getTime() - between(0, 20) * DAY)))),
    });
  }

  ctx.rows.devices
    .filter(d => d.individual_id === person.id && toDate(d.first_seen_at) > end)
    .forEach(d => Object.assign(d, { first_seen_at: d.last_seen_at }));
}

function login(ctx, person, dev, date, fields = {}) {
  const row = {
    id: uuid(),
    individual_id: person.id,
    device_id: dev.id,
    ip_address: ip(person.country_of_residence),
    country: person.country_of_residence,
    city: person.city,
    success: true,
    risk_score: round2(rand() * 18),
    created_at: iso(past(date)),
    event_type: 'LOGIN',
    auth_method:
      dev.platform === 'WEB'
        ? pick(['PASSWORD', 'APP_PUSH'])
        : weighted([
            ['BIOMETRIC', 80],
            ['PASSWORD', 20],
          ]),
    failure_reason: null,
    ...fields,
  };
  ctx.rows.login_events.push(row);
  if (!ctx.loginsOf.has(person.id)) ctx.loginsOf.set(person.id, []);
  ctx.loginsOf.get(person.id).push(row);

  return row;
}

/** A login from a holiday abroad, which the travel rule may flag. */
function tripLogin(ctx, person, dev, date, [country, city]) {
  const row = login(ctx, person, dev, date, {
    country,
    city,
    ip_address: `${between(31, 95)}.${between(1, 254)}.${between(1, 254)}.${between(1, 254)}`,
    risk_score: round2(35 + rand() * 25),
  });
  ctx.trips = ctx.trips || [];
  ctx.trips.push({ person, login: row });
}

/** A wrong password or code, then the right one a minute later. */
function failedThenLogin(ctx, person, dev, date) {
  const reason = dev.platform === 'WEB' ? 'WRONG_PASSWORD' : pick(['WRONG_PASSWORD', 'OTP_FAILED']);
  login(ctx, person, dev, date, {
    success: false,
    failure_reason: reason,
    auth_method: reason === 'OTP_FAILED' ? 'SMS_OTP' : 'PASSWORD',
  });
  login(ctx, person, dev, new Date(date.getTime() + between(1, 4) * MINUTE), {
    auth_method: 'PASSWORD',
  });
}

/** The last 30 days of logins on the devices still in use; now and then a failure or a trip. */
function loginsFor(ctx, person) {
  const live = (ctx.devicesOf.get(person.id) || []).filter(d => !d.revoked_at);
  live.forEach(dev => {
    const last = toDate(dev.last_seen_at);
    const first = later(toDate(dev.first_seen_at), daysAgo(30));
    let day = new Date(first.getTime());
    let trip = chance(0.04) ? pick(HOLIDAYS) : null;

    while (day <= last) {
      const date = past(withTime(day));

      if (trip && chance(0.15)) {
        tripLogin(ctx, person, dev, date, trip);
        trip = null;
      } else if (chance(0.03)) {
        failedThenLogin(ctx, person, dev, date);
      } else {
        login(ctx, person, dev, date);
      }

      if (chance(0.03)) {
        login(ctx, person, dev, at(date, 0.2), { event_type: 'LOGOUT', auth_method: null });
      }

      day = new Date(day.getTime() + between(1, dev.platform === 'WEB' ? 9 : 4) * DAY);
    }

    if (chance(0.02)) {
      login(ctx, person, dev, past(withTime(daysAgo(between(1, 25)))), {
        event_type: 'PASSWORD_RESET',
        auth_method: 'SMS_OTP',
      });
    }
  });
}

/** The attacker's phone or browser, then the failed code, the MFA reset and the login it opened. */
function takeoverLogins(ctx, story) {
  const { attacker, holder, when } = story;
  const dev = device(ctx, holder, attacker.platform, at(when, -0.75), {
    id: attacker.id,
    fingerprint: attacker.fingerprint,
    last_seen_at: iso(when),
    is_trusted: false,
    revoked_at: story.outcome === 'CLOSED' ? iso(at(when, 20)) : null,
  });
  const where = { country: attacker.country, city: attacker.city, ip_address: attacker.ip };
  login(ctx, holder, dev, at(when, -0.7), {
    ...where,
    success: false,
    failure_reason: 'OTP_FAILED',
    auth_method: 'SMS_OTP',
    risk_score: round2(78 + rand() * 8),
  });
  login(ctx, holder, dev, at(when, -0.55), {
    ...where,
    event_type: 'MFA_RESET',
    auth_method: 'SMS_OTP',
    risk_score: round2(85 + rand() * 6),
  });
  story.login = login(ctx, holder, dev, at(when, -0.45), {
    ...where,
    auth_method: 'PASSWORD',
    risk_score: round2(90 + rand() * 7),
  });
}

/** The device a person used at that moment (their phone first). */
function deviceAt(ctx, personId, date) {
  const list = (ctx.devicesOf.get(personId) || []).filter(
    d =>
      toDate(d.first_seen_at) <= date &&
      (!d.revoked_at || toDate(d.revoked_at) >= date) &&
      !ctx.attackerDevices.has(d.id),
  );

  return list.find(d => d.platform !== 'WEB') || list[0] || null;
}

function devicesAndLogins(ctx) {
  const { rows, stories } = ctx;
  ctx.attackerDevices = new Set();
  const mulePhones = new Map();
  stories.forEach(s => {
    if (s.kind === 'MULE' && s.sharedPhone) mulePhones.set(s.holder.id, s.sharedPhone);
  });
  rows.individuals.forEach(person => devicesFor(ctx, person, mulePhones.get(person.id)));
  rows.individuals.forEach(person => loginsFor(ctx, person));
  stories.forEach(s => {
    if (s.kind !== 'TAKEOVER') return;
    ctx.attackerDevices.add(s.attacker.id);
    takeoverLogins(ctx, s);
  });
  // The transfers people make come from their device; the payees they add, too.
  rows.transactions.forEach(tx => {
    if (tx.device_id || !tx.initiated_by_id || tx.rail === 'CARD' || tx.direction !== 'DEBIT') {
      return;
    }

    tx.device_id = deviceAt(ctx, tx.initiated_by_id, toDate(tx.created_at))?.id || null;
  });
  const { customers } = ctx;
  rows.sct_beneficiaries.forEach(b => {
    if (b.added_from_device_id) return;
    const holder = ctx.holderOf(customers.get(b.customer_id));
    b.added_from_device_id = holder
      ? deviceAt(ctx, holder.id, toDate(b.added_at))?.id || null
      : null;
  });
}

/**
 * Phones, computers and logins of people who joined after wave B (onboarding-funnel.js): the same
 * as everyone's, and the transfers they make and the payees they add come from those devices.
 */
function newcomerDevices(rows, people) {
  const ctx: Record<string, any> = context(rows, new Map());
  ctx.attackerDevices = new Set();
  people.forEach(person => devicesFor(ctx, person));
  people.forEach(person => loginsFor(ctx, person));
  const ids = new Set(people.map(p => p.id));
  rows.transactions.forEach(tx => {
    if (tx.device_id || !ids.has(tx.initiated_by_id) || tx.rail === 'CARD') return;
    if (tx.direction !== 'DEBIT') return;
    tx.device_id = deviceAt(ctx, tx.initiated_by_id, toDate(tx.created_at))?.id || null;
  });
  const customers = new Set(people.flatMap(p => ctx.customersOf.get(p.id) || []));
  rows.sct_beneficiaries
    .filter(b => customers.has(b.customer_id) && !b.added_from_device_id)
    .forEach(b => {
      const holder = ctx.holderOf(ctx.customers.get(b.customer_id));
      b.added_from_device_id = holder
        ? deviceAt(ctx, holder.id, toDate(b.added_at))?.id || null
        : null;
    });
}

// ---- KYC ----------------------------------------------------------------------------------------

const ID_DOCS: [string, number, number][] = [
  ['NATIONAL_ID', 55, 10],
  ['PASSPORT', 35, 10],
  ['DRIVERS_LICENSE', 10, 15],
];
const FAILURES = [
  'Photo too blurry to read the document number',
  'Selfie does not match the ID photo',
  'Name on the document differs from the application',
];
// A parked application waits on the screening team (Park for screening writes the same reason).
const ESCALATIONS = ['Screening hit to review'];
// The deadline of an onboarding: 5 days for a person, 10 business days for a company (KYB reads
// more papers and checks the registers).
const onboardingDue = (opened, business) =>
  business ? addWorkingDays(opened, 10) : new Date(opened.getTime() + 5 * DAY);
// A senior signs off medium and high risks (the workflows and the desk guide say so).
const SENIOR_RISKS = ['MEDIUM', 'HIGH'];
const SIGNOFF_REASON = 'Medium or high risk: senior sign-off';

/** Card acceptance is decided at onboarding: until then a company has only asked for it. */
function requestedOnly(business) {
  Object.assign(business, {
    accepts_card_payments: false,
    chargeback_ratio: null,
    reserve_pct: null,
    reserve_days: null,
  });
}

/** A paper whose check failed, with why. */
function failPaper(doc, reason, when, by) {
  Object.assign(doc, {
    check_result: 'FAILED',
    failure_reason: reason,
    verified: false,
    verified_at: iso(when),
    verified_by: by,
  });
}

function idNumber(type) {
  const L = () => String.fromCharCode(65 + between(0, 25));
  if (type === 'PASSPORT') return `${between(10, 26)}${L()}${L()}${between(10000, 99999)}`;

  if (type === 'NATIONAL_ID') {
    return Array.from({ length: 9 }, () => (chance(0.5) ? L() : between(0, 9))).join('');
  }

  return String(between(1e11, 9e11));
}

function kycCase(ctx, customer, fields) {
  const row = {
    id: uuid(),
    customer_id: customer.id,
    reference: null,
    type: 'ONBOARDING',
    trigger: null,
    channel: customer.onboarding_channel,
    status: 'APPROVED',
    opened_at: null,
    due_at: null,
    assigned_to: null,
    decided_by: null,
    resolved_at: null,
    escalated_at: null,
    escalation_reason: null,
    rejection_reason: null,
    rejection_code: null,
    risk_before: null,
    risk_after: null,
    investigation_id: null,
    notes: null,
    updated_at: null,
    ...fields,
  };
  row.updated_at = row.updated_at || row.resolved_at || row.escalated_at || row.opened_at;
  ctx.rows.kyc_cases.push(row);

  return row;
}

function documentRow(ctx, kyc, fields) {
  const row = {
    id: uuid(),
    customer_id: kyc.customer_id,
    kyc_case_id: kyc.id || null,
    individual_id: null,
    business_id: null,
    information_request_id: null,
    document_type: null,
    document_number: null,
    issued_at: null,
    expires_at: null,
    issuing_country: null,
    file_name: null,
    file_url: null,
    source: kyc.channel === 'BRANCH' ? 'OPERATOR_UPLOAD' : 'CUSTOMER_APP',
    uploaded_at: null,
    check_result: 'PASSED',
    failure_reason: null,
    provider_check_id: null,
    verified: true,
    verified_at: null,
    verified_by: null,
    ...fields,
  };
  row.file_url = `https://files.forest-lab-bank.fr/kyc/${row.customer_id}/${row.id}/${row.file_name}`;
  ctx.rows.documents.push(row);

  return row;
}

/** An ID, valid on the day it was checked; `expiresSoon` makes it run out in the last weeks. */
const ID_CARD_COUNTRIES = ['FR', 'DE', 'ES', 'IT', 'BE', 'PT', 'PL', 'RO', 'NL'];

function idDocument(ctx, kyc, person, uploaded, outcome, expiresSoon?) {
  // Outside the EU there is no ID card a French bank accepts: a passport.
  const type = ID_CARD_COUNTRIES.includes(person.nationality)
    ? weighted(ID_DOCS.map(([t, w]) => [t, w]))
    : 'PASSPORT';
  const years = ID_DOCS.find(([t]) => t === type)[2];
  let expires = new Date(uploaded.getTime() + between(200, (years - 1) * 365) * DAY);
  if (expiresSoon) expires = daysAgo(between(3, 40));
  const issued = new Date(expires.getTime() - years * 365 * DAY);
  const slug = ascii(person.last_name).toLowerCase();

  return documentRow(ctx, kyc, {
    individual_id: person.id,
    document_type: type,
    document_number: idNumber(type),
    issued_at: iso(withTime(issued)),
    expires_at: iso(withTime(expires)),
    issuing_country: person.nationality,
    file_name: `${type.toLowerCase()}_${slug}.jpg`,
    uploaded_at: iso(uploaded),
    provider_check_id: `IDV-${hex(12).toUpperCase()}`,
    ...outcome,
  });
}

const checked = (when, by) => ({ verified: true, verified_at: iso(when), verified_by: by });
// Not checked yet: no result until the provider or a person looks at it (MANUAL_REVIEW is an answer
// of the check, "look closer", never the state before it).
const pending = { check_result: null, verified: false };

/** How the ID check ended: passed, failed (with why) or still waiting for a person. */
function idOutcome(state, verifiedAt, by) {
  if (state === 'done') return checked(verifiedAt, by);
  if (state === 'open') return pending;

  return {
    check_result: 'FAILED',
    failure_reason: pick(FAILURES),
    verified: false,
    verified_at: iso(verifiedAt),
    verified_by: by,
  };
}

/** The selfie fails with the ID when the faces do not match; otherwise it passes or waits. */
function selfieOutcome(idOutcomeRow, state, verifiedAt, by) {
  if (/selfie/i.test(idOutcomeRow.failure_reason || '')) return idOutcomeRow;

  return state === 'open' ? pending : checked(verifiedAt, by);
}

/**
 * An id whose scan shows `flaw` (clean, glare, cropped or name, random.js scanFlaw): derived from
 * the drawn id, so no random draw is used.
 */
function cleanScanId(id, flaw = 'clean') {
  let next = id;

  while (scanFlaw(next) !== flaw) {
    const h = createHash('md5').update(next).digest('hex');
    next = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
      20,
      32,
    )}`;
  }

  return next;
}

/** Gives an ID document the scan of `flaw` (see cleanScanId), its file following its id. */
function rescan(doc, flaw = 'clean') {
  const id = cleanScanId(doc.id, flaw);
  Object.assign(doc, { id, file_url: doc.file_url.replace(/\/[^/]+\/([^/]+)$/, `/${id}/$1`) });
}

/** The documents of one person on a case: ID, selfie for remote channels, proof of address. */
/** state: done, open, failed, or clean (waiting for its check, which it will pass). */
function personDocuments(ctx, kyc, person, uploaded, verifiedAt, by, given) {
  const state = given === 'clean' ? 'open' : given;
  const outcome = idOutcome(state, verifiedAt, by);
  const docs = [idDocument(ctx, kyc, person, uploaded, outcome)];
  if (given === 'clean') rescan(docs[0]);

  if (kyc.channel !== 'BRANCH') {
    docs.push(
      documentRow(ctx, kyc, {
        individual_id: person.id,
        document_type: 'SELFIE',
        file_name: 'selfie.jpg',
        uploaded_at: iso(at(uploaded, 0.02)),
        provider_check_id: `IDV-${hex(12).toUpperCase()}`,
        ...selfieOutcome(outcome, state, verifiedAt, by),
      }),
    );
  }

  docs.push(
    documentRow(ctx, kyc, {
      individual_id: person.id,
      document_type: 'PROOF_OF_ADDRESS',
      issued_at: iso(withTime(new Date(uploaded.getTime() - between(5, 80) * DAY))),
      file_name: pick([
        'facture_edf.pdf',
        'facture_orange.pdf',
        'quittance_loyer.pdf',
        'avis_imposition.pdf',
      ]),
      uploaded_at: iso(at(uploaded, 0.05)),
      ...(state === 'open' ? pending : checked(verifiedAt, by)),
    }),
  );

  if (['FROM_70K_TO_120K', 'ABOVE_120K'].includes(person.income_band)) {
    const [type, file] = pick([
      ['PROOF_OF_INCOME', 'bulletin_salaire.pdf'],
      ['PROOF_OF_INCOME', 'avis_imposition.pdf'],
      ['BANK_STATEMENT', 'releve_bancaire.pdf'],
    ]);
    docs.push(
      documentRow(ctx, kyc, {
        individual_id: person.id,
        document_type: type,
        issued_at: iso(withTime(new Date(uploaded.getTime() - between(5, 40) * DAY))),
        file_name: file,
        uploaded_at: iso(at(uploaded, 0.06)),
        ...(state === 'open' ? pending : checked(verifiedAt, by)),
      }),
    );
  }

  return docs;
}

// Open company files take turns, so a reviewer meets each case a real desk sees: complete, the
// beneficial owners' declaration not sent yet, a Kbis extract older than the 3 months accepted, or
// complete with a request to take card payments, mostly online and slow to deliver (riskier).
const OPEN_COMPANY_FILES = ['complete', 'no_ubo', 'old_kbis', 'card_request'];
const CARD_REQUEST = {
  products_sold: 'Products and services sold on its website',
  expected_monthly_volume: 38000,
  average_basket: 140,
  online_share_pct: 85,
  delivery_delay_days: 21,
};

// What a request asks a company for, by what its file lacks.
const COMPANY_ASKS = { no_ubo: 'BUSINESS_UBO', old_kbis: 'BUSINESS_KBIS', complete: 'BUSINESS' };

/** Which kind of open company file comes next (see OPEN_COMPANY_FILES). */
function nextCompanyFile(ctx, business) {
  ctx.openCompanyFiles = (ctx.openCompanyFiles || 0) + 1;
  const file = OPEN_COMPANY_FILES[(ctx.openCompanyFiles - 1) % OPEN_COMPANY_FILES.length];
  // Asked, not granted: Approve card acceptance is what turns accepts_card_payments on.
  if (file === 'card_request') Object.assign(business, CARD_REQUEST);

  return file;
}

function companyDocuments(ctx, kyc, business, uploaded, verifiedAt, by, done, file = 'complete') {
  const outcome = done ? checked(verifiedAt, by) : pending;
  [
    ['COMPANY_REGISTRATION', 'kbis.pdf', business.registration_number],
    ['ARTICLES_OF_ASSOCIATION', 'statuts.pdf', null],
    ['UBO_DECLARATION', 'declaration_beneficiaires_effectifs.pdf', null],
  ].forEach(([type, fileName, number], k) => {
    // Same random draws whatever the case, so the rest of the data does not move.
    const issuedDaysAgo = between(2, 60);
    if (file === 'no_ubo' && type === 'UBO_DECLARATION') return;
    const issuedAgo =
      file === 'old_kbis' && type === 'COMPANY_REGISTRATION' ? 100 + issuedDaysAgo : issuedDaysAgo;
    documentRow(ctx, kyc, {
      business_id: business.id,
      document_type: type,
      document_number: number,
      issued_at: iso(withTime(new Date(uploaded.getTime() - issuedAgo * DAY))),
      issuing_country: 'FR',
      file_name: fileName,
      uploaded_at: iso(at(uploaded, 0.03 * k)),
      ...outcome,
    });
  });
}

const QUESTIONS = {
  ONBOARDING: [
    'Please upload a proof of address dated less than three months ago.',
    'Your ID photo is blurry: please take a new photo of both sides of your ID card.',
    'Please tell us where the money you plan to deposit comes from, with a supporting document.',
  ],
  BUSINESS: [
    'Please upload the latest Kbis extract (less than three months old).',
    'Please send the register of beneficial owners and the ID of each owner above 25%.',
  ],
  BUSINESS_UBO: [
    'Please send the beneficial owners declaration (register of beneficial owners) and the ID of each owner above 25%.',
  ],
  BUSINESS_KBIS: ['Please upload a Kbis extract less than three months old.'],
  PROOF_OF_ADDRESS: ['Please upload a proof of address dated less than three months ago.'],
  DOCUMENT_EXPIRED: ['Your ID document has expired: please upload a valid ID in the app.'],
  // The client never learns about an investigation: the questions read like routine checks.
  SOURCE_OF_FUNDS: [
    'As part of our regular account checks, please explain where the money received on your account in the last weeks comes from, with a supporting document (contract, invoice, deed of sale).',
  ],
  UNRECOGNISED_PAYMENTS: [
    'Please confirm in the app which of the card payments listed you did not make, and whether your card is still in your possession.',
  ],
  CHARGEBACK_FRAUD: [
    'Please confirm in the app that you did not make this payment and that your card is in your possession.',
  ],
  CHARGEBACK_EVIDENCE: [
    'Please send us your order confirmation and your messages with the merchant, so we can file your claim.',
  ],
  RECALL_CONSENT: ['A payment you received was sent by mistake. Do you agree that we return it?'],
  PROOF_OF_INCOME: [
    'To finish studying your loan request, please upload your last three payslips and your latest tax notice.',
  ],
  BUSINESS_FINANCIALS: [
    'To finish studying your loan request, please upload your latest balance sheet and income statement, and your bank statements for the last three months.',
  ],
  GUARANTOR_DOCUMENTS: [
    'You agreed to guarantee a loan: please upload your ID, your latest tax notice and sign the guarantee in the app.',
  ],
  DISPUTE_DETAILS: [
    'Before we open a claim: did you contact the merchant? Please send us your order confirmation and your messages with them.',
  ],
  NEW_ADDRESS: [
    'To update your address, please upload a proof of address in your name dated less than three months ago.',
  ],
  PERIODIC_REVIEW: [
    'As part of our yearly review, please confirm your occupation and your monthly income.',
  ],
  COMPLAINT_DETAILS: [
    'To look into your complaint, please tell us when you tried to log in, on which device, and the message you saw.',
  ],
  COLLECTION_SITUATION: [
    'To agree on a payment plan, please send your latest payslip or benefit statement and tell us how much you can pay each month.',
  ],
};
const ANSWERS_BY_TOPIC = {
  SOURCE_OF_FUNDS: [
    'It is the sale of my car, the bill of sale is attached.',
    'These are payments from friends for a shared holiday rental.',
    'My parents helped me with a deposit for a flat.',
  ],
  CHARGEBACK_FRAUD: ['Confirmed, I did not make it and I still have my card.'],
  CHARGEBACK_EVIDENCE: ['Order confirmation and my emails with the shop attached.'],
  RECALL_CONSENT: ['Yes, I did not expect this money, please return it.'],
  DISPUTE_DETAILS: ['Yes, they stopped answering. Order confirmation and emails attached.'],
  PROOF_OF_INCOME: ['Payslips for the last three months and my 2026 tax notice attached.'],
  UNRECOGNISED_PAYMENTS: [
    'I did not make the last three payments, I still have my card.',
    'None of these online payments are mine.',
  ],
};
const ANSWERS = [
  'Uploaded the document in the app.',
  'Here is my new ID card, renewed last month.',
  'The money comes from the sale of my flat, notary deed attached.',
  'Done, sorry for the delay.',
];

const CASE_LINKS = {
  KYC_CASE: 'kyc_case_id',
  INVESTIGATION: 'investigation_id',
  CHANGE_REQUEST: 'change_request_id',
  DISPUTE_REQUEST: 'dispute_request_id',
  LOAN_APPLICATION: 'loan_application_id',
  GUARANTEE: 'guarantee_id',
  COLLECTION_CASE: 'collection_case_id',
  CHARGEBACK: 'chargeback_id',
  SEPA_DISPUTE: 'sepa_dispute_id',
  COMPLAINT: 'complaint_id',
};

/**
 * A request for information about a case (a KYC case unless `context` says otherwise): sent,
 * answered, overdue or cancelled.
 */
function informationRequest(ctx, kyc, person, sentAt, status, topic, serves = 'KYC_CASE') {
  const due = new Date(sentAt.getTime() + 7 * DAY);
  let reminders = status === 'SENT' && NOW.getTime() - sentAt > 3 * DAY ? 1 : 0;
  if (status === 'OVERDUE') reminders = between(1, 3);
  const answered =
    status === 'ANSWERED' ? past(withTime(new Date(sentAt.getTime() + between(1, 6) * DAY))) : null;
  const row = {
    id: uuid(),
    reference: null,
    customer_id: kyc.customer_id,
    addressed_to_id: person.id,
    context: serves,
    kyc_case_id: null,
    investigation_id: null,
    change_request_id: null,
    dispute_request_id: null,
    chargeback_id: null,
    loan_application_id: null,
    complaint_id: null,
    sepa_dispute_id: null,
    collection_case_id: null,
    guarantee_id: null,
    channel: weighted([
      ['APP', 75],
      ['EMAIL', 25],
    ]),
    questions: pick(QUESTIONS[topic]),
    requested_by: kyc.assigned_to || kyc.decided_by || op('onboarding'),
    created_at: iso(at(sentAt, -0.2)),
    sent_at: status === 'DRAFT' ? null : iso(sentAt),
    due_at: iso(due),
    reminders_sent: reminders,
    last_reminder_at: reminders
      ? iso(past(withTime(new Date(sentAt.getTime() + (3 + 3 * reminders) * DAY))))
      : null,
    status,
    answered_at: answered ? iso(answered) : null,
    answer: answered ? pick(ANSWERS_BY_TOPIC[topic] || ANSWERS) : null,
    cancel_reason: status === 'CANCELLED' ? 'Customer provided the document at the branch.' : null,
  };
  row[CASE_LINKS[serves]] = kyc.id;
  ctx.rows.information_requests.push(row);
  const steps = [['DRAFT', at(sentAt, -0.2), row.requested_by]];
  if (status !== 'DRAFT') steps.push(['SENT', sentAt, row.requested_by]);
  if (status === 'OVERDUE') steps.push(['OVERDUE', due, 'system', 'No answer by the due date']);
  if (answered) steps.push(['ANSWERED', answered, 'customer']);

  if (status === 'CANCELLED') {
    steps.push(['CANCELLED', past(at(sentAt, 30)), row.requested_by, row.cancel_reason]);
  }

  trail(ctx.rows, 'INFORMATION_REQUESTS', row, steps);

  return row;
}

function payers(ctx, customer) {
  return (ctx.membersOf.get(customer.id) || []).map(m => ctx.people.get(m.individual_id));
}

/** The people holding more than 25% of a company, directly or through holdings (KYB asks their ID). */
function beneficialOwners(ctx, business) {
  const current = ctx.rows.business_members.filter(m => !m.until);
  const owners = (companyId, share, seen) =>
    current
      .filter(m => m.business_id === companyId)
      .flatMap(m => {
        const owned = (Number(m.ownership_pct) || 0) * share;
        if (m.individual_id) return [{ id: m.individual_id, owned }];
        if (!m.owner_business_id || seen.has(m.owner_business_id)) return [];

        return owners(m.owner_business_id, owned / 100, new Set([...seen, m.owner_business_id]));
      });
  const total = new Map();
  owners(business.id, 1, new Set([business.id])).forEach(({ id, owned }) =>
    total.set(id, (total.get(id) || 0) + owned),
  );

  return [...total].filter(([, owned]) => owned > 25).map(([id]) => ctx.people.get(id));
}

/** Whose documents an application holds: its holders, and on an open company file each
 * beneficial owner too (KYB asks their ID). */
function applicants(ctx, customer, business, state) {
  const holders = payers(ctx, customer);
  if (!business || state === 'done') return holders;

  return [...new Set([...holders, ...beneficialOwners(ctx, business)])].filter(Boolean);
}

/** A question asked during an onboarding: answered with a document, or cancelled. */
function onboardingQuestion(ctx, kyc, person, asked, resolved, by) {
  if (chance(0.1)) {
    informationRequest(ctx, kyc, person, asked, 'CANCELLED', 'PROOF_OF_ADDRESS');

    return null;
  }

  const rfi = informationRequest(ctx, kyc, person, asked, 'ANSWERED', 'PROOF_OF_ADDRESS');
  // The answer came before the decision it served.
  const latest = new Date(resolved.getTime() - between(2, 20) * HOUR);

  if (toDate(rfi.answered_at) > latest) {
    const answered = later(latest, at(asked, 1));
    rfi.answered_at = iso(answered);
    const line = ctx.rows.status_changes.find(
      c => c.record_id === rfi.id && c.new_value === 'ANSWERED',
    );
    if (line) line.changed_at = iso(answered);
  }

  documentRow(ctx, kyc, {
    individual_id: person.id,
    information_request_id: rfi.id,
    document_type: 'PROOF_OF_ADDRESS',
    issued_at: iso(withTime(new Date(asked.getTime() - between(3, 30) * DAY))),
    file_name: 'justificatif_domicile.pdf',
    uploaded_at: rfi.answered_at,
    source: rfi.channel === 'EMAIL' ? 'EMAIL' : 'CUSTOMER_APP',
    ...checked(earlier(at(toDate(rfi.answered_at), 2), resolved), by),
  });

  return rfi;
}

/** The first moment every holder of the customer is 18 (and a day). */
function adultSince(ctx, customer) {
  return Math.max(...payers(ctx, customer).map(p => eighteenth(p) + DAY));
}

/**
 * When an onboarding was approved: on a working day, before the first account opened (an account
 * opens once the approval is given). An application that came in too close to that is moved a day
 * or three earlier, the customer's record with it.
 */
function approvalMoment(ctx, customer) {
  const accounts = ctx.accountsOf.get(customer.id) || [];
  const firstOpen = accounts.reduce(
    (min, a) => Math.min(min, toDate(a.opened_at).getTime()),
    NOW.getTime(),
  );
  let opened = toDate(customer.created_at);
  const drawn = later(withTime(new Date(`${customer.onboarded_at}T00:00:00Z`)), at(opened, 0.5));
  let resolved = workBefore(past(earlier(drawn, new Date(firstOpen - between(10, 90) * MINUTE))));

  if (resolved.getTime() - opened.getTime() < 3 * HOUR) {
    const back = new Date(resolved.getTime() - between(20, 72) * HOUR);
    opened = new Date(Math.max(back.getTime(), adultSince(ctx, customer)));
    Object.assign(customer, { created_at: iso(opened) });
  }

  if (resolved.getTime() - opened.getTime() < 20 * MINUTE) {
    resolved = new Date(Math.min(opened.getTime() + 30 * MINUTE, firstOpen - 5 * MINUTE));
  }

  return { opened, resolved };
}

/** When a reviewer picked an approved case up, and when a senior signed it off (medium or high). */
function reviewMoments(opened, resolved, senior) {
  let review = workMoment(at(opened, between(1, 6)));
  if (review >= resolved) review = new Date((opened.getTime() + resolved.getTime()) / 2);
  let signoff = senior ? workBefore(new Date(resolved.getTime() - between(1, 20) * HOUR)) : null;
  if (signoff && signoff <= review) signoff = new Date((review.getTime() + resolved.getTime()) / 2);

  return { review, signoff };
}

/** The papers an approval rests on, checked; each holder's ID proves their membership. */
function approvedPapers(ctx, kyc, customer, checkedAt, by) {
  const opened = toDate(kyc.opened_at);
  const people = payers(ctx, customer);
  people.forEach(p => {
    const docs = personDocuments(ctx, kyc, p, at(opened, 0.1), checkedAt, by, 'done');
    const member = (ctx.membersOf.get(customer.id) || []).find(m => m.individual_id === p.id);
    if (member) member.proof_document_id = docs[0].id;
    ctx.idDocs.set(`${customer.id}:${p.id}`, docs[0]);
  });
  const business = ctx.businesses.get(customer.business_id);
  if (business) companyDocuments(ctx, kyc, business, at(opened, 0.2), checkedAt, by, true);

  return people;
}

/** A long review often waited for a proof of address from the client: its history lines. */
function questionSteps(ctx, kyc, person, review, latest, by) {
  const asked = workMoment(at(review, between(1, 6)));
  if (!chance(0.25) || !person || latest - asked.getTime() <= DAY) return [];
  const rfi = onboardingQuestion(ctx, kyc, person, asked, latest, by);
  if (!rfi) return [];

  return [
    ['WAITING_CUSTOMER', asked, by, 'Documents asked from the client'],
    ['IN_REVIEW', toDate(rfi.answered_at), 'system', 'Client answered'],
  ];
}

/** A finished onboarding: documents checked, sometimes after a question to the client; a medium or
 * high risk signed off by a senior. */
function approvedOnboarding(ctx, customer) {
  const { opened, resolved } = approvalMoment(ctx, customer);
  // The customer became active the day the case was approved.
  customer.onboarded_at = isoDate(resolved);
  ctx.approvedAt.set(customer.id, resolved);
  const senior = SENIOR_RISKS.includes(customer.risk_rating);
  const by = op('onboarding');
  const decider = senior ? op('l2') : by;
  const business = ctx.businesses.get(customer.business_id);
  const { review, signoff } = reviewMoments(opened, resolved, senior);
  const kyc = kycCase(ctx, customer, {
    status: 'APPROVED',
    opened_at: iso(opened),
    due_at: iso(onboardingDue(opened, business)),
    assigned_to: by,
    decided_by: decider,
    resolved_at: iso(resolved),
    escalated_at: signoff ? iso(signoff) : null,
    escalation_reason: signoff ? SIGNOFF_REASON : null,
    risk_after: customer.risk_rating,
    notes: senior ? 'Enhanced due diligence: second approval by compliance.' : null,
  });
  const people = approvedPapers(ctx, kyc, customer, earlier(at(review, 0.3), resolved), by);
  const steps = [
    ['OPEN', opened],
    ['IN_REVIEW', review, by],
    ...questionSteps(ctx, kyc, people[0], review, signoff || resolved, by),
  ];
  if (signoff) steps.push(['PENDING_APPROVAL', signoff, by, SIGNOFF_REASON]);
  steps.push(['APPROVED', resolved, decider]);
  trail(ctx.rows, 'KYC_CASES', kyc, steps);

  return kyc;
}

/** A question to the client on an application in review: the case now waits on them. */
function askClient(ctx, kyc, person, topic) {
  const from = kyc.updated_at ? toDate(kyc.updated_at) : toDate(kyc.opened_at);
  const sent = past(workMoment(at(from, between(1, 8))));
  informationRequest(
    ctx,
    kyc,
    person,
    sent,
    NOW.getTime() - sent > 7 * DAY ? 'OVERDUE' : 'SENT',
    topic,
  );
  kyc.status = 'WAITING_CUSTOMER';

  return sent;
}

/** What an application holds so far; a reviewer waiting on the client has asked a question.
 * `reviewed`: every paper checked already, the case waits for its decision. */
function applicationDocuments(ctx, kyc, customer, opened, by, reviewed, review) {
  const checkedAt = review ? earlier(at(review, 0.3), past(NOW)) : at(opened, 4);
  const { status } = kyc;
  let state = 'open';
  if (reviewed) state = 'done';
  else if (status === 'IN_REVIEW' && chance(0.5)) state = 'failed';
  const business = ctx.businesses.get(customer.business_id);
  const people = applicants(ctx, customer, business, state);
  const file = business && state !== 'done' ? nextCompanyFile(ctx, business) : 'complete';
  // A complete company file comes with clean ID scans, still to check: the workflow's Onfido step
  // passes them live. The incomplete ones keep the flaws a reviewer catches.
  const complete = business && state !== 'done' && ['complete', 'card_request'].includes(file);
  const idState = complete ? 'clean' : state;
  people.forEach(p => personDocuments(ctx, kyc, p, at(opened, 0.1), checkedAt, by, idState));

  if (business) {
    companyDocuments(ctx, kyc, business, at(opened, 0.2), checkedAt, by, state === 'done', file);
  }

  // Something asked from the client: the case waits on them, out of the work queue. A complete
  // company file under review has nothing to ask.
  const asks = status === 'IN_REVIEW' && !reviewed && people[0] && !complete;

  return asks ? askClient(ctx, kyc, people[0], business ? COMPANY_ASKS[file] : 'ONBOARDING') : null;
}

// Open retail applications take turns, so the Retail onboarding queue holds every path of its
// workflow: approved as is, an ID Onfido refuses (name differs, card cut off), a possible sanctions
// match, a medium risk (an inheritance above the declared income, a home outside the EU), and a
// proof of address too old or never sent. Applied on the drawn rows with hashes, never new draws.
const OPEN_RETAIL_FILES = [
  'clean',
  'failed_id',
  'screening',
  'risk_funds',
  'old_address',
  'clean',
  'blurry_id',
  'risk_abroad',
  'no_address',
];
const FLAW = { clean: 'clean', blurry_id: 'cropped', failed_id: 'name' };
const ID_TYPES = ID_DOCS.map(([type]) => type);
const GENEVA = {
  address_line1: '14 rue du Rhône',
  postal_code: '1204',
  city: 'Genève',
  country: 'CH',
  country_of_residence: 'CH',
  tax_residence: 'CH',
};
// The lists a homonym of an applicant sits on (same as the terrorism lists of screening()).
const HOMONYM_LISTS = [
  ['OFAC', 'Counter-terrorism (SDGT)'],
  ['EU', 'Counter-terrorism (CP 931)'],
  ['UN', 'ISIL and Al-Qaida (Resolution 1267)'],
];
const hashOf = text =>
  parseInt(createHash('md5').update(String(text)).digest('hex').slice(0, 8), 16);

const hashUuid = text => {
  const h = createHash('md5').update(String(text)).digest('hex');

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
    20,
    32,
  )}`;
};

const daysBefore = (isoText, days) => iso(new Date(toDate(isoText).getTime() - days * DAY));

/** A name on a terrorism list that is also an applicant's (a homonym, born another year). */
function homonymEntry(ctx, person) {
  const h = hashOf(`${person.id}homonym`);
  const [list, regime] = HOMONYM_LISTS[h % HOMONYM_LISTS.length];
  const born = new Date(`${person.date_of_birth}T00:00:00Z`);
  born.setUTCFullYear(born.getUTCFullYear() - 9 - (h % 14));
  const listed = new Date(NOW.getTime() - (400 + (h % 2500)) * DAY);
  const row = {
    id: hashUuid(`${person.id}homonym`),
    list,
    name: `${person.first_name} ${person.last_name}`,
    aliases: `${person.last_name} ${person.first_name}`,
    country: person.nationality,
    date_of_birth: isoDate(born),
    entity_type: 'PERSON',
    regime,
    source_entry_id: `${list}-${10000 + (h % 90000)}`,
    listed_at: iso(listed),
    delisted_at: null,
    updated_at: iso(new Date(listed.getTime() + 30 * DAY)),
  };
  ctx.rows.watchlist_entries.push(row);

  return row;
}

/** Clean scans Onfido passes and proofs of address from the last weeks, unless `file` says not. */
function retailPapers(ctx, kyc, file, first) {
  const docs = ctx.rows.documents.filter(doc => doc.kyc_case_id === kyc.id);
  const firsts = doc => doc.individual_id === first.id;
  docs.forEach(doc => {
    if (ID_TYPES.includes(doc.document_type)) {
      rescan(doc, firsts(doc) ? FLAW[file] || 'clean' : 'clean');
    }

    if (doc.document_type === 'PROOF_OF_ADDRESS') {
      const old = file === 'old_address' && firsts(doc);
      const age = old ? 100 + (hashOf(doc.id) % 30) : 3 + (hashOf(doc.id) % 20);
      Object.assign(doc, { issued_at: daysBefore(doc.uploaded_at, age) });
    }
  });

  if (file === 'no_address') {
    const proof = docs.find(doc => doc.document_type === 'PROOF_OF_ADDRESS' && firsts(doc));
    ctx.rows.documents.splice(ctx.rows.documents.indexOf(proof), 1);
  }
}

/** What the next open retail application holds (see OPEN_RETAIL_FILES). */
function nextRetailFile(ctx, kyc, customer) {
  ctx.openRetailFiles = (ctx.openRetailFiles || 0) + 1;
  const file = OPEN_RETAIL_FILES[(ctx.openRetailFiles - 1) % OPEN_RETAIL_FILES.length];
  const people = payers(ctx, customer).filter(Boolean);
  const first = people[0];
  retailPapers(ctx, kyc, file, first);
  if (file === 'screening') homonymEntry(ctx, first);

  if (file === 'risk_funds') {
    Object.assign(first, {
      source_of_funds: 'INHERITANCE',
      source_of_wealth: 'Family inheritance',
    });
    Object.assign(customer, { expected_monthly_in: 12000, expected_monthly_out: 4500 });
  }

  // The whole household shares the home.
  if (file === 'risk_abroad') people.forEach(p => Object.assign(p, GENEVA));

  return file;
}

/**
 * A parked application: its IDs passed Onfido, then screening raised an open hit on its applicant
 * that the screening team has to decide on.
 */
function parkedHit(ctx, kyc, person, escalated) {
  const entry = homonymEntry(ctx, person);
  const created = earlier(at(toDate(kyc.opened_at), 1), escalated);
  ctx.rows.documents
    .filter(doc => doc.kyc_case_id === kyc.id)
    .filter(doc => [...ID_TYPES, 'SELFIE'].includes(doc.document_type))
    .forEach(doc => {
      if (doc.document_type !== 'SELFIE') rescan(doc);
      Object.assign(doc, {
        check_result: 'PASSED',
        failure_reason: null,
        verified: true,
        verified_at: iso(at(created, -0.5)),
        verified_by: kyc.assigned_to,
      });
    });
  const hit = {
    id: hashUuid(`${kyc.id}hit`),
    reference: null,
    individual_id: person.id,
    business_id: null,
    counterparty_id: null,
    transaction_id: null,
    investigation_id: null,
    watchlist_entry_id: entry.id,
    match_score: 85,
    status: 'OPEN',
    created_at: iso(created),
    screened_name: entry.name,
    trigger: 'ONBOARDING',
    matched_on: 'Name, nationality',
    hit_type: 'SANCTIONS',
    entity_type: 'PERSON',
    reviewed_by: null,
    reviewed_at: null,
    decision_reason: null,
  };
  ctx.rows.screening_hits.push(hit);
  ctx.rows.status_changes.push({
    id: hashUuid(`${hit.id}status`),
    record_type: 'SCREENING_HITS',
    record_id: hit.id,
    field: 'status',
    old_value: null,
    new_value: 'OPEN',
    changed_by: 'system',
    changed_at: iso(created),
    reason: 'Screening onboarding',
  });
}

// The open applications take turns over these slots, in the order they came in (applicantDates).
// None waits for a senior's sign-off: that queue fills when a workflow run escalates. REVIEWED: in
// review, every paper checked, ready for its decision. LATE: past its deadline because the client
// took days to answer; the new paper just came in.
const APPLICANT_SLOTS = [
  'OPEN',
  'OPEN',
  'IN_REVIEW',
  'OPEN',
  'ESCALATED',
  'OPEN',
  'REVIEWED',
  'LATE',
  'OPEN',
  'OPEN',
  'OPEN',
  'IN_REVIEW',
  'ESCALATED',
  'OPEN',
];
const OPEN_APPLICATIONS = { RETAIL: 11, BUSINESS: 3 };
// How long ago each slot's application came in, in hours: a desk that decides in about 3 days.
const SLOT_HOURS = {
  OPEN: [1, 60],
  IN_REVIEW: [24, 96],
  REVIEWED: [12, 48],
  ESCALATED: [48, 200],
  LATE: [150, 210],
};

/**
 * The open applications' dates, before devices and logins exist: each takes its slot and applied
 * that many hours ago (a late company, past its 10 business days). The customer, its own people
 * and memberships follow.
 */
function applicantDates(ctx) {
  ctx.applicantSlot = new Map();
  const kept = { RETAIL: 0, BUSINESS: 0 };
  ctx.rows.customers
    .filter(c => c.status === 'ONBOARDING')
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .filter(customer => {
      // A desk of this size has about ten applications open; the others never sent theirs.
      kept[customer.customer_type] += 1;
      if (kept[customer.customer_type] <= OPEN_APPLICATIONS[customer.customer_type]) return true;
      Object.assign(customer, { status: 'PROSPECT' });

      return false;
    })
    .forEach((customer, index) => {
      const slot = APPLICANT_SLOTS[index % APPLICANT_SLOTS.length];
      const [low, high] = slot === 'LATE' && customer.business_id ? [400, 480] : SLOT_HOURS[slot];
      const opened = new Date(NOW.getTime() - between(low * 60, high * 60) * MINUTE);
      ctx.applicantSlot.set(customer.id, slot);
      const before = customer.created_at;
      Object.assign(customer, { created_at: iso(opened), updated_at: iso(opened) });
      (ctx.membersOf.get(customer.id) || []).forEach(m => {
        Object.assign(m, { since: isoDate(opened) });
        const person = ctx.people.get(m.individual_id);
        const own = (ctx.customersOf.get(m.individual_id) || []).length === 1;

        if (person && own && person.created_at === before) {
          Object.assign(person, { created_at: iso(opened), updated_at: iso(opened) });
        }
      });
    });
}

/** The first working moment after `date` an operator could have picked a case up, before now. */
function pickedUp(date) {
  const moment = workMoment(date);

  return moment < new Date(NOW.getTime() - 10 * MINUTE) ? moment : earlier(date, past(NOW));
}

/** A late answer: the client sent the paper asked days ago, the case is back in review. */
function lateAnswer(ctx, kyc, customer, business, review, by) {
  const person = payers(ctx, customer)[0];
  const sent = pickedUp(at(review, between(1, 6)));
  const answered = new Date(NOW.getTime() - between(4, 30) * HOUR);
  const docs = ctx.rows.documents.filter(d => d.kyc_case_id === kyc.id);
  const asked = business
    ? docs.find(d => d.document_type === 'COMPANY_REGISTRATION')
    : docs.find(d => ID_TYPES.includes(d.document_type) && d.individual_id === person.id);
  failPaper(
    asked,
    business ? 'INPI register: older than 3 months' : FAILURES[0],
    at(review, 0.3),
    by,
  );
  const topic = business ? 'BUSINESS_KBIS' : 'ONBOARDING';
  const rfi = informationRequest(ctx, kyc, person, sent, 'SENT', topic);
  Object.assign(rfi, {
    status: 'ANSWERED',
    answered_at: iso(answered),
    answer: business ? 'A fresh Kbis extract is attached.' : 'Here is a new photo of my ID card.',
    reminders_sent: Math.min(2, Math.floor((answered.getTime() - sent) / (3 * DAY))),
  });
  ctx.rows.status_changes.push({
    id: uuid(),
    record_type: 'INFORMATION_REQUESTS',
    record_id: rfi.id,
    field: 'status',
    old_value: 'SENT',
    new_value: 'ANSWERED',
    changed_by: 'customer',
    changed_at: iso(answered),
    reason: null,
  });
  const fresh = documentRow(ctx, kyc, {
    individual_id: asked.individual_id,
    business_id: asked.business_id,
    information_request_id: rfi.id,
    document_type: asked.document_type,
    document_number: asked.document_number,
    issued_at: business ? iso(new Date(answered.getTime() - between(1, 5) * DAY)) : asked.issued_at,
    expires_at: asked.expires_at,
    issuing_country: asked.issuing_country,
    file_name: asked.file_name,
    uploaded_at: iso(answered),
    ...pending,
  });
  if (!business) rescan(fresh);

  return { sent, answered };
}

/** The late slot's history: the question, and the answer that came in days after. */
function lateSteps(ctx, kyc, customer, business, review, by) {
  const { sent, answered } = lateAnswer(ctx, kyc, customer, business, review, by);
  Object.assign(kyc, { updated_at: iso(answered) });

  return [
    ['WAITING_CUSTOMER', sent, by, 'Documents asked from the client'],
    ['IN_REVIEW', answered, 'system', 'Client answered: a new paper to check'],
  ];
}

/** Applications still in progress: a queue for the onboarding desk (slots: applicantDates). */
/** Where an open application stands, from its slot: status, reviewer, when picked up. */
function slotState(ctx, customer, opened) {
  const slot = ctx.applicantSlot.get(customer.id) || 'OPEN';
  const reviewed = slot === 'REVIEWED';
  const late = slot === 'LATE';
  const status = reviewed || late ? 'IN_REVIEW' : slot;
  if (status === 'OPEN') return { status, reviewed, late, by: null, review: null, escalated: null };
  const review = pickedUp(at(opened, between(1, 4)));
  const by = op('onboarding');
  const escalated = status === 'ESCALATED' ? pickedUp(at(review, between(4, 30))) : null;

  return { status, reviewed, late, by, review, escalated };
}

function openOnboarding(ctx, customer) {
  const opened = toDate(customer.created_at);
  const { status, reviewed, late, by, review, escalated } = slotState(ctx, customer, opened);
  const business = ctx.businesses.get(customer.business_id);
  if (business) requestedOnly(business);
  const kyc = kycCase(ctx, customer, {
    status,
    opened_at: iso(opened),
    due_at: iso(onboardingDue(opened, business)),
    assigned_to: by,
    escalated_at: escalated ? iso(escalated) : null,
    escalation_reason: escalated ? pick(ESCALATIONS) : null,
    updated_at: iso(escalated || review || opened),
  });
  const asked = applicationDocuments(ctx, kyc, customer, opened, by, reviewed || late, review);
  if (!customer.business_id && status === 'OPEN') nextRetailFile(ctx, kyc, customer);
  if (escalated && ctx.holderOf(customer)) parkedHit(ctx, kyc, ctx.holderOf(customer), escalated);
  const steps = [['OPEN', opened]];
  if (review) steps.push(['IN_REVIEW', review, by]);
  if (asked) steps.push(['WAITING_CUSTOMER', asked, by, 'Documents asked from the client']);
  if (late) steps.push(...lateSteps(ctx, kyc, customer, business, review, by));
  if (escalated) steps.push(['ESCALATED', escalated, by, kyc.escalation_reason]);
  trail(ctx.rows, 'KYC_CASES', kyc, steps);

  return kyc;
}

/** Applications the bank refused, long ago: the customer is DECLINED, the papers say why. */
function rejectedOnboarding(ctx, customer) {
  const opened = toDate(customer.created_at);
  const review = workMoment(at(opened, between(1, 6)));
  const decided = past(workMoment(at(review, between(20, 100))));
  const by = op('onboarding');
  const code = weighted([
    ['IDENTITY_FAILED', 2],
    ['DOCUMENT_FORGED', 1],
    ['RISK_APPETITE', 1],
  ]);
  const kyc = kycCase(ctx, customer, {
    status: 'REJECTED',
    opened_at: iso(opened),
    due_at: iso(onboardingDue(opened, ctx.businesses.get(customer.business_id))),
    assigned_to: by,
    decided_by: by,
    resolved_at: iso(decided),
    rejection_code: code,
    rejection_reason: refusalReason(
      code,
      'large cash deposits announced, source of funds not documented',
    ),
  });
  const [first] = payers(ctx, customer).map(p =>
    personDocuments(ctx, kyc, p, at(opened, 0.1), at(review, 0.3), by, 'done'),
  );
  const paper = type => first?.find(d => d.document_type === type);

  if (code === 'IDENTITY_FAILED') {
    [paper('SELFIE'), first?.[0]]
      .filter(Boolean)
      .forEach(d => failPaper(d, REFUSAL.IDENTITY_FAILED, at(review, 0.3), by));
  }

  if (code === 'DOCUMENT_FORGED' && paper('PROOF_OF_ADDRESS')) {
    failPaper(paper('PROOF_OF_ADDRESS'), REFUSAL.DOCUMENT_FORGED, at(review, 0.3), by);
  }

  Object.assign(customer, { status: 'DECLINED', updated_at: iso(decided) });
  ctx.declined.set(customer.id, [decided, by, kyc.rejection_reason]);
  trail(ctx.rows, 'KYC_CASES', kyc, [
    ['OPEN', opened],
    ['IN_REVIEW', review, by],
    ['REJECTED', decided, by, kyc.rejection_reason],
  ]);
}

const CYCLE = { LOW: 3 * 365, MEDIUM: 2 * 365, HIGH: 365 };

/** One review already done on the risk cycle. */
function pastReview(ctx, customer, due) {
  const opened = withTime(new Date(due.getTime() - 30 * DAY));
  const resolved = withTime(new Date(opened.getTime() + between(3, 28) * DAY));
  if (resolved > NOW || opened < toDate(customer.created_at)) return;
  const by = op(customer.risk_rating === 'HIGH' ? 'l2' : 'onboarding');
  const kyc = kycCase(ctx, customer, {
    type: 'PERIODIC_REVIEW',
    trigger: 'SCHEDULED',
    channel: 'APP',
    status: 'APPROVED',
    opened_at: iso(opened),
    due_at: iso(due),
    assigned_to: by,
    decided_by: by,
    resolved_at: iso(resolved),
    risk_before: customer.risk_rating,
    risk_after: customer.risk_rating,
  });
  trail(ctx.rows, 'KYC_CASES', kyc, [
    ['OPEN', opened],
    ['IN_REVIEW', at(opened, 30), by],
    ['APPROVED', resolved, by],
  ]);
}

/** Reviews on the risk cycle: past ones approved, the coming one open a month ahead. */
function periodicReviews(ctx, customer) {
  if (!customer.next_review_at) return;
  const next = new Date(`${customer.next_review_at}T09:00:00Z`);
  const cycle = CYCLE[customer.risk_rating] * DAY;
  const onboarded = toDate(customer.created_at);

  for (
    let due = new Date(next.getTime() - cycle);
    due > onboarded;
    due = new Date(due.getTime() - cycle)
  ) {
    pastReview(ctx, customer, due);
  }

  const opened = withTime(new Date(next.getTime() - 30 * DAY));
  if (opened > NOW || customer.status !== 'ACTIVE') return;
  const by = chance(0.5) ? op('onboarding') : null;
  const kyc = kycCase(ctx, customer, {
    type: 'PERIODIC_REVIEW',
    trigger: 'SCHEDULED',
    channel: 'APP',
    status: by ? 'IN_REVIEW' : 'OPEN',
    opened_at: iso(opened),
    due_at: iso(next),
    assigned_to: by,
    risk_before: customer.risk_rating,
  });
  const steps = [['OPEN', opened]];

  if (by) {
    steps.push(['IN_REVIEW', past(at(opened, 26)), by]);
    const person = ctx.holderOf(customer);

    if (person && chance(0.6)) {
      informationRequest(
        ctx,
        kyc,
        person,
        past(at(opened, 30)),
        chance(0.3) ? 'ANSWERED' : 'SENT',
        'PERIODIC_REVIEW',
      );
    }
  }

  trail(ctx.rows, 'KYC_CASES', kyc, steps);
}

/** An ID that ran out lately opens a review, and the client is asked for a new one. */
function expiredIdReview(ctx, customer) {
  const person = ctx.holderOf(customer);
  const doc = person && ctx.idDocs.get(`${customer.id}:${person.id}`);
  if (!doc) return;
  const expired = daysAgo(between(3, 40));
  doc.expires_at = iso(withTime(expired));
  doc.issued_at = iso(withTime(new Date(expired.getTime() - 10 * 365 * DAY)));
  const opened = withTime(new Date(expired.getTime() + DAY));
  const by = op('onboarding');
  const kyc = kycCase(ctx, customer, {
    type: 'EVENT_REVIEW',
    trigger: 'DOCUMENT_EXPIRED',
    channel: 'APP',
    status: 'IN_REVIEW',
    opened_at: iso(opened),
    due_at: iso(new Date(opened.getTime() + 30 * DAY)),
    assigned_to: by,
    risk_before: customer.risk_rating,
  });
  const sent = past(at(opened, 2));
  const status =
    NOW.getTime() - sent > 7 * DAY
      ? weighted([
          ['OVERDUE', 2],
          ['ANSWERED', 1],
        ])
      : 'SENT';
  const rfi = informationRequest(ctx, kyc, person, sent, status, 'DOCUMENT_EXPIRED');

  if (status === 'ANSWERED') {
    idDocument(ctx, kyc, person, toDate(rfi.answered_at), {
      ...pending,
      information_request_id: rfi.id,
    });
  }

  trail(ctx.rows, 'KYC_CASES', kyc, [
    ['OPEN', opened, 'system', 'ID document expired'],
    ['IN_REVIEW', at(opened, 1), by],
  ]);
}

function kycCases(ctx) {
  const { rows } = ctx;
  ctx.idDocs = new Map();
  ctx.approvedAt = new Map();
  ctx.declined = new Map();
  let rejected = 0;
  rows.customers
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .forEach(customer => {
      if (customer.status === 'PROSPECT') {
        if (rejected < 3) {
          rejected += 1;
          rejectedOnboarding(ctx, customer);
        }

        return;
      }

      if (customer.status === 'ONBOARDING') {
        openOnboarding(ctx, customer);

        return;
      }

      approvedOnboarding(ctx, customer);
      periodicReviews(ctx, customer);
    });
  const storyCustomers = new Set([...ctx.stories.keys()]);
  rows.customers
    .filter(c => c.status === 'ACTIVE' && !storyCustomers.has(c.id))
    .filter(() => chance(0.035))
    .forEach(c => expiredIdReview(ctx, c));
}

// ---- change requests ----------------------------------------------------------------------------

const DOMAINS = ['gmail.com', 'outlook.fr', 'yahoo.fr', 'free.fr', 'orange.fr', 'icloud.com'];

function changeRequest(ctx, person, customer, fields) {
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    individual_id: person.id,
    requested_from_device_id: null,
    channel: 'APP',
    risk_flags: null,
    status: 'APPROVED',
    decided_by: null,
    decided_at: null,
    rejection_reason: null,
    ...fields,
  };
  ctx.rows.customer_change_requests.push(row);
  const steps = [['PENDING', toDate(row.requested_at), 'customer']];

  if (row.status !== 'PENDING') {
    steps.push([row.status, toDate(row.decided_at), row.decided_by, row.rejection_reason]);
  }

  trail(ctx.rows, 'CUSTOMER_CHANGE_REQUESTS', row, steps);

  return row;
}

const moved = country => {
  const home = homeAddress(country);

  return `${home.address_line1}, ${home.postal_code} ${home.city}`;
};

const DIAL = { RO: '+40', NG: '+234', UA: '+380' };
const CHANGE_REJECTIONS = {
  ADDRESS: 'Proof of the new address was not provided',
  PHONE: 'Code sent to the old phone number was never confirmed',
  EMAIL: 'Code sent to the old phone number was never confirmed',
  NAME: 'The name on the ID does not match the requested name',
};

/**
 * A new address needs a proof: asked for, then uploaded before the approval, or never sent (the
 * change is rejected once the request is overdue). Returns the change's status and decision date.
 */
function addressProof(ctx, change, person, requested, status) {
  const sent = at(requested, 0.5);
  const overdueBy = new Date(sent.getTime() + 8 * DAY);
  let rfiStatus = 'ANSWERED';
  let decision = status;

  if (status === 'PENDING' || (status === 'REJECTED' && overdueBy > NOW)) {
    decision = 'PENDING';
    rfiStatus = NOW.getTime() - sent.getTime() > 7 * DAY ? 'OVERDUE' : 'SENT';
  } else if (status === 'REJECTED') {
    rfiStatus = 'OVERDUE';
  }

  const rfi = informationRequest(
    ctx,
    change,
    person,
    sent,
    rfiStatus,
    'NEW_ADDRESS',
    'CHANGE_REQUEST',
  );
  if (decision === 'PENDING') return { status: decision, decided: null };

  if (decision === 'REJECTED') {
    return { status: decision, decided: past(at(overdueBy, between(2, 48))) };
  }

  const answered = toDate(rfi.answered_at);
  const decided = past(at(answered, between(2, 30)));
  documentRow(
    ctx,
    { customer_id: change.customer_id, channel: 'APP' },
    {
      individual_id: person.id,
      information_request_id: rfi.id,
      document_type: 'PROOF_OF_ADDRESS',
      issued_at: iso(withTime(new Date(requested.getTime() - between(3, 30) * DAY))),
      file_name: pick([
        'facture_edf.pdf',
        'quittance_loyer.pdf',
        'attestation_assurance_habitation.pdf',
      ]),
      uploaded_at: rfi.answered_at,
      ...checked(decided, change.decided_by),
    },
  );

  return { status: decision, decided };
}

/** Moves, new phones and emails, a married name; and the takeovers' phone changes. */
function changeRequests(ctx) {
  const { rows } = ctx;
  const active = rows.customers.filter(c => c.status === 'ACTIVE' && c.customer_type === 'RETAIL');
  active
    .filter(() => chance(0.16))
    .forEach(customer => {
      const person = ctx.holderOf(customer);
      if (!person) return;
      const field = weighted([
        ['ADDRESS', 45],
        ['PHONE', 20],
        ['EMAIL', 25],
        ['NAME', 10],
      ]);
      if (field === 'NAME' && !person.birth_name) return;
      const requested = past(withTime(daysAgo(between(1, 170))));
      let status =
        NOW.getTime() - requested < 4 * DAY
          ? 'PENDING'
          : weighted([
              ['APPROVED', 92],
              ['REJECTED', 8],
            ]);
      const values = {
        ADDRESS: [
          moved(person.country),
          `${person.address_line1}, ${person.postal_code} ${person.city}`,
        ],
        PHONE: [
          `+33 6 ${between(10, 99)} ${between(10, 99)} ${between(10, 99)} ${between(10, 99)}`,
          person.phone,
        ],
        EMAIL: [
          `${person.first_name.toLowerCase()}.${person.last_name.toLowerCase()}@${pick(DOMAINS)}`
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, ''),
          person.email,
        ],
        NAME: [
          `${person.first_name} ${person.birth_name}`,
          `${person.first_name} ${person.last_name}`,
        ],
      }[field];
      const by = op('onboarding');
      let decided = status === 'PENDING' ? null : past(at(requested, between(1, 30)));
      const id = uuid();

      if (field === 'ADDRESS') {
        const proof = { id, customer_id: customer.id, decided_by: by };
        ({ status, decided } = addressProof(ctx, proof, person, requested, status));
      }

      changeRequest(ctx, person, customer, {
        id,
        field,
        old_value: values[0],
        new_value: values[1],
        requested_at: iso(requested),
        requested_from_device_id: deviceAt(ctx, person.id, requested)?.id || null,
        verification_method: {
          ADDRESS: 'NONE',
          PHONE: 'OTP_OLD_PHONE',
          EMAIL: 'OTP_OLD_PHONE',
          NAME: 'ID_AND_SELFIE',
        }[field],
        status,
        decided_by: decided ? by : null,
        decided_at: decided ? iso(decided) : null,
        rejection_reason: status === 'REJECTED' ? CHANGE_REJECTIONS[field] : null,
      });
    });
  ctx.stories.forEach(story => {
    if (story.kind !== 'TAKEOVER') return;
    const requested = at(story.when, -0.3);
    const closed = story.outcome === 'CLOSED';
    const decided = closed ? past(at(story.when, 22)) : null;
    story.change = changeRequest(ctx, story.holder, story.customer, {
      field: 'PHONE',
      old_value: story.holder.phone,
      new_value: `${DIAL[story.attacker.country]} ${between(700, 799)} ${between(
        100,
        999,
      )} ${between(100, 999)}`,
      requested_at: iso(requested),
      requested_from_device_id: story.attacker.id,
      verification_method: 'NONE',
      risk_flags: `New device; login from ${story.attacker.city}; MFA reset 10 minutes before`,
      status: closed ? 'REJECTED' : 'PENDING',
      decided_by: closed ? op('l1') : null,
      decided_at: decided ? iso(decided) : null,
      rejection_reason: closed
        ? 'Not requested by the customer: account takeover confirmed by phone'
        : null,
    });
  });
}

// ---- screening -------------------------------------------------------------------------------

// [list, regime, country, listed person]
const REGIMES = [
  ['EU', 'Russia (Regulation 269/2014)', 'RU', 'Sergei Volkov'],
  ['EU', 'Belarus (Regulation 765/2006)', 'BY', 'Viktor Lukashevich'],
  ['OFAC', 'Iran (IRAN-EO13902)', 'IR', 'Reza Tehrani'],
  ['OFAC', 'Iran (IRAN-EO13902)', 'IR', 'Hassan Nouri'],
  ['UN', 'DPRK (Resolution 1718)', 'KP', 'Kim Song-il'],
  ['UK_HMT', 'Russia', 'RU', 'Dmitri Antonov'],
  ['UK_HMT', 'Russia', 'RU', 'Alexei Morozov'],
  ['UN', 'Libya (Resolution 1970)', 'LY', 'Omar Al-Fitouri'],
];
// Terrorism lists name people of every nationality, ours included: homonyms of our customers.
const TERRORISM = [
  ['OFAC', 'Counter-terrorism (SDGT)'],
  ['EU', 'Counter-terrorism (CP 931)'],
  ['UN', 'ISIL and Al-Qaida (Resolution 1267)'],
];
const LISTED_ENTITIES = [
  ['Arctic Petroleum Holdings JSC', 'RU'],
  ['Minsk Precision Machinery OJSC', 'BY'],
  ['Persian Gulf Shipping Co', 'IR'],
  ['Korea Ryonbong Trading', 'KP'],
  ['Al Sahel Exchange House', 'LY'],
  ['Northern Star Logistics LLC', 'RU'],
];
const VESSELS = ['MV OCEAN PEARL', 'MV KAPITAN ORLOV', 'MT SEA HARMONY'];

function watchEntry(ctx, fields) {
  const listed = withTime(daysAgo(between(60, 3000)));
  const row = {
    id: uuid(),
    list: 'EU',
    name: null,
    aliases: null,
    country: null,
    date_of_birth: null,
    entity_type: 'PERSON',
    regime: null,
    source_entry_id: `${fields.list || 'EU'}-${between(10000, 99999)}`,
    listed_at: iso(listed),
    delisted_at: null,
    updated_at: iso(later(listed, withTime(daysAgo(between(1, 400))))),
    ...fields,
  };
  ctx.rows.watchlist_entries.push(row);

  return row;
}

function screeningHit(ctx, fields) {
  const row = {
    id: uuid(),
    reference: null,
    individual_id: null,
    business_id: null,
    counterparty_id: null,
    transaction_id: null,
    investigation_id: null,
    reviewed_by: null,
    reviewed_at: null,
    decision_reason: null,
    ...fields,
  };
  // What matched: a sanctions list (blocks) or the PEP database (closer due diligence), and what.
  const entry = ctx.rows.watchlist_entries.find(e => e.id === row.watchlist_entry_id);
  row.hit_type = entry.list === 'PEP' ? 'PEP' : 'SANCTIONS';
  row.entity_type = entry.entity_type;
  ctx.rows.screening_hits.push(row);
  const steps = [
    [
      'OPEN',
      toDate(row.created_at),
      'system',
      `Screening ${row.trigger.toLowerCase().replace(/_/g, ' ')}`,
    ],
  ];

  if (row.status !== 'OPEN') {
    steps.push([row.status, toDate(row.reviewed_at), row.reviewed_by, row.decision_reason]);
  }

  trail(ctx.rows, 'SCREENING_HITS', row, steps);

  return row;
}

/** Sanctions lists, PEP entries for our politicians, and the hits screening raised. */
function screening(ctx) {
  const { rows } = ctx;
  REGIMES.forEach(([list, regime, country, name]) =>
    watchEntry(ctx, {
      list,
      regime,
      name,
      country,
      date_of_birth: isoDate(daysAgo(between(40, 75) * 365)),
      aliases: name.split(' ').reverse().join(' '),
    }),
  );
  const regimeOf = country =>
    REGIMES.find(r => r[2] === country) || ['UN', 'Libya (Resolution 1970)'];
  LISTED_ENTITIES.forEach(([name, country]) =>
    watchEntry(ctx, {
      list: regimeOf(country)[0],
      regime: regimeOf(country)[1],
      name,
      country,
      entity_type: 'ENTITY',
    }),
  );
  VESSELS.forEach(name =>
    watchEntry(ctx, {
      list: 'OFAC',
      regime: 'Iran (IRAN-EO13902)',
      name,
      entity_type: 'VESSEL',
      country: 'IR',
    }),
  );
  watchEntry(ctx, {
    list: 'EU',
    regime: 'Russia (Regulation 269/2014)',
    name: 'Smolensk Aviation Services',
    entity_type: 'AIRCRAFT',
    country: 'RU',
    delisted_at: iso(withTime(daysAgo(between(20, 200)))),
  });
  const sanctioned = watchEntry(ctx, {
    list: 'EU',
    regime: 'Russia (Regulation 269/2014)',
    name: SANCTIONED.name,
    aliases: 'VMT LLC; Volga Maritime',
    country: 'RU',
    entity_type: 'ENTITY',
    listed_at: iso(withTime(daysAgo(between(30, 90)))),
  });

  // Our politically exposed people are on the PEP list: true matches, checked at onboarding.
  rows.individuals
    .filter(p => p.is_pep)
    .forEach(p => {
      const entry = watchEntry(ctx, {
        list: 'PEP',
        regime: pick([
          'Domestic PEP: member of parliament',
          'Domestic PEP: mayor',
          'Domestic PEP: senior civil servant',
        ]),
        name: `${p.first_name} ${p.last_name}`,
        country: p.nationality,
        date_of_birth: p.date_of_birth,
        source_entry_id: `PEP-${between(100000, 999999)}`,
      });
      const created = at(toDate(p.created_at), 0.05);
      screeningHit(ctx, {
        individual_id: p.id,
        watchlist_entry_id: entry.id,
        screened_name: `${p.first_name} ${p.last_name}`,
        trigger: 'ONBOARDING',
        match_score: round2(97 + rand() * 3),
        matched_on: 'Name, date of birth, nationality',
        status: 'TRUE_MATCH',
        created_at: iso(created),
        reviewed_by: op('l2'),
        reviewed_at: iso(at(created, 20)),
        decision_reason: 'Confirmed PEP: enhanced due diligence and yearly review',
      });
    });

  // Customers with the name of someone on a terrorism list (homonyms): false positives once the
  // date of birth is compared, and a few still open.
  const people = rows.individuals
    .filter(p => !p.is_pep && (ctx.customersOf.get(p.id) || []).length)
    .sort(() => rand() - 0.5)
    .slice(0, 28);
  people.forEach((p, k) => {
    const [list, regime] = pick(TERRORISM);
    const entry = watchEntry(ctx, {
      list,
      regime,
      name: `${p.first_name} ${p.last_name}`,
      country: pick(['FR', 'BE', 'DE', 'MA', 'TN', 'SY']),
      date_of_birth: isoDate(daysAgo(between(30, 80) * 365)),
    });
    const open = k < 6;
    const created = open
      ? past(withTime(daysAgo(between(0, 8))))
      : later(withTime(daysAgo(between(10, 170))), toDate(p.created_at));
    screeningHit(ctx, {
      individual_id: p.id,
      watchlist_entry_id: entry.id,
      screened_name: `${p.first_name} ${p.last_name}`,
      trigger: open
        ? pick(['DAILY_RESCREENING', 'LIST_UPDATE'])
        : pick(['ONBOARDING', 'DAILY_RESCREENING', 'LIST_UPDATE']),
      match_score: round2(86 + rand() * 10),
      matched_on: 'Full name',
      status: open ? 'OPEN' : 'FALSE_POSITIVE',
      created_at: iso(created),
      reviewed_by: open ? null : op('l1'),
      reviewed_at: open ? null : iso(past(at(created, between(1, 40)))),
      decision_reason: open
        ? null
        : pick([
            'Homonym: different date of birth and nationality',
            'Homonym: different date and place of birth',
            'Name match only: date of birth differs by more than 20 years',
          ]),
    });
  });

  // Companies whose name is close to a listed entity: checked at onboarding, false positives.
  rows.businesses
    .filter(b => rows.customers.some(c => c.business_id === b.id))
    .sort(() => rand() - 0.5)
    .slice(0, 4)
    .forEach(b => {
      const words = b.legal_name.split(' ');
      const [list, regime, country] = pick(REGIMES);
      const entry = watchEntry(ctx, {
        list,
        regime,
        name: `${words[0]} ${pick(['Trading', 'Import Export', 'Holding'])} LLC`,
        country,
        entity_type: 'ENTITY',
      });
      const created = at(toDate(rows.customers.find(c => c.business_id === b.id).created_at), 0.1);
      screeningHit(ctx, {
        business_id: b.id,
        watchlist_entry_id: entry.id,
        screened_name: b.legal_name,
        trigger: 'ONBOARDING',
        match_score: round2(72 + rand() * 12),
        matched_on: 'Name',
        status: 'FALSE_POSITIVE',
        created_at: iso(created),
        reviewed_by: op('l1'),
        reviewed_at: iso(past(at(created, between(2, 30)))),
        decision_reason: 'Different country, registration number and activity',
      });
    });

  // A company on the EU list screened on a payment: the transfer is held until someone decides.
  ctx.stories.forEach(story => {
    if (story.kind !== 'SANCTIONS') return;
    const line = story.lines[0];
    screeningHit(ctx, {
      counterparty_id: story.payee.party.id,
      transaction_id: line.tx.id,
      watchlist_entry_id: sanctioned.id,
      screened_name: SANCTIONED.name,
      trigger: 'PAYMENT',
      match_score: 96.5,
      matched_on: 'Name, country of the beneficiary bank',
      status: 'OPEN',
      created_at: iso(at(toDate(line.tx.created_at), 0.01)),
    });
  });
}

// ---- rules, alerts, investigations, SARs ------------------------------------------------------

const RULES: [string, string, string, string, number, string][] = [
  [
    'AML-001',
    'AML',
    'MULE_PATTERN',
    'Money in from several new payers, out abroad within 24 hours',
    3,
    'HIGH',
  ],
  [
    'AML-002',
    'AML',
    'RAPID_MOVEMENT',
    'Over 80% of an incoming amount leaves within 48 hours',
    0.8,
    'MEDIUM',
  ],
  [
    'AML-003',
    'AML',
    'UNUSUAL_VOLUME',
    'Monthly incoming amount above twice the declared income',
    2,
    'MEDIUM',
  ],
  [
    'AML-004',
    'AML',
    'STRUCTURING',
    'Three or more transfers between 9,000 and 10,000 EUR within 7 days',
    9000,
    'HIGH',
  ],
  [
    'AML-005',
    'AML',
    'HIGH_RISK_COUNTRY',
    'Transfer to a jurisdiction on the high-risk list',
    1000,
    'MEDIUM',
  ],
  [
    'AML-006',
    'AML',
    'SANCTIONS_MATCH',
    'Counterparty close to a sanctions list entry',
    85,
    'CRITICAL',
  ],
  [
    'AML-007',
    'AML',
    'SUSPICIOUS_PATTERN',
    'Cash-like pattern inconsistent with the customer profile',
    3,
    'LOW',
  ],
  [
    'FRD-001',
    'FRAUD',
    'CARD_TESTING',
    'Five or more online card payments under 5 EUR within an hour',
    5,
    'HIGH',
  ],
  [
    'FRD-002',
    'FRAUD',
    'UNUSUAL_CARD_SPEND',
    'Card payment above four times the customer’s usual basket (150 EUR at least)',
    4,
    'MEDIUM',
  ],
  [
    'FRD-003',
    'FRAUD',
    'INCOMING_FRAUD_RECALL',
    'Recall received for an incoming transfer flagged as fraud',
    1,
    'HIGH',
  ],
  [
    'FRD-004',
    'FRAUD',
    'REPEATED_DISPUTES',
    'Three payment disputes or more by the same customer, on different days, within six months',
    3,
    'MEDIUM',
  ],
  [
    'FRD-005',
    'FRAUD',
    'INVOICE_IBAN_CHANGE',
    'A supplier invoice asks to be paid to another IBAN than the one we know for that supplier',
    1,
    'HIGH',
  ],
  [
    'ATO-001',
    'ACCOUNT_TAKEOVER',
    'NEW_DEVICE_NEW_PAYEE',
    'New device and new payee, then a transfer within an hour',
    60,
    'CRITICAL',
  ],
  [
    'ATO-002',
    'ACCOUNT_TAKEOVER',
    'IMPOSSIBLE_TRAVEL',
    'Two logins from countries too far apart for the time between them',
    500,
    'MEDIUM',
  ],
];

function rules(ctx) {
  ctx.rules = new Map();
  RULES.forEach(([code, category, type, description, threshold, severity]) => {
    const created = withTime(daysAgo(between(500, 1500)));
    const updated = withTime(daysAgo(between(10, 300)));
    const row = {
      id: uuid(),
      code,
      category,
      name: (type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, ' ')).replace(
        /\biban\b/,
        'IBAN',
      ),
      description,
      threshold,
      default_severity: severity,
      is_active: type !== 'SUSPICIOUS_PATTERN',
      created_by: op('l2'),
      created_at: iso(created),
      updated_by: op('l2'),
      updated_at: iso(updated),
    };
    ctx.rows.rules.push(row);
    ctx.rules.set(type, row);
  });
}

const CLEARANCE_NOTES = {
  FALSE_POSITIVE: [
    'Checked with the customer: legitimate payment.',
    'Amounts consistent with past months.',
    'Known counterparty, regular activity.',
  ],
  EXPLAINED_BY_PROFILE: [
    'Bonus paid in the month, confirmed by the payslip.',
    'Sale of a car, invoice provided.',
    'Business imports from this supplier every quarter.',
  ],
  DUPLICATE: ['Same activity as the alert already reviewed this week.'],
  ALREADY_INVESTIGATED: ['Covered by the open investigation on this customer.'],
};

const ALERT_STATUS = { OPEN: 'OPEN', IN_REVIEW: 'IN_REVIEW', CLEARED: 'CLEARED' };

/** What the reviewer wrote: why it was cleared, or that it went to an investigation. */
function resolutionNotes(status, clearance, note) {
  if (status === 'CLEARED') return note || pick(CLEARANCE_NOTES[clearance || 'FALSE_POSITIVE']);
  if (status === 'ESCALATED') return note || 'Escalated to an investigation.';

  return null;
}

/**
 * Who raised an alert: a rule (most of them), or an operator by hand, with no rule (a customer
 * report, a doubt): manual = { by, category, why }.
 */
function raisedBy(ctx, type, manual) {
  if (manual) {
    const { by, category, why } = manual;

    return { category, severity: 'HIGH', source: 'MANUAL', by, why, ruleId: null };
  }

  const rule = ctx.rules.get(type);
  const { category, default_severity: severity } = rule;

  return { category, severity, source: 'RULE', by: 'system', why: rule.code, ruleId: rule.id };
}

/** The transactions behind an alert: the trigger and its context, or what the customer reported. */
function alertLines(ctx, row, lines, triggered) {
  lines
    .filter(tx => toDate(tx.created_at) <= triggered)
    .forEach((tx, k) => {
      let role = k === 0 ? 'TRIGGER' : 'CONTEXT';
      if (row.source === 'MANUAL') role = 'REPORTED';
      ctx.rows.alert_transactions.push({ alert_id: row.id, transaction_id: tx.id, role });
    });
}

/** An alert on a customer, its lines and its history. `outcome` decides how far it went. */
function alert(
  ctx,
  {
    type,
    customer,
    triggered,
    lines,
    outcome,
    score,
    loginEvent,
    clearance,
    note,
    manual,
  }: Record<string, any>,
) {
  const raised = raisedBy(ctx, type, manual);
  const status = ALERT_STATUS[outcome] || 'ESCALATED';
  const reviewer = status === 'OPEN' ? null : op('l1');
  const reviewed = status === 'OPEN' ? null : past(at(triggered, between(2, 50)));
  const cleared = status === 'CLEARED';
  const row = {
    id: uuid(),
    reference: null,
    alert_type: type,
    category: raised.category,
    rule_id: raised.ruleId,
    source: raised.source,
    created_by: raised.by,
    customer_id: customer.id,
    login_event_id: loginEvent?.id || null,
    investigation_id: null,
    severity: score >= 90 ? 'CRITICAL' : raised.severity,
    score: score ?? null,
    status,
    triggered_at: iso(triggered),
    assigned_to: reviewer,
    reviewed_by: status === 'IN_REVIEW' ? null : reviewer,
    escalated_at: status === 'ESCALATED' ? iso(reviewed) : null,
    resolved_at: cleared ? iso(reviewed) : null,
    clearance_reason: cleared ? clearance || 'FALSE_POSITIVE' : null,
    resolution_notes: resolutionNotes(status, clearance, note),
  };
  ctx.rows.alerts.push(row);
  alertLines(ctx, row, lines, triggered);
  const steps = [['OPEN', triggered, raised.by, raised.why]];
  if (status !== 'OPEN') steps.push(['IN_REVIEW', at(triggered, 1), reviewer]);

  if (cleared || status === 'ESCALATED') {
    steps.push([status, reviewed, reviewer, row.resolution_notes]);
  }

  trail(ctx.rows, 'ALERTS', row, steps);

  return row;
}

const SUMMARIES = {
  MULE: 'Several unrelated people paid this young customer for goods or rentals; each amount left within hours by instant transfer to the same accounts abroad. Pattern of a money mule recruited online.',
  SPLIT:
    'A large sum from a notary was moved out in transfers just under the 10,000 EUR validation threshold, to a payee added the same day.',
  TAKEOVER:
    'Login from a new device abroad after an MFA reset, phone number change requested, new payee added and an instant transfer of most of the balance. The customer confirmed they did not make it.',
  CARD_TESTING:
    'Burst of tiny online payments at dubious merchants, then a larger purchase: the card number was being tested. Card blocked and replaced.',
  FRAUD:
    'Customer reported card payments they do not recognise: card blocked, account frozen while the payments are reviewed, then refunded as unauthorised.',
  AML: 'Internal referral from the relationship manager: activity no longer matches the declared profile.',
  IDENTITY:
    'Onboarding escalated: the ID passed the automated check but the selfie and the address do not hold together. Suspected identity fraud.',
};

const sumOf = lines => round2(lines.reduce((sum, tx) => sum + Number(tx.amount), 0));

function sar(ctx, inv, lines, date, filed) {
  const dates = lines.map(tx => tx.created_at.slice(0, 10)).sort();
  const [from, to] = [dates[0], dates[dates.length - 1]];
  const total = sumOf(lines);
  const acknowledged =
    filed && NOW.getTime() - date > 20 * DAY ? past(at(date, between(24, 240))) : null;
  let status = filed ? 'SUBMITTED' : 'DRAFT';
  if (acknowledged) status = 'ACKNOWLEDGED';
  const amount = total.toLocaleString('fr-FR');
  const row = {
    id: uuid(),
    reference: null,
    customer_id: inv.customer_id,
    investigation_id: inv.id,
    activity_type: 'RAPID_MOVEMENT',
    activity_start_date: from,
    activity_end_date: to,
    total_amount: total,
    transaction_count: lines.length,
    currency: 'EUR',
    narrative: `${inv.summary} ${lines.length} transactions between ${from} and ${to}, ${amount} EUR in total.`,
    status,
    created_at: iso(at(date, -30)),
    filed_at: filed ? iso(date) : null,
    filed_by: filed ? mail(TEAM.mlro[0]) : null,
    fiu_reference: acknowledged
      ? `TRACFIN-${acknowledged.getUTCFullYear()}-${between(100000, 999999)}`
      : null,
    acknowledged_at: acknowledged ? iso(acknowledged) : null,
    updated_at: iso(acknowledged || date),
  };
  ctx.rows.sar_reports.push(row);
  const steps = [['DRAFT', at(date, -30), inv.assigned_to]];
  if (filed) steps.push(['SUBMITTED', date, row.filed_by]);
  if (acknowledged) steps.push(['ACKNOWLEDGED', acknowledged, 'TRACFIN']);
  trail(ctx.rows, 'SAR_REPORTS', row, steps);
}

const INVESTIGATION_TOPICS = { AML: 'SOURCE_OF_FUNDS', FRAUD: 'UNRECOGNISED_PAYMENTS' };

/**
 * The question an analyst sends the customer: waiting for the answer now, or answered before the
 * case moved on (only when there was time to answer).
 */
function investigationQuestion(ctx, inv, customer, opened, movedOn) {
  const topic = INVESTIGATION_TOPICS[inv.type];
  const person = ctx.holderOf(customer);
  if (!topic || !person) return null;
  const sent = past(at(opened, 50));

  if (inv.status === 'WAITING_INFORMATION') {
    const status = NOW.getTime() - sent > 7 * DAY ? 'OVERDUE' : 'SENT';

    return informationRequest(ctx, inv, person, sent, status, topic, 'INVESTIGATION');
  }

  const room = (movedOn || NOW) - sent > 7 * DAY;
  if (inv.status === 'OPEN' || !room || !chance(0.6)) return null;

  return informationRequest(ctx, inv, person, sent, 'ANSWERED', topic, 'INVESTIGATION');
}

/** When a case went to the MLRO: waiting for sign-off now, or two days before the SAR. */
function mlroDate(status, decision, opened, decided) {
  if (status === 'PENDING_MLRO') return past(at(opened, between(5, 15) * 24));
  if (decision === 'SAR_FILED') return at(decided, -48);

  return null;
}

function investigationSteps(row, opened, toMlro, decided, rfi) {
  const { status, assigned_to: owner } = row;
  const steps = [['OPEN', opened, owner]];
  if (status !== 'OPEN') steps.push(['IN_PROGRESS', past(at(opened, 4)), owner]);

  if (rfi) {
    const why = 'Request for information sent to the customer';
    steps.push(['WAITING_INFORMATION', toDate(rfi.sent_at), owner, why]);

    if (rfi.answered_at) {
      steps.push(['IN_PROGRESS', toDate(rfi.answered_at), owner, 'Customer answered']);
    }
  }

  if (toMlro) steps.push(['PENDING_MLRO', toMlro, owner]);
  if (decided) steps.push(['CLOSED', decided, row.decided_by, row.decision]);

  return steps;
}

const patternNote = tx =>
  tx.direction === 'CREDIT'
    ? 'Money in from a payer with no prior link to the customer'
    : 'Money out, part of the pattern';

/** An investigation with its transactions, its history and, when filed, its SAR. */
function investigation(ctx, fields) {
  const { customer, type, origin, opened, status, decision, lines, summary, priority } = fields;
  const owner = op('l2');
  const decided = decision ? past(at(opened, between(10, 30) * 24)) : null;
  const toMlro = mlroDate(status, decision, opened, decided);
  const reported = decision === 'SAR_FILED' || status === 'PENDING_MLRO';
  let decidedBy = decision ? owner : null;
  if (decision === 'SAR_FILED') decidedBy = mail(TEAM.mlro[0]);
  const row = {
    id: uuid(),
    reference: null,
    customer_id: customer.id,
    type,
    origin,
    origin_kyc_case_id: fields.originKycCase?.id || null,
    origin_authority_request_id: null,
    status: decision ? 'CLOSED' : status,
    assigned_to: owner,
    opened_at: iso(opened),
    due_at: iso(new Date(opened.getTime() + 30 * DAY)),
    summary,
    decision: decision || null,
    decided_by: decidedBy,
    decided_at: decided ? iso(decided) : null,
    sent_to_mlro_at: toMlro ? iso(toMlro) : null,
    amount_involved: sumOf(lines) || fields.amount || null,
    priority,
  };
  ctx.rows.investigations.push(row);
  ctx.investigations.push(row);
  const rfi = fields.quiet
    ? null
    : investigationQuestion(ctx, row, customer, opened, toMlro || decided);
  lines.forEach(tx =>
    ctx.rows.investigation_transactions.push({
      investigation_id: row.id,
      transaction_id: tx.id,
      included_in_sar: reported,
      note: fields.lineNote || patternNote(tx),
      added_by: owner,
      added_at: iso(past(at(opened, between(1, 72)))),
    }),
  );
  trail(ctx.rows, 'INVESTIGATIONS', row, investigationSteps(row, opened, toMlro, decided, rfi));
  if (reported) sar(ctx, row, lines, decided || toMlro, decision === 'SAR_FILED');

  return row;
}

/** A counterparty the bank won't pay any more. */
function block(party, date, reason) {
  Object.assign(party, {
    is_blocked: true,
    blocked_at: iso(date),
    block_reason: reason,
    risk_level: 'HIGH',
  });
}

const linesOf = (story, roles?) =>
  story.lines.filter(l => !roles || roles.includes(l.event.role)).map(l => l.tx);
// The transaction that set the rule off first, then the rest of the story as context.
const triggerFirst = (trigger, all) => [trigger, ...all.filter(tx => tx !== trigger)];

/** Escalate a story's alert into an investigation of the story's transactions. */
function escalate(ctx, story, a, fields) {
  const inv = investigation(ctx, {
    customer: story.customer,
    origin: 'ALERTS',
    opened: toDate(a.escalated_at),
    lines: linesOf(story),
    ...fields,
  });
  a.investigation_id = inv.id;

  return inv;
}

const STORY_CASES = {
  /** Mule: escalated, investigated, and the oldest reported to TRACFIN. */
  MULE(ctx, story, all, parties) {
    const outs = all.filter(tx => tx.direction === 'DEBIT');
    const escalated = ['SAR_FILED', 'PENDING_MLRO', 'IN_PROGRESS'].includes(story.outcome);
    const filed = story.outcome === 'SAR_FILED';
    const a = alert(ctx, {
      type: 'MULE_PATTERN',
      customer: story.customer,
      triggered: at(toDate(outs[1].created_at), 0.5),
      lines: triggerFirst(outs[0], all),
      outcome: escalated ? 'ESCALATED' : story.outcome,
      score: round2(86 + rand() * 12),
    });
    if (!escalated) return;
    const inv = escalate(ctx, story, a, {
      type: 'AML',
      status: filed ? 'PENDING_MLRO' : story.outcome,
      decision: filed ? 'SAR_FILED' : null,
      summary: SUMMARIES.MULE,
      priority: 'HIGH',
    });
    story.investigation = inv;
    if (!filed) return;
    story.payees.forEach(p =>
      block(parties.get(p.party.id), toDate(inv.decided_at), 'Mule collector account: SAR filed'),
    );
  },
  /** Split payments: the third transfer under the threshold sets the rule off. */
  SPLIT(ctx, story, all) {
    const splits = linesOf(story, ['SPLIT_OUT']);
    const last = splits[splits.length - 1];
    const escalated = story.outcome === 'IN_PROGRESS';
    const a = alert(ctx, {
      type: 'STRUCTURING',
      customer: story.customer,
      triggered: at(toDate((splits[2] || last).created_at), 0.3),
      lines: triggerFirst(splits[2] || last, all),
      outcome: escalated ? 'ESCALATED' : 'OPEN',
      score: round2(80 + rand() * 10),
    });

    if (escalated) {
      const fields = { type: 'AML', status: 'WAITING_INFORMATION', summary: SUMMARIES.SPLIT };
      escalate(ctx, story, a, { ...fields, priority: 'MEDIUM' });
    }
  },
  /** Takeover: the oldest was confirmed by the customer and the mule's account blocked. */
  TAKEOVER(ctx, story, all, parties) {
    const closed = story.outcome === 'CLOSED';
    const a = alert(ctx, {
      type: 'NEW_DEVICE_NEW_PAYEE',
      customer: story.customer,
      triggered: at(story.when, 0.01),
      lines: all,
      outcome: closed ? 'ESCALATED' : story.outcome,
      score: round2(91 + rand() * 8),
      loginEvent: story.login,
    });
    if (!closed) return;
    const fields = { type: 'ACCOUNT_TAKEOVER', status: 'IN_PROGRESS', decision: 'NO_SAR' };
    escalate(ctx, story, a, { ...fields, summary: SUMMARIES.TAKEOVER, priority: 'URGENT' });
    const why = 'Received money from an account takeover';
    block(parties.get(story.payee.party.id), toDate(a.escalated_at), why);
  },
  /** Card testing: the fifth tiny payment sets the rule off. */
  CARD_TESTING(ctx, story, all) {
    const closed = story.outcome === 'CLOSED';
    const fifth = linesOf(story, ['TEST_PAYMENT'])[4];
    const a = alert(ctx, {
      type: 'CARD_TESTING',
      customer: story.customer,
      triggered: at(toDate(fifth.created_at), 0.05),
      lines: triggerFirst(fifth, all),
      outcome: closed ? 'ESCALATED' : 'OPEN',
      score: round2(84 + rand() * 10),
    });

    if (closed) {
      const fields = { type: 'FRAUD', status: 'IN_PROGRESS', decision: 'NO_SAR' };
      escalate(ctx, story, a, { ...fields, summary: SUMMARIES.CARD_TESTING, priority: 'MEDIUM' });
    }
  },
  /** High-risk country: one explained by the business, one waiting for review. */
  HIGH_RISK(ctx, story) {
    const out = linesOf(story, ['HIGH_RISK_OUT']);
    alert(ctx, {
      type: 'HIGH_RISK_COUNTRY',
      customer: story.customer,
      triggered: at(toDate(out[0].created_at), 0.2),
      lines: out,
      outcome: story.outcome,
      score: round2(62 + rand() * 15),
      clearance: 'EXPLAINED_BY_PROFILE',
      note: 'Business imports from this supplier every quarter; invoice and bill of lading provided.',
    });
  },
  // The sanctions story is a screening hit (screening()), not an alert.
  SANCTIONS: () => undefined,
};

/** Alerts and cases for each story of stories.js. */
function storyCases(ctx) {
  const parties = new Map(ctx.rows.counterparties.map(p => [p.id, p]));
  ctx.stories.forEach(story => {
    const all = linesOf(story);
    if (all.length) STORY_CASES[story.kind](ctx, story, all, parties);
  });
}

/** Everyday activity the rules flag: income spikes, big card payments, logins abroad. */
function backgroundAlerts(ctx) {
  const { rows } = ctx;
  const storyCustomers = new Set(ctx.stories.keys());
  const byAccount = new Map();
  rows.transactions.forEach(tx => {
    if (tx.status !== 'BOOKED') return;
    if (!byAccount.has(tx.account_id)) byAccount.set(tx.account_id, []);
    byAccount.get(tx.account_id).push(tx);
  });

  const outcome = triggered => {
    const age = (NOW.getTime() - triggered) / DAY;
    if (age < 4) return chance(0.7) ? 'OPEN' : 'IN_REVIEW';

    if (age < 8) {
      return weighted([
        ['OPEN', 3],
        ['IN_REVIEW', 3],
        ['CLEARED', 4],
      ]);
    }

    return chance(0.04) ? 'ESCALATED' : 'CLEARED';
  };

  rows.accounts
    .filter(a => a.type !== 'SAVINGS')
    .forEach(account => {
      const customer = ctx.customers.get(account.customer_id);
      if (storyCustomers.has(customer.id)) return;
      const lines = byAccount.get(account.id) || [];
      const months = new Map();
      lines
        .filter(tx => tx.direction === 'CREDIT')
        .forEach(tx => {
          const key = tx.booked_at.slice(0, 7);
          if (!months.has(key)) months.set(key, []);
          months.get(key).push(tx);
        });
      months.forEach(credits => {
        const total = credits.reduce((sum, tx) => sum + Number(tx.amount), 0);
        if (total < 1.6 * Number(customer.expected_monthly_in) || total < 4000) return;
        const top = credits.slice().sort((x, y) => y.amount - x.amount);
        const triggered = past(at(toDate(top[0].booked_at), between(2, 20)));
        const result = outcome(triggered);
        const a = alert(ctx, {
          type: 'UNUSUAL_VOLUME',
          customer,
          triggered,
          lines: top.slice(0, 4),
          outcome: result,
          score: round2(45 + rand() * 30),
          clearance: pick(['EXPLAINED_BY_PROFILE', 'FALSE_POSITIVE']),
        });

        if (result === 'ESCALATED') {
          a.investigation_id = investigation(ctx, {
            customer,
            type: 'AML',
            origin: 'ALERTS',
            opened: toDate(a.escalated_at),
            status: 'IN_PROGRESS',
            decision: 'NO_SAR',
            lines: top.slice(0, 4),
            summary: 'Income spike reviewed: inheritance paid by a notary, documents provided.',
            priority: 'LOW',
          }).id;
        }
      });
      const cards = lines.filter(tx => tx.rail === 'CARD');
      if (cards.length < 10) return;
      const usual = cards.map(tx => Number(tx.amount)).sort((x, y) => x - y)[
        Math.floor(cards.length / 2)
      ];
      cards
        .filter(tx => Number(tx.amount) > Math.max(400, 6 * usual))
        .filter(() => chance(0.12))
        .forEach(tx => {
          const triggered = past(at(toDate(tx.created_at), 0.01));
          const result = outcome(triggered);
          alert(ctx, {
            type: 'UNUSUAL_CARD_SPEND',
            customer,
            triggered,
            lines: [tx],
            outcome: result === 'ESCALATED' ? 'CLEARED' : result,
            score: round2(40 + rand() * 30),
            clearance: 'FALSE_POSITIVE',
            note: 'Customer confirmed the purchase in the app.',
          });
        });
    });
  (ctx.trips || []).forEach(({ person, login: trip }) => {
    const customerId = (ctx.customersOf.get(person.id) || [])[0];
    const customer = ctx.customers.get(customerId);
    if (!customer || storyCustomers.has(customer.id) || !chance(0.6)) return;
    // The alert goes to a customer the person banks with today, not one still in onboarding.
    const active = (ctx.customersOf.get(person.id) || [])
      .map(id => ctx.customers.get(id))
      .find(c => c.status === 'ACTIVE' && !storyCustomers.has(c.id));
    if (!active) return;
    const triggered = at(toDate(trip.created_at), 0.01);
    const result = outcome(triggered);
    alert(ctx, {
      type: 'IMPOSSIBLE_TRAVEL',
      customer: active,
      triggered,
      lines: [],
      outcome: result === 'ESCALATED' ? 'CLEARED' : result,
      score: round2(30 + rand() * 25),
      loginEvent: trip,
      clearance: 'FALSE_POSITIVE',
      note: `Customer on holiday in ${trip.city}, confirmed by app notification.`,
    });
  });
}

// Fraud: the last card purchases the customer disputes. AML: the largest recent movements.
const reportedLines = (recent, cash) =>
  recent.filter(tx => tx.rail === 'CARD' && !cash.has(tx.id)).slice(-3);
const largestLines = recent =>
  recent
    .slice(-60)
    .sort((x, y) => y.amount - x.amount)
    .slice(0, 5)
    .sort((x, y) => (x.created_at < y.created_at ? -1 : 1));

/**
 * The customer calls about payments they did not make; the agent on the phone raises an alert,
 * and the account is frozen right after the call, to protect it while we check.
 */
function victimReport(ctx, customer, lines, frozen) {
  const last = toDate(lines[lines.length - 1].created_at);
  const triggered = later(earlier(at(last, between(6, 30)), at(frozen, -1)), at(last, 0.5));
  const why = 'Customer called: does not recognise these card payments';

  return alert(ctx, {
    type: 'CUSTOMER_REPORT',
    customer,
    triggered,
    lines,
    outcome: 'ESCALATED',
    manual: { by: op('l1'), category: 'FRAUD', why },
  });
}

/** The card a fraudster used is blocked as compromised; a settled victim gets the account back. */
function victimCards(ctx, account, settled) {
  ctx.rows.cards
    .filter(c => c.account_id === account.id && c.blocked_reason === 'AML_FREEZE')
    .forEach(c => {
      c.blocked_reason = 'FRAUD';
    });

  if (settled) {
    Object.assign(account, {
      status: 'ACTIVE',
      frozen_at: null,
      freeze_reason: null,
      freeze_note: null,
    });
  }
}

/** Accounts frozen for fraud or AML without a story still need the case behind the freeze. */
function freezeCases(ctx) {
  const { rows } = ctx;
  const covered = new Set(ctx.investigations.map(i => i.customer_id));
  // Cash taken with the PIN cannot be charged back: customers report card purchases.
  const cash = new Set(
    rows.card_transactions.filter(c => c.type === 'ATM_WITHDRAWAL').map(c => c.transaction_id),
  );
  const lastLines = new Map();
  rows.transactions.forEach(tx => {
    if (!lastLines.has(tx.account_id)) lastLines.set(tx.account_id, []);
    lastLines.get(tx.account_id).push(tx);
  });
  rows.accounts
    .filter(
      a =>
        a.status === 'FROZEN' && ['AML_INVESTIGATION', 'FRAUD_SUSPICION'].includes(a.freeze_reason),
    )
    .forEach(account => {
      const customer = ctx.customers.get(account.customer_id);
      if (covered.has(customer.id)) return;
      covered.add(customer.id);
      const frozen = toDate(account.frozen_at);
      const fraud = account.freeze_reason === 'FRAUD_SUSPICION';
      const recent = (lastLines.get(account.id) || []).filter(
        tx => tx.status === 'BOOKED' && tx.rail !== 'FEE',
      );
      const lines = fraud ? reportedLines(recent, cash) : largestLines(recent);
      const opened = at(frozen, -2);
      const status = pick(['IN_PROGRESS', 'WAITING_INFORMATION', 'IN_PROGRESS']);
      let origin = 'INTERNAL_REFERRAL';
      let a = null;

      if (fraud && lines.length) {
        a = victimReport(ctx, customer, lines, frozen);
        origin = 'CUSTOMER_REPORT';
      }

      const start = a ? toDate(a.escalated_at) : opened;
      // A victim's case closes once the payments are refunded (disputes.js), after about two weeks.
      const settled = Boolean(a) && NOW.getTime() - start.getTime() > 14 * DAY;
      const inv = investigation(ctx, {
        customer,
        type: fraud ? 'FRAUD' : 'AML',
        origin,
        opened: start,
        status,
        decision: settled ? 'GENUINE_FRAUD' : undefined,
        lines,
        summary: fraud ? SUMMARIES.FRAUD : SUMMARIES.AML,
        priority: fraud ? 'HIGH' : 'MEDIUM',
      });
      if (a) a.investigation_id = inv.id;
      if (fraud) victimCards(ctx, account, settled);
    });
}

/** One onboarding escalated for suspected identity fraud became an investigation. */
function identityCase(ctx) {
  const escalated = ctx.rows.kyc_cases.find(
    k => k.type === 'ONBOARDING' && k.status === 'ESCALATED',
  );
  if (!escalated) return;
  const customer = ctx.customers.get(escalated.customer_id);
  const inv = investigation(ctx, {
    customer,
    type: 'IDENTITY_FRAUD',
    origin: 'KYC_ESCALATION',
    originKycCase: escalated,
    opened: at(toDate(escalated.escalated_at), 3),
    status: 'OPEN',
    lines: [],
    summary: SUMMARIES.IDENTITY,
    priority: 'HIGH',
  });
  inv.opened_at = iso(past(toDate(inv.opened_at)));
}

/** Reviews opened because of an investigation: the customer's file is checked again. */
function remediationReviews(ctx) {
  ctx.investigations
    .filter(i => !i.decision && i.type === 'AML')
    .forEach(inv => {
      const customer = ctx.customers.get(inv.customer_id);
      const opened = past(at(toDate(inv.opened_at), 24));
      const by = op('l2');
      const row = kycCase(ctx, customer, {
        type: 'REMEDIATION',
        trigger: 'AML_INVESTIGATION',
        channel: customer.onboarding_channel,
        status: 'IN_REVIEW',
        opened_at: iso(opened),
        due_at: iso(new Date(opened.getTime() + 30 * DAY)),
        assigned_to: by,
        risk_before: customer.risk_rating,
        investigation_id: inv.id,
      });
      trail(ctx.rows, 'KYC_CASES', row, [
        ['OPEN', opened, by, 'Opened from the investigation'],
        ['IN_REVIEW', past(at(opened, 2)), by],
      ]);
    });
}

/** The customers' own history: onboarding, then suspension or departure. */
function customerHistory(ctx) {
  ctx.rows.customers.forEach(c => {
    const created = toDate(c.created_at);
    const steps = [['PROSPECT', created, 'customer']];

    if (c.status === 'PROSPECT') {
      trail(ctx.rows, 'CUSTOMERS', c, steps);

      return;
    }

    steps.push(['ONBOARDING', at(created, 0.1), 'customer']);

    if (c.status === 'DECLINED') {
      const [decided, by, reason] = ctx.declined.get(c.id);
      trail(ctx.rows, 'CUSTOMERS', c, [...steps, ['DECLINED', decided, by, reason]]);

      return;
    }

    if (c.onboarded_at) {
      steps.push([
        'ACTIVE',
        ctx.approvedAt.get(c.id) ||
          later(withTime(new Date(`${c.onboarded_at}T00:00:00Z`)), at(created, 1)),
        'system',
        'KYC approved',
      ]);
    }

    if (c.status === 'SUSPENDED') {
      steps.push([
        'SUSPENDED',
        toDate(c.updated_at),
        op('l2'),
        'Accounts frozen pending investigation',
      ]);
    }

    if (c.status === 'OFFBOARDED') {
      steps.push(['OFFBOARDED', toDate(c.updated_at), op('onboarding'), 'Relationship closed']);
    }

    trail(ctx.rows, 'CUSTOMERS', c, steps);
  });
}

/** Story customers who were suspended: their record says when. */
function suspendedStoryCustomers(ctx) {
  ctx.stories.forEach(story => {
    if (story.customer.status !== 'SUSPENDED') return;
    story.customer.updated_at = story.investigation?.decided_at || story.customer.updated_at;
  });
}

// ---- the compliance queues: one open case per path of the guided workflows -------------------
// Written last, once every other wave (the payments desk included) has picked its customers, and
// without a single random draw: nothing else in the demo moves. Each case is pinned to a customer
// by a rule (a hash of their id, or the order they became customers), never one another story
// uses, so the same people carry the same case on every build. Screening: a real match, a
// same-year namesake, homonyms the comparison clears, payments held by screening. Investigations:
// answers that explain the activity or don't, a question not asked yet, a full KYC review.

/** A UUID v4 fixed by a seed text: new rows that are the same on every build. */
function stableId(seed) {
  const h = createHash('md5').update(`forest-lab:${seed}`).digest('hex');

  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
    20,
    32,
  )}`;
}

const hashNumber = (seed, modulo) =>
  parseInt(createHash('md5').update(String(seed)).digest('hex').slice(0, 8), 16) % modulo;

const label = code => String(code).replace(/_/g, ' ').toLowerCase();
// Investigations other waves open at random that the compliance queue moves to a fixed customer.
const MOVED = ['DISPUTE', 'AUTHORITY_REQUEST'];
// Why the identity-fraud onboarding left the onboarding queue (identityOnboarding).
const IDENTITY_ESCALATION = 'Suspected identity fraud: sent to the investigations team';

/** The next PREFIX-YEAR-NUMBER after the ones numberReferences gave out. */
function nextReference(list, prefix, date) {
  const start = `${prefix}-${date.getUTCFullYear()}-`;
  const last = Math.max(
    0,
    ...list
      .filter(r => r.reference?.startsWith(start))
      .map(r => Number(r.reference.slice(start.length))),
  );

  return `${start}${String(last + 3).padStart(6, '0')}`;
}

const nextHitReference = (rows, date) => nextReference(rows.screening_hits, 'HIT', date);

/** Removes the rows `gone` accepts, in place. */
function drop(list, gone) {
  for (let k = list.length - 1; k >= 0; k -= 1) if (gone(list[k])) list.splice(k, 1);
}

/** One more line in a record's status history, with an id fixed by the record and the step. */
function step(ctx, type, record, [from, to], when, by, reason?) {
  ctx.rows.status_changes.push({
    id: stableId(`${record.id}:${from}:${to}`),
    record_type: type,
    record_id: record.id,
    field: 'status',
    old_value: from,
    new_value: to,
    changed_by: by || 'system',
    changed_at: iso(when),
    reason: reason || null,
  });
}

/**
 * Customers a story or a guided case already uses (each wave keeps its own in ctx.reserved, or
 * they hold an investigation, a hit or a payment someone has to look at): a compliance case never
 * lands on them, so one customer carries one story. Only cases fixed on every build count, so the
 * compliance picks stay the same from one build to the next; everyday cases (a periodic review,
 * a complaint) come and go with the hour and may meet them.
 */
function busyCustomers(ctx) {
  const { rows } = ctx;
  const busy = new Set([...ctx.stories.keys(), ...(ctx.reserved || [])]);
  const add = id => id && busy.add(id);
  const ofAccount = new Map(rows.accounts.map(a => [a.id, a.customer_id]));
  // The disputed payment and the police requisition move to customers of their own (below).
  rows.investigations
    .filter(i => !(MOVED.includes(i.origin) && i.status === 'IN_PROGRESS'))
    .forEach(i => add(i.customer_id));
  rows.screening_hits
    .filter(h => h.status !== 'FALSE_POSITIVE')
    .forEach(h => {
      (ctx.customersOf.get(h.individual_id) || []).forEach(add);

      if (h.business_id) {
        rows.customers.filter(c => c.business_id === h.business_id).forEach(c => add(c.id));
      }
    });
  // Payments someone has to look at: held by a rule, or a transfer waiting for validation.
  const waiting = new Set(
    rows.outgoing_transfers
      .filter(o => o.validation_status === 'PENDING')
      .map(o => o.transaction_id),
  );
  rows.transactions
    .filter(t => t.status === 'HELD' || waiting.has(t.id))
    .forEach(t => add(ofAccount.get(t.account_id)));

  return busy;
}

// The open hits on people, by role: the real match, the namesake, then the homonyms.
const NAMESAKE_LIST = ['EU', 'Counter-terrorism (CP 931)'];
const HOMONYM_COUNTRIES = ['FR', 'BE', 'DE', 'MA', 'TN', 'SY'];

/** What the list entry and the hit say for that role, all derived from the person. */
function hitRole(person, role, created) {
  const h = hashOf(`screening-hit:${person.id}`);
  const [year, month, day] = person.date_of_birth.split('-');
  const listedLong = at(created, -(400 + (h % 2500)) * 24);
  // A list entry amended a few days before: the list update screened every customer again.
  const amended = at(created, -(24 + (h % 72)));

  if (role === 0) {
    // Newly listed this week, the same person: same date of birth and nationality.
    const listed = at(created, -(48 + (h % 72)));
    const [list, regime] =
      person.nationality === 'RU'
        ? ['EU', 'Russia (Regulation 269/2014)']
        : ['UN', 'ISIL and Al-Qaida (Resolution 1267)'];

    return {
      entry: { list, regime, date_of_birth: person.date_of_birth, country: person.nationality },
      listed,
      updated: listed,
      hit: { match_score: 98.6, matched_on: 'Full name, date of birth, nationality' },
    };
  }

  if (role === 1) {
    const other = String(((Number(month) + 4) % 12) + 1).padStart(2, '0');

    return {
      entry: {
        list: NAMESAKE_LIST[0],
        regime: NAMESAKE_LIST[1],
        date_of_birth: `${year}-${other}-${day > '28' ? '28' : day}`,
        country: person.nationality === 'TN' ? 'MA' : 'TN',
      },
      listed: listedLong,
      updated: amended,
      hit: { match_score: 91.4, matched_on: 'Full name, year of birth' },
    };
  }

  const [list, regime] = HOMONYM_LISTS[h % HOMONYM_LISTS.length];
  // Born years apart, the listed person between 25 and 80 today.
  const gap = 5 + (h % 26);
  const older = Number(year) - gap >= NOW.getUTCFullYear() - 80;
  const born = `${older ? Number(year) - gap : Number(year) + gap}-${month}-${
    month === '02' && day > '28' ? '28' : day
  }`;

  return {
    entry: {
      list,
      regime,
      date_of_birth: born,
      country: HOMONYM_COUNTRIES[Math.floor(h / 7) % HOMONYM_COUNTRIES.length],
    },
    listed: listedLong,
    updated: amended,
    hit: { match_score: round2(86 + (h % 900) / 100), matched_on: 'Full name' },
  };
}

/** Points an open hit, its list entry and its history at `person`, in the given role. */
function pinHit(ctx, hit, entry, person, role) {
  // Raised this week; the real match today (an asset freeze cannot wait).
  const hours = hashOf(`screening-hit:${person.id}`) % (role === 0 ? 20 : 140);
  const created = past(at(NOW, -(role === 0 ? 2 : 6) - hours));
  const name = `${person.first_name} ${person.last_name}`;
  const fields = hitRole(person, role, created);
  Object.assign(entry, {
    ...fields.entry,
    name,
    aliases: `${person.last_name} ${person.first_name}`,
    entity_type: 'PERSON',
    source_entry_id: `${fields.entry.list}-${10000 + hashNumber(`${person.id}:entry`, 90000)}`,
    listed_at: iso(fields.listed),
    updated_at: iso(fields.updated),
    delisted_at: null,
  });
  Object.assign(hit, {
    ...fields.hit,
    individual_id: person.id,
    screened_name: name,
    trigger: 'LIST_UPDATE',
    created_at: iso(created),
  });
  ctx.rows.status_changes
    .filter(s => s.record_id === hit.id)
    .forEach(s => Object.assign(s, { changed_at: iso(created), reason: 'Screening list update' }));
}

/**
 * The open hits screening raised on our customers this week, pinned to people no story uses (their
 * customer active, retail, with a current account; ranked by a hash of their id): the first is a
 * real match, on a list updated this week; the second a namesake born the same year; the others
 * homonyms born years apart. Applicants' hits (onboarding) stay with their onboarding.
 */
function screeningPeople(ctx, busy) {
  const { rows } = ctx;
  const entries = new Map(rows.watchlist_entries.map(e => [e.id, e]));
  const directors = new Set(rows.business_members.map(m => m.individual_id));
  const open = rows.screening_hits.filter(
    h => h.status === 'OPEN' && h.individual_id && h.trigger !== 'ONBOARDING',
  );
  const pool = rows.individuals
    .filter(p => !p.is_pep && !p.is_sanctioned && !directors.has(p.id))
    .map(person => {
      const [id, more] = ctx.customersOf.get(person.id) || [];
      const customer = !more && ctx.customers.get(id);

      return { person, customer };
    })
    .filter(
      ({ customer }) =>
        customer &&
        customer.status === 'ACTIVE' &&
        customer.customer_type === 'RETAIL' &&
        !busy.has(customer.id) &&
        (ctx.accountsOf.get(customer.id) || []).some(
          a => a.type === 'CURRENT' && a.status === 'ACTIVE',
        ),
    )
    .sort((a, b) => hashOf(`screening:${a.person.id}`) - hashOf(`screening:${b.person.id}`));
  // The real match and the namesake are 25 to 65 (as the listed people they look like); the real
  // match holds the account alone: freezing it touches nobody else.
  const age = c => NOW.getUTCFullYear() - Number(c.person.date_of_birth.slice(0, 4));
  const adult = c => age(c) >= 25 && age(c) <= 65;
  const alone = pool.find(c => adult(c) && (ctx.membersOf.get(c.customer.id) || []).length === 1);
  const namesake = pool.find(c => adult(c) && c !== alone);
  const picks = [alone, namesake, ...pool.filter(c => c !== alone && c !== namesake)]
    .filter(Boolean)
    .slice(0, open.length);
  picks.forEach(({ person, customer }, role) => {
    pinHit(ctx, open[role], entries.get(open[role].watchlist_entry_id), person, role);
    busy.add(customer.id);
  });
  // Numbered again, in the order they were raised.
  open.forEach(hit => {
    hit.reference = null;
  });
  open
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .forEach(hit => {
      hit.reference = nextHitReference(rows, toDate(hit.created_at));
    });
}

/** The onboarding escalated for identity fraud belongs to its investigation: no hit parks it. */
function identityOnboarding(ctx) {
  const { rows } = ctx;
  rows.investigations
    .filter(i => i.origin === 'KYC_ESCALATION' && i.origin_kyc_case_id)
    .forEach(inv => {
      const kyc = rows.kyc_cases.find(k => k.id === inv.origin_kyc_case_id);
      const people = new Set((ctx.membersOf.get(kyc.customer_id) || []).map(m => m.individual_id));
      const parked = rows.screening_hits.filter(
        h => h.trigger === 'ONBOARDING' && h.status === 'OPEN' && people.has(h.individual_id),
      );
      const hits = new Set(parked.map(h => h.id));
      const listed = new Set(parked.map(h => h.watchlist_entry_id));
      drop(rows.screening_hits, h => hits.has(h.id));
      drop(rows.status_changes, s => hits.has(s.record_id));
      drop(rows.watchlist_entries, e => listed.has(e.id));
      kyc.escalation_reason = IDENTITY_ESCALATION;
      rows.status_changes
        .filter(s => s.record_id === kyc.id && s.new_value === 'ESCALATED')
        .forEach(s => {
          s.reason = IDENTITY_ESCALATION;
        });
    });
}

/** A frozen account opens again, its cards with it (one that ran out meanwhile is expired). */
function reopen(ctx, account) {
  const today = isoDate(NOW);
  Object.assign(account, {
    status: 'ACTIVE',
    frozen_at: null,
    freeze_reason: null,
    freeze_note: null,
  });
  ctx.rows.cards
    .filter(
      c =>
        c.account_id === account.id && c.status === 'BLOCKED' && c.blocked_reason === 'AML_FREEZE',
    )
    .forEach(c =>
      Object.assign(c, {
        status: String(c.expires_at) > today ? 'ACTIVE' : 'EXPIRED',
        blocked_reason: null,
        blocked_at: null,
      }),
    );
}

/**
 * An AML case gives no ground to freeze an account in France, and a freeze would tip the customer
 * off: only a mule's account stays frozen while its case is open, to protect the victims' money,
 * and opens again once the case is closed. The accounts were frozen when the customers were drawn
 * (retail.js, business.js), before any case existed: undone here, so no random draw moves. Their
 * statements stop at the old freeze date (banking.js): a quiet account, not a frozen one.
 */
function amlFreezes(ctx) {
  const { rows } = ctx;
  const mules = new Set(
    [...ctx.stories.values()].filter(s => s.kind === 'MULE').map(s => s.customer.id),
  );
  rows.accounts
    .filter(a => a.status === 'FROZEN' && a.freeze_reason === 'AML_INVESTIGATION')
    .forEach(account => {
      const customer = ctx.customers.get(account.customer_id);
      const cases = rows.investigations.filter(i => i.customer_id === customer.id);
      const open = cases.some(i => i.status !== 'CLOSED');
      if (mules.has(customer.id) && open) return;
      const frozen = account.frozen_at;
      reopen(ctx, account);
      if (customer.status !== 'SUSPENDED') return;
      if ((ctx.accountsOf.get(customer.id) || []).some(a => a.status === 'FROZEN')) return;
      customer.status = 'ACTIVE';
      const suspended = s =>
        s.record_type === 'CUSTOMERS' && s.record_id === customer.id && s.new_value === 'SUSPENDED';
      const last = cases
        .filter(i => i.decided_at)
        .sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1))[0];

      if (open || !last || frozen >= last.decided_at) {
        // Frozen by no case, or only after it closed: never suspended.
        drop(rows.status_changes, suspended);

        return;
      }

      // Suspended with the freeze, active again once the case closed.
      rows.status_changes.filter(suspended).forEach(s => {
        s.changed_at = frozen;
      });
      const when = past(at(toDate(last.decided_at), 1));
      customer.updated_at = iso(when);
      const why = `${last.reference} closed (${label(last.decision)}): protective freeze lifted`;
      step(ctx, 'CUSTOMERS', customer, ['SUSPENDED', 'ACTIVE'], when, last.decided_by, why);
    });
}

/** A source-of-funds question written for an open referral: answered, or still out. */
function referralQuestion(ctx, inv, state) {
  const { rows } = ctx;
  const person = ctx.holderOf(ctx.customers.get(inv.customer_id));
  if (!person) return null;
  const opened = toDate(inv.opened_at);
  // Asked two days after the case opened; an answer took three days.
  const sent = later(
    earlier(at(opened, 50), at(NOW, state === 'ANSWERED' ? -96 : -2)),
    at(opened, 5),
  );
  const answered = state === 'ANSWERED' ? earlier(at(sent, 72), at(NOW, -2)) : null;
  const due = new Date(sent.getTime() + 7 * DAY);
  let status = due < NOW ? 'OVERDUE' : 'SENT';
  if (answered) status = 'ANSWERED';
  let reminders = status === 'SENT' && NOW.getTime() - sent > 3 * DAY ? 1 : 0;
  if (status === 'OVERDUE') reminders = 2;
  const blank = Object.fromEntries(Object.keys(rows.information_requests[0]).map(k => [k, null]));
  const row = {
    ...blank,
    id: stableId(`${inv.id}:question`),
    reference: nextReference(rows.information_requests, 'RFI', sent),
    customer_id: inv.customer_id,
    addressed_to_id: person.id,
    context: 'INVESTIGATION',
    investigation_id: inv.id,
    channel: 'APP',
    questions: QUESTIONS.SOURCE_OF_FUNDS[0],
    requested_by: inv.assigned_to,
    created_at: iso(at(sent, -0.2)),
    sent_at: iso(sent),
    due_at: iso(due),
    reminders_sent: reminders,
    last_reminder_at: reminders ? iso(past(at(sent, (3 + 3 * reminders) * 24))) : null,
    status,
    answered_at: answered ? iso(answered) : null,
    // Written by investigationAnswers, from who the customer is.
    answer: answered ? 'See the documents attached.' : null,
  };
  rows.information_requests.push(row);
  const by = row.requested_by;
  step(ctx, 'INFORMATION_REQUESTS', row, [null, 'DRAFT'], at(sent, -0.2), by);
  step(ctx, 'INFORMATION_REQUESTS', row, ['DRAFT', 'SENT'], sent, by);

  if (status === 'OVERDUE') {
    step(
      ctx,
      'INFORMATION_REQUESTS',
      row,
      ['SENT', 'OVERDUE'],
      due,
      'system',
      'No answer by the due date',
    );
  }

  if (answered) step(ctx, 'INFORMATION_REQUESTS', row, ['SENT', 'ANSWERED'], answered, 'customer');

  return row;
}

/**
 * Sets where an open referral stands with the customer: NONE (not asked yet, in the analyst queue),
 * ANSWERED (asked and answered, back in the queue) or OUT (waiting for the answer, out of it). A
 * request already in that state is kept; the others go, with their history.
 */
function referralState(ctx, inv, state) {
  const { rows } = ctx;
  const fits = r =>
    state === 'ANSWERED' ? r.status === 'ANSWERED' : ['SENT', 'OVERDUE'].includes(r.status);
  const requests = rows.information_requests.filter(r => r.investigation_id === inv.id);
  const kept = state === 'NONE' ? null : requests.find(fits);
  const gone = new Set(requests.filter(r => r !== kept).map(r => r.id));
  drop(rows.information_requests, r => gone.has(r.id));
  drop(rows.status_changes, s => gone.has(s.record_id));
  const rfi = kept || (state !== 'NONE' ? referralQuestion(ctx, inv, state) : null);
  // The case's own history: opened, taken, then the question and its answer.
  drop(
    rows.status_changes,
    s => s.record_id === inv.id && [s.old_value, s.new_value].includes('WAITING_INFORMATION'),
  );

  if (rfi) {
    const why = 'Request for information sent to the customer';
    step(
      ctx,
      'INVESTIGATIONS',
      inv,
      ['IN_PROGRESS', 'WAITING_INFORMATION'],
      toDate(rfi.sent_at),
      inv.assigned_to,
      why,
    );

    if (rfi.answered_at) {
      step(
        ctx,
        'INVESTIGATIONS',
        inv,
        ['WAITING_INFORMATION', 'IN_PROGRESS'],
        toDate(rfi.answered_at),
        inv.assigned_to,
        'Customer answered',
      );
    }
  }

  inv.status = state === 'OUT' && rfi ? 'WAITING_INFORMATION' : 'IN_PROGRESS';
}

/**
 * The open internal referrals, one per path of the guided investigation, set by rule rather than by
 * the draws that made them. People: the first whose money came from their own employer answered
 * our question with their payslips (it explains everything); the first other one whose case is
 * about their current account was never asked; the others wait for an answer. Companies (a
 * property company, SCI, first): the first needs a full KYC review, the second answered without a
 * single document, the others wait. Oldest customer first within each rule.
 */
function referralPaths(ctx) {
  const { rows } = ctx;
  const txs = new Map(rows.transactions.map(t => [t.id, t]));
  const accounts = new Map<any, any>(rows.accounts.map(a => [a.id, a]));
  const parties = new Map<any, any>(rows.counterparties.map(c => [c.id, c]));
  const caseLines = inv =>
    rows.investigation_transactions
      .filter(x => x.investigation_id === inv.id)
      .map(x => txs.get(x.transaction_id))
      .filter(Boolean);
  const customer = inv => ctx.customers.get(inv.customer_id);
  const byAge = (a, b) => (customer(a).created_at < customer(b).created_at ? -1 : 1);
  const open = rows.investigations
    .filter(
      i =>
        i.origin === 'INTERNAL_REFERRAL' &&
        ['IN_PROGRESS', 'WAITING_INFORMATION'].includes(i.status),
    )
    .sort(byAge);
  const people = open.filter(i => customer(i).customer_type === 'RETAIL');

  const employerPaid = inv => {
    const employer = ctx.holderOf(customer(inv))?.employer;

    return caseLines(inv).some(
      t =>
        t.direction === 'CREDIT' && employer && parties.get(t.counterparty_id)?.name === employer,
    );
  };

  const onCurrent = inv => caseLines(inv).some(t => accounts.get(t.account_id)?.type === 'CURRENT');
  const explains = people.find(employerPaid);
  const ask = people.find(i => i !== explains && onCurrent(i));
  people.forEach(inv => {
    let state = 'OUT';
    if (inv === explains) state = 'ANSWERED';
    if (inv === ask) state = 'NONE';
    referralState(ctx, inv, state);
  });
  const sci = inv => (customer(inv).display_name.startsWith('SCI ') ? 1 : 0);
  open
    .filter(i => customer(i).customer_type === 'BUSINESS')
    .sort((a, b) => sci(b) - sci(a) || byAge(a, b))
    .forEach((inv, k) => referralState(ctx, inv, ['NONE', 'ANSWERED'][k] || 'OUT'));
}

/**
 * The payment a screening hit holds was refused for lack of funds (the statement emptied the
 * account first): a client's down payment arrives the evening before, then the payment is held.
 */
function fundAndHold(ctx, tx, reason) {
  if (tx.status === 'HELD' || tx.status_reason !== 'Transfer rejected: insufficient funds') return;
  const { rows } = ctx;
  const account = rows.accounts.find(a => a.id === tx.account_id);
  const lines = rows.transactions.filter(t => t.account_id === account.id);
  const before = lines
    .filter(t => t.status === 'BOOKED' && t.booked_at < tx.created_at)
    .sort((a, b) => (a.booked_at < b.booked_at ? -1 : 1));
  const last = before[before.length - 1];
  const details = new Map<any, any>(rows.incoming_transfers.map(d => [d.transaction_id, d]));
  const template = before.filter(t => t.direction === 'CREDIT' && details.has(t.id)).pop();
  if (!last || !template) return;
  const amount =
    Math.ceil((Number(tx.amount) - Number(account.available_balance) + 2500) / 100) * 100;
  const date = new Date((toDate(last.booked_at).getTime() + toDate(tx.created_at).getTime()) / 2);
  const emitter = rows.counterparties.find(c => c.id === template.counterparty_id);
  const order = `ACOMPTE CDE ${1000 + hashNumber(tx.id, 9000)}`;
  const credit = {
    ...template,
    id: stableId(`${tx.id}:down-payment`),
    amount,
    created_at: iso(date),
    booked_at: iso(date),
    value_date: isoDate(date),
    balance_after: round2(Number(last.balance_after) + amount),
    description: `VIR SEPA ${ascii(emitter.name).toUpperCase()} ${order}`,
    reference: order,
  };
  rows.transactions.push(credit);
  rows.incoming_transfers.push({
    ...details.get(template.id),
    id: stableId(`${tx.id}:down-payment-detail`),
    transaction_id: credit.id,
    end_to_end_id: `E2E${hashNumber(credit.id, 1e9).toString(16).toUpperCase().padStart(13, '0')}`,
    remittance_info: order,
  });
  lines
    .filter(t => t.status === 'BOOKED' && t.booked_at > credit.booked_at && t !== credit)
    .forEach(t => {
      t.balance_after = round2(Number(t.balance_after) + amount);
    });
  account.balance = round2(Number(account.balance) + amount);
  account.available_balance = round2(Number(account.available_balance) + amount - tx.amount);
  Object.assign(tx, { status: 'HELD', status_reason: reason });
  const detail = rows.outgoing_transfers.find(d => d.transaction_id === tx.id);
  if (detail) detail.rejection_reason = null;
}

/** The sanctioned company's payment: held, its payee a Cypriot account opened for the occasion. */
function sanctionedPayment(ctx) {
  const { rows } = ctx;
  const hit = rows.screening_hits.find(h => h.trigger === 'PAYMENT' && h.counterparty_id);
  const tx = hit && rows.transactions.find(t => t.id === hit.transaction_id);
  if (!tx) return;
  fundAndHold(ctx, tx, 'Held by sanctions screening: possible match on the EU list');
  const party = rows.counterparties.find(c => c.id === hit.counterparty_id);
  const payee = rows.sct_beneficiaries.find(b => b.counterparty_id === party.id);
  Object.assign(party, {
    country: payee.iban.slice(0, 2),
    first_seen_at: payee.added_at,
    last_screened_at: hit.created_at,
  });
}

// A French supplier whose name is close to a company on the EU list (crime.js LISTED_ENTITIES).
const NAMESAKE = { listed: 'Northern Star Logistics LLC', payee: 'Northern Star Logistique' };

/**
 * A payment to a French supplier held because its name is close to a listed Russian company:
 * the comparison clears it, the payment is released. Paid by an active company no story uses.
 */
function namesakePayment(ctx, busy) {
  const { rows } = ctx;
  const entry = rows.watchlist_entries.find(e => e.name === NAMESAKE.listed);
  const choices = rows.customers
    .filter(c => c.customer_type === 'BUSINESS' && c.status === 'ACTIVE' && !busy.has(c.id))
    .map(c => {
      const account = (ctx.accountsOf.get(c.id) || []).find(
        a => a.type === 'BUSINESS' && a.status === 'ACTIVE' && Number(a.available_balance) > 15000,
      );
      const person = ctx.holderOf(c);
      const phone = person && deviceAt(ctx, person.id, at(NOW, -3));

      return { customer: c, account, person, phone };
    })
    .filter(c => c.account && c.phone)
    .sort((a, b) => (a.customer.id < b.customer.id ? -1 : 1));
  const [payer] = choices;
  if (!entry || !payer) return;
  const { customer, account, person, phone } = payer;
  const created = at(NOW, -3);
  const added = at(NOW, -5 * 24 - 2);
  const amount = round2(3000 + hashNumber(customer.id, 600000) / 100);
  const party = {
    id: stableId(`${customer.id}:namesake`),
    counterparty_type: 'SCT_BENEFICIARY',
    name: NAMESAKE.payee,
    country: 'FR',
    risk_level: 'LOW',
    is_blocked: false,
    first_seen_at: iso(added),
    last_screened_at: iso(created),
    blocked_at: null,
    block_reason: null,
  };
  const payee = {
    id: stableId(`${customer.id}:namesake-payee`),
    counterparty_id: party.id,
    customer_id: customer.id,
    added_from_device_id: phone.id,
    iban: frenchIban(10000000 + hashNumber(customer.id, 89999999), '30004', '00821'),
    bic: 'BNPAFRPPXXX',
    bank_name: 'BNP Paribas',
    nickname: 'Northern Star',
    is_saved: true,
    payee_check: 'MATCH',
    payee_check_name: null,
    is_trusted: false,
    added_at: iso(added),
    removed_at: null,
    last_used_at: iso(created),
  };
  const invoice = `NSL-${created.getUTCFullYear()}-${100 + hashNumber(party.id, 900)}`;
  const tx = {
    id: stableId(`${customer.id}:namesake-payment`),
    account_id: account.id,
    counterparty_id: party.id,
    initiated_by_id: person.id,
    device_id: phone.id,
    rail: 'TRANSFER',
    direction: 'DEBIT',
    amount,
    currency: 'EUR',
    status: 'HELD',
    booked_at: null,
    value_date: null,
    balance_after: null,
    description: `VIR SEPA ${NAMESAKE.payee.toUpperCase()}`,
    reference: `FACTURE ${invoice}`,
    created_at: iso(created),
    status_reason: 'Held by sanctions screening: possible match on the EU list',
    reversed_at: null,
    category: 'TRANSFERS',
  };
  rows.counterparties.push(party);
  rows.sct_beneficiaries.push(payee);
  rows.transactions.push(tx);
  rows.outgoing_transfers.push({
    id: stableId(`${customer.id}:namesake-detail`),
    transaction_id: tx.id,
    beneficiary_id: payee.id,
    scheme: 'SEPA',
    initiated_via: 'BANKING_APP',
    end_to_end_id: `E2E${hashNumber(tx.id, 1e9).toString(16).toUpperCase().padStart(13, '0')}`,
    payee_check: 'MATCH',
    validation_status: 'NOT_REQUIRED',
    validated_by: null,
    validated_at: null,
    requested_execution_date: isoDate(created),
    rejection_reason: null,
    sca_method: 'APP_CONFIRMATION',
    purpose_code: 'SUPP',
    is_standing_order: false,
  });
  account.available_balance = round2(Number(account.available_balance) - amount);
  const hit = screeningHit(ctx, {
    id: stableId(`${customer.id}:namesake-hit`),
    counterparty_id: party.id,
    transaction_id: tx.id,
    watchlist_entry_id: entry.id,
    screened_name: NAMESAKE.payee,
    trigger: 'PAYMENT',
    match_score: 84.2,
    matched_on: 'Name (close spelling)',
    status: 'OPEN',
    created_at: iso(at(created, 0.01)),
  });
  hit.reference = nextHitReference(rows, created);
}

/**
 * The disputed card payment the customer approved with 3-D Secure (disputes.js doubtedClaims) is
 * the investigations queue's no-SAR case: moved to the same customer on every build (the first by
 * a hash of their id with such a payment, no story on them), where the disputes wave drew it at
 * random. Same dates, same answer: only whose payment it is changes.
 */
function pinDoubtedDispute(ctx, busy) {
  const { rows } = ctx;
  const inv = rows.investigations.find(i => i.origin === 'DISPUTE' && i.status === 'IN_PROGRESS');
  const dispute = inv && rows.dispute_requests.find(d => d.investigation_id === inv.id);
  if (!dispute) return;
  const requested = toDate(dispute.requested_at);
  const disputed = new Set(rows.dispute_transactions.map(d => d.transaction_id));
  // Never someone who disputed before: a third dispute would call for rule FRD-004's alert.
  const disputers = new Set(
    rows.dispute_requests.filter(d => d.id !== dispute.id).map(d => d.customer_id),
  );
  const story = new Set(
    [...ctx.stories.values()].flatMap(st => (st.lines || []).map(l => l.tx.id)),
  );
  const txs = new Map<any, any>(rows.transactions.map(t => [t.id, t]));
  const accounts = new Map<any, any>(rows.accounts.map(a => [a.id, a]));
  const choices = rows.card_transactions
    .filter(
      c =>
        c.type === 'PURCHASE' &&
        c.entry_mode === 'ONLINE' &&
        c.is_3ds &&
        ['SETTLED', 'CLEARED'].includes(c.status) &&
        !disputed.has(c.transaction_id) &&
        !story.has(c.transaction_id),
    )
    .map(card => {
      const tx = txs.get(card.transaction_id);
      const account = tx && accounts.get(tx.account_id);
      const customer = account && ctx.customers.get(account.customer_id);

      return { card, tx, account, customer };
    })
    .filter(({ tx, account, customer }) => {
      const gap = tx && (requested.getTime() - toDate(tx.created_at).getTime()) / DAY;

      return (
        customer &&
        tx.status === 'BOOKED' &&
        Number(tx.amount) >= 60 &&
        gap > 2 &&
        gap < 30 &&
        account.status === 'ACTIVE' &&
        customer.status === 'ACTIVE' &&
        customer.customer_type === 'RETAIL' &&
        !busy.has(customer.id) &&
        !disputers.has(customer.id)
      );
    })
    .sort(
      (a, b) =>
        hashOf(`doubted:${a.customer.id}`) - hashOf(`doubted:${b.customer.id}`) ||
        (a.tx.created_at < b.tx.created_at ? 1 : -1),
    );
  const [chosen] = choices;
  if (!chosen) return;
  const { card, tx, customer } = chosen;
  const merchant = rows.counterparties.find(c => c.id === tx.counterparty_id)?.name || '';
  Object.assign(dispute, {
    customer_id: customer.id,
    transaction_id: tx.id,
    card_transaction_id: card.id,
    amount: tx.amount,
    reason_detail: `I do not recognise this online payment to ${merchant}.`,
  });
  rows.dispute_transactions
    .filter(d => d.dispute_request_id === dispute.id)
    .forEach(d => {
      d.transaction_id = tx.id;
    });
  Object.assign(inv, { customer_id: customer.id, amount_involved: Number(tx.amount) });
  rows.investigation_transactions
    .filter(x => x.investigation_id === inv.id)
    .forEach(x => {
      x.transaction_id = tx.id;
    });
  busy.add(customer.id);
}

/** Transfers received in the 60 days before `received` (not salaries), by account. */
function receivedTransfers(rows, received) {
  const [from, to] = [iso(at(received, -60 * 24)), iso(at(received, -24))];
  const byAccount = new Map();
  rows.transactions
    .filter(
      t =>
        t.rail === 'TRANSFER' &&
        t.direction === 'CREDIT' &&
        t.category !== 'SALARY' &&
        t.status === 'BOOKED' &&
        t.created_at > from &&
        t.created_at < to,
    )
    .forEach(t => {
      if (!byAccount.has(t.account_id)) byAccount.set(t.account_id, []);
      byAccount.get(t.account_id).push(t);
    });

  return byAccount;
}

/**
 * The police requisition about money from a scam victim (lifecycle.js policeRequisition) opens the
 * investigation the MLRO sends back: moved to the same customer on every build (the first by a
 * hash of their id with two transfers received before the requisition, no story on them), where
 * the lifecycle wave drew it at random. Same dates; the two transfers named are the new customer's
 * largest in the 60 days before.
 */
function pinPoliceRequisition(ctx, busy) {
  const { rows } = ctx;
  const inv = rows.investigations.find(
    i => i.origin === 'AUTHORITY_REQUEST' && i.status === 'IN_PROGRESS',
  );
  const request =
    inv && rows.authority_requests.find(r => r.id === inv.origin_authority_request_id);
  if (!request) return;
  const byAccount = receivedTransfers(rows, toDate(request.received_at));
  const [chosen] = rows.customers
    .filter(c => c.customer_type === 'RETAIL' && c.status === 'ACTIVE' && !busy.has(c.id))
    .map(customer => {
      const account = (ctx.accountsOf.get(customer.id) || []).find(
        a => a.type !== 'SAVINGS' && a.status === 'ACTIVE',
      );
      const lines = ((account && byAccount.get(account.id)) || [])
        .slice()
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 2);

      return { customer, lines, person: ctx.holderOf(customer) };
    })
    .filter(c => c.lines.length === 2 && c.person)
    .sort((a, b) => hashOf(`police:${a.customer.id}`) - hashOf(`police:${b.customer.id}`));
  if (!chosen) return;
  const { customer, lines, person } = chosen;
  Object.assign(request, { customer_id: customer.id, individual_id: person.id });
  Object.assign(inv, { customer_id: customer.id, amount_involved: sumOf(lines) });
  rows.investigation_transactions
    .filter(x => x.investigation_id === inv.id)
    .forEach((x, k) => {
      x.transaction_id = lines[k].id;
    });
  busy.add(customer.id);
}

// What a customer answers to the routine source-of-funds question, by case (complianceQueue).
const ANSWER_EXPLAINS = employer =>
  `It is my salary from ${employer} and my rent, as every month: nothing else came in. My last three payslips are attached.`;
const ANSWER_DODGES =
  'These are consulting fees from new clients. We cannot send the contracts or the invoices: they are confidential.';

/** Open AML referrals answered by the customer: a person explains, a company won't document. */
function investigationAnswers(ctx) {
  const { rows } = ctx;
  rows.investigations
    .filter(i => ['OPEN', 'IN_PROGRESS'].includes(i.status) && i.origin === 'INTERNAL_REFERRAL')
    .forEach(inv => {
      const request = rows.information_requests.find(
        r => r.investigation_id === inv.id && r.status === 'ANSWERED',
      );
      if (!request) return;
      const customer = ctx.customers.get(inv.customer_id);
      const holder = ctx.holderOf(customer);
      request.answer =
        customer.customer_type === 'RETAIL'
          ? ANSWER_EXPLAINS(holder?.employer || 'my employer')
          : ANSWER_DODGES;
    });
}

function complianceQueue(ctx) {
  amlFreezes(ctx);
  const busy = busyCustomers(ctx);
  screeningPeople(ctx, busy);
  sanctionedPayment(ctx);
  namesakePayment(ctx, busy);
  identityOnboarding(ctx);
  pinDoubtedDispute(ctx, busy);
  pinPoliceRequisition(ctx, busy);
  referralPaths(ctx);
  // A mule under investigation is never asked anything: the question would tip them off.
  ctx.stories.forEach(story => {
    if (story.kind === 'MULE' && story.investigation?.status === 'IN_PROGRESS') {
      referralState(ctx, story.investigation, 'NONE');
    }
  });
  investigationAnswers(ctx);
}

const WAVE_B = [
  'devices',
  'login_events',
  'kyc_cases',
  'documents',
  'information_requests',
  'customer_change_requests',
  'watchlist_entries',
  'screening_hits',
  'rules',
  'alerts',
  'alert_transactions',
  'investigations',
  'investigation_transactions',
  'sar_reports',
  'status_changes',
];

/**
 * Everything of wave B, on top of the parties and statements already in `rows`; then the later
 * waves (`waves`, each a function of the same context), before references are numbered; then the
 * waves that write their own references (`late`: rows, stories, and the set of customers they
 * keep for their cases), and last the compliance queues, on customers no wave took.
 */
/** A declaration number TRACFIN gives, fixed per SAR (no draw from the seeded stream). */
const tracfinNumber = (report, date) =>
  `TRACFIN-${date.getUTCFullYear()}-${100000 + (parseInt(report.id.slice(0, 8), 16) % 900000)}`;

/**
 * The rule: once a SAR is filed, every account of the customer stays frozen, its cards blocked,
 * until TRACFIN answers. A customer the bank already let go (fraudExit, lifecycle.js) had
 * TRACFIN's answer first: exit the relationship. Last of all, and drawing nothing from the seeded
 * stream, so every other row stays as it was.
 */
function tracfinFreezes(ctx) {
  const { rows } = ctx;
  rows.sar_reports
    .filter(report => ['SUBMITTED', 'ACKNOWLEDGED'].includes(report.status))
    .forEach(report => {
      const filed = toDate(report.filed_at);
      const exit = rows.closures.find(c => c.investigation_id === report.investigation_id);

      if (exit) {
        const answered = at(toDate(exit.requested_at), -6);
        const received =
          report.acknowledged_at && toDate(report.acknowledged_at) < answered
            ? toDate(report.acknowledged_at)
            : at(filed, 24);
        const line = (from, to, when, by, reason) =>
          rows.status_changes.push({
            id: uuid(),
            record_type: 'SAR_REPORTS',
            record_id: report.id,
            field: 'status',
            old_value: from,
            new_value: to,
            changed_by: by,
            changed_at: iso(when),
            reason,
          });
        const ack = rows.status_changes.find(
          c =>
            c.record_type === 'SAR_REPORTS' &&
            c.record_id === report.id &&
            c.new_value === 'ACKNOWLEDGED',
        );
        if (ack) ack.changed_at = iso(received);
        else line('SUBMITTED', 'ACKNOWLEDGED', received, 'TRACFIN', null);
        line(
          'ACKNOWLEDGED',
          'ANSWERED',
          answered,
          report.filed_by,
          'TRACFIN: exit the relationship',
        );
        Object.assign(report, {
          status: 'ANSWERED',
          acknowledged_at: iso(received),
          fiu_reference: report.fiu_reference || tracfinNumber(report, received),
          tracfin_answer: 'EXIT_RELATIONSHIP',
          tracfin_answered_at: iso(answered),
          tracfin_note: 'No objection to releasing the funds; the bank may end the relationship.',
          updated_at: iso(answered),
        });

        return;
      }

      const accounts = rows.accounts.filter(
        a =>
          a.customer_id === report.customer_id &&
          (['ACTIVE', 'DORMANT'].includes(a.status) ||
            (a.status === 'FROZEN' &&
              ['AML_INVESTIGATION', 'FRAUD_SUSPICION'].includes(a.freeze_reason))),
      );
      accounts.forEach(a =>
        Object.assign(a, {
          status: 'FROZEN',
          frozen_at: report.filed_at,
          freeze_reason: 'SAR_FILED',
          freeze_note: `SAR filed: waiting for TRACFIN (${report.reference})`,
        }),
      );
      const ids = new Set(accounts.map(a => a.id));
      rows.cards
        .filter(c => ids.has(c.account_id) && ['ACTIVE', 'PENDING'].includes(c.status))
        .forEach(c =>
          Object.assign(c, {
            status: 'BLOCKED',
            blocked_reason: 'AML_FREEZE',
            blocked_at: report.filed_at,
          }),
        );
    });
}

function financialCrime(rows, stories, waves = [], late = []) {
  WAVE_B.forEach(t => {
    rows[t] = [];
  });
  const ctx: Record<string, any> = context(rows, stories);
  applicantDates(ctx);
  devicesAndLogins(ctx);
  kycCases(ctx);
  changeRequests(ctx);
  screening(ctx);
  rules(ctx);
  storyCases(ctx);
  freezeCases(ctx);
  identityCase(ctx);
  backgroundAlerts(ctx);
  remediationReviews(ctx);
  suspendedStoryCustomers(ctx);
  customerHistory(ctx);
  waves.forEach(wave => wave(ctx));
  numberReferences(rows.kyc_cases, 'KYC', 'opened_at');
  numberReferences(rows.alerts, 'ALR', 'triggered_at');
  numberReferences(rows.investigations, 'INV', 'opened_at');
  numberReferences(rows.sar_reports, 'SAR', 'created_at');
  numberReferences(rows.screening_hits, 'HIT', 'created_at');
  numberReferences(rows.customer_change_requests, 'CHG', 'requested_at');
  numberReferences(rows.information_requests, 'RFI', 'created_at');
  ctx.reserved = ctx.reserved || new Set();
  late.forEach(wave => wave(rows, stories, ctx.reserved));
  complianceQueue(ctx);
  tracfinFreezes(ctx);

  return rows;
}

export {
  financialCrime,
  // For the onboarding funnel (onboarding-funnel.js).
  SENIOR_RISKS,
  SIGNOFF_REASON,
  beneficialOwners,
  failPaper,
  onboardingDue,
  requestedOnly,
  checked,
  companyDocuments,
  context,
  documentRow,
  kycCase,
  newcomerDevices,
  payers,
  personDocuments,
  // For the later waves (disputes.js).
  HOUR,
  TEAM,
  NOW,
  alert,
  at,
  earlier,
  informationRequest,
  investigation,
  later,
  mail,
  numberReferences,
  op,
  past,
  screeningHit,
  trail,
  watchEntry,
};
