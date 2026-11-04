/**
 * The onboarding funnel: a year of applications, decided as a real onboarding desk decides them,
 * so the Onboarding desk's weekly charts (desk-charts.ts) draw a curve and the customer base grows
 * without a cliff. Over the 26 weeks the charts show, 14 to 22 decisions a week; in the 26 weeks
 * before, from 1 to 11 (the bank was smaller).
 *
 * - Approved automatically: a clean, low-risk retail application made in the app or on the web,
 *   decided minutes after it came in (decided_by "Automatic approval"), any day.
 * - Approved by the desk, on working days: papers checked (business: the beneficial owners' IDs,
 *   the company papers against the INPI register and its register of beneficial owners), sometimes
 *   after a question to the client; a medium or high risk signed off by a senior. The rating is the
 *   one the case file suggests (case-file.ts).
 * - Approved customers become ACTIVE; their accounts open after the approval with a first deposit
 *   from their own account elsewhere, then the statement everyone has (banking.ts), a phone and
 *   logins.
 * - Declined (refusals.ts): the selfie is not the ID holder, a forged paper, owners unlike the
 *   register, outside the risk appetite. The customer is DECLINED, with no account.
 * - Closed, no answer: a question went unanswered; the case closes two weeks after its due date,
 *   the request cancelled with it, and the applicant is a PROSPECT again.
 * - A synthetic identity wave seven weeks ago: one device, a series of phone numbers, addresses in
 *   one postal area; all declined, linked to one investigation whose SAR waits for the MLRO.
 *
 * The rate of approval (approved against declined) moves between about 55% and 82%: a slower,
 * lower summer and the fraud wave; the team gets faster as months go by. Applications whose
 * decision would come after now are left out: the open queue is the one crime.ts writes. Built
 * last, on a seeded stream of its own (random.ts withStream); the KYC and request references are
 * numbered again, to stay in date order with the new cases.
 */
import { createHash } from 'crypto';

import { closeTheBooks, customerBanking, sharedOf, toDate } from './banking';
import { applicantCompany } from './business';
import {
  SENIOR_RISKS,
  SIGNOFF_REASON,
  beneficialOwners,
  checked,
  companyDocuments,
  context,
  documentRow,
  failPaper,
  informationRequest,
  kycCase,
  newcomerDevices,
  onboardingDue,
  op,
  payers,
  personDocuments,
  requestedOnly,
  trail,
} from './crime';
import {
  DAY,
  NOW,
  TODAY,
  between,
  chance,
  eighteenth,
  iso,
  isoDate,
  parisMonday,
  parisParts,
  parisTime,
  pick,
  random as rand,
  uuid,
  weighted,
  workBefore,
  workMoment,
} from './random';
import { BIC, frenchIban } from './reference';
import { LIVENESS, REFUSAL, customerStatusAfter, refusalReason } from './refusals';
import { accountRows, memberRows, newCustomer } from './retail';
import { WEEKS } from '../charts/desk-charts';
import { applicantRating, companyRating } from '../customizations/shared/case-file';
import { tables } from '../model/schema';

const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;
const at = (date, hours) => new Date(date.getTime() + hours * HOUR);
const COMPANY_PAPERS = ['COMPANY_REGISTRATION', 'ARTICLES_OF_ASSOCIATION', 'UBO_DECLARATION'];
const CYCLE_DAYS = { LOW: 3 * 365, MEDIUM: 2 * 365, HIGH: 365 };
// Who decides a system approval, and what its history line says.
const AUTO = 'Automatic approval';
const AUTO_NOTE = 'Automatic approval: ID and selfie passed, screening clear, low risk';
// The share of eligible applications (clean, low-risk retail, in the app or on the web) the
// system approves on its own; the others still meet a person.
const AUTO_SHARE = 0.3;
const RISK_APPETITE = {
  RETAIL: [
    'large cash deposits announced, source of funds not documented',
    'income from online gambling given as the main source of funds',
    'activity tied to crypto-asset trading on unregulated platforms',
  ],
  BUSINESS: [
    'cash-intensive activity with suppliers in high-risk countries',
    'crypto-asset services offered without an AMF registration',
  ],
};
const OLD_ADDRESS = 'Dated more than three months ago';
const OLD_KBIS = 'INPI register: older than 3 months';
const ANSWERS = {
  PROOF_OF_ADDRESS: 'Here is my latest electricity bill.',
  BUSINESS_KBIS: 'A fresh Kbis extract is attached.',
  BUSINESS_UBO: 'Register of beneficial owners and the IDs attached.',
};
// The synthetic identity wave: what its applications share.
const WAVE = {
  fingerprint: createHash('md5').update('forest-lab:synthetic-wave').digest('hex'),
  device: 'Samsung Galaxy A54',
  version: '7.12.3',
  street: 'rue Gabriel Péri',
  postal: '93200',
  city: 'Saint-Denis',
};

/** An empty row of a table: every column, null. */
const blank = table => Object.fromEntries(tables[table].fields.map(f => [f.name, null]));

// ---- the plan: how many cases the team decides each week, and how they end ---------------------

const clamp = (x, low, high) => Math.min(high, Math.max(low, x));

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  return list;
}

/** A week most of the team is away: mid-August, or Christmas to New Year (days in Paris). */
function holidayWeek(monday) {
  const away = Array.from({ length: 5 }, (unused, k) =>
    parisParts(new Date(monday.getTime() + k * DAY + 12 * HOUR)),
  ).filter(
    p =>
      (p.m === 8 && p.d >= 8 && p.d <= 21) || (p.m === 12 && p.d >= 24) || (p.m === 1 && p.d === 1),
  );

  return away.length >= 3;
}

/**
 * Week `k` (0 = 26 weeks ago, WEEKS = this week, below 0 the half year before): how many cases the
 * team decides, how many it approves, declines or closes for no answer, and its pace. Planned by
 * the week of the decision, as the charts count.
 */
function weekPlan(k, monday) {
  const t = Math.max(0, k) / WEEKS;
  const holiday = holidayWeek(monday);
  const fraud = k === WEEKS - 7 || k === WEEKS - 6;
  const count =
    k < 0
      ? Math.round(1 + (10 * (k + WEEKS)) / WEEKS + rand())
      : Math.round((14 + 8 * t) * (holiday ? 0.65 : 1) * (0.9 + rand() * 0.2));
  const silent = Math.round(count * (holiday ? 0.16 : 0.1));
  // People away answer late, and the desk is thinner: fewer approvals in summer.
  const rate = clamp(
    0.74 + 0.04 * Math.sin(k / 3.5) + (rand() - 0.5) * 0.05 - (holiday ? 0.05 : 0),
    0.62,
    0.82,
  );
  const approved = Math.round((count - silent) * rate);
  const outcomes = [
    ...Array(approved).fill('APPROVED'),
    ...Array(count - silent - approved).fill('DECLINED'),
    ...Array(silent).fill('NO_RESPONSE'),
    // The synthetic identity wave: forged applications, all declined.
    ...Array(fraud ? between(4, 6) : 0).fill('FRAUD'),
  ];
  // Slower in summer and during the fraud wave (more manual reviews), faster as months go by.
  const pace = (1.1 - 0.25 * t) * (holiday ? 1.5 : 1) * (fraud ? 1.25 : 1);

  return { outcomes: shuffle(outcomes), pace, fraud };
}

/** A working moment of the week of `monday` (Paris), 08:00-19:00 Monday to Friday. */
function decisionIn(monday) {
  const p = parisParts(monday);

  return parisTime(p.y, p.m, p.d + between(0, 4), between(8, 18), between(0, 59), between(0, 59));
}

/** Days from application to a desk's approval. */
function approvalDays(business, pace) {
  const [low, high] = business
    ? weighted([
        [[2, 3], 12],
        [[3, 5], 30],
        [[5, 8], 33],
        [[8, 12], 17],
        [[12, 24], 8],
      ])
    : weighted([
        [[0.3, 1], 22],
        [[1, 2], 35],
        [[2, 3.5], 23],
        [[3.5, 6], 13],
        [[6, 12], 7],
      ]);

  return (low + rand() * (high - low)) * pace;
}

/** Why a declined application was declined (refusals.ts codes). */
function refusal(outcome, business) {
  if (outcome === 'FRAUD') return 'SYNTHETIC_IDENTITY';

  return business
    ? weighted([
        ['UBO_MISMATCH', 40],
        ['IDENTITY_FAILED', 20],
        ['RISK_APPETITE', 40],
      ])
    : weighted([
        ['IDENTITY_FAILED', 40],
        ['DOCUMENT_FORGED', 25],
        ['RISK_APPETITE', 35],
      ]);
}

/** Every decision of the funnel's year: the week's outcomes, spread evenly over its moments. */
function plannedDecisions() {
  const mp = parisParts(parisMonday(NOW));
  const latest = NOW.getTime() - 30 * MINUTE;
  const list = [];

  for (let k = -WEEKS; k <= WEEKS; k += 1) {
    const monday = parisTime(mp.y, mp.m, mp.d + 7 * (k - WEEKS), 0);
    const { outcomes, pace, fraud } = weekPlan(k, monday);
    // Spread evenly, so the days so far of this week already approve in the week's proportion.
    const moments = outcomes.map(() => decisionIn(monday)).sort((x, y) => x - y);
    const seen = {};
    outcomes
      .map(outcome => {
        seen[outcome] = (seen[outcome] || 0) + 1;
        const total = outcomes.filter(o => o === outcome).length;

        return { outcome, at: (seen[outcome] - rand()) / total };
      })
      .sort((x, y) => x.at - y.at)
      .forEach(({ outcome }, i) => {
        const business = outcome !== 'FRAUD' && chance(0.18);

        if (moments[i].getTime() <= latest) {
          list.push({ outcome, business, decided: moments[i], monday, pace, wave: fraud });
        }
      });
  }

  return list;
}

/** A case the desk decided: when it came in and was picked up; returns its length in days. */
function deskMoments(app) {
  const { outcome, business, pace } = app;
  let days = approvalDays(business, pace);

  if (outcome !== 'APPROVED') {
    let [low, high] = outcome === 'FRAUD' ? [1, 4] : [0.5, 5];
    if (business) [low, high] = [3, 12];
    days = (low + rand() * (high - low)) * pace;
  }

  app.opened = new Date(app.decided.getTime() - days * DAY);
  app.review = workMoment(at(app.opened, between(1, 6)));

  if (app.review >= app.decided) {
    app.review = new Date(app.decided.getTime() - between(10, 40) * MINUTE);
  }

  if (app.review <= app.opened) app.opened = new Date(app.review.getTime() - 10 * MINUTE);

  return days;
}

/** A long wait is a question to the client; now and then a quick one too. */
function questionMoments(app, long) {
  if (!long && !chance(0.12)) return;
  const sent = workMoment(at(app.review, between(1, 6)));
  if (app.decided - sent.getTime() <= 6 * HOUR) return;
  app.sent = sent;
  app.answered = new Date(sent.getTime() + (app.decided - sent.getTime()) * (0.3 + rand() * 0.5));
}

/** A medium or high risk waits for a senior, after the review and before the approval. */
function signoffMoment(app) {
  const after = (app.answered || app.review).getTime() + 10 * MINUTE;
  const wanted = workBefore(new Date(app.decided.getTime() - between(1, 20) * HOUR));
  app.signoff = new Date(
    Math.min(Math.max(wanted.getTime(), after), app.decided.getTime() - 5 * MINUTE),
  );
}

/**
 * The moments of one case, back from its decision: when it came in, was picked up, a question sent
 * and answered, a senior signed off. A system approval came in minutes before, at any hour.
 */
function caseMoments(app, { auto, senior }) {
  if (auto) {
    // Approved by the system: a few minutes after the application, any day, any hour.
    const back = between(0, 60) * HOUR;
    app.decided = new Date(Math.max(app.monday.getTime() + 5 * MINUTE, app.decided - back));
    app.opened = new Date(app.decided.getTime() - between(6, 15) * MINUTE);

    return;
  }

  if (app.outcome === 'NO_RESPONSE') {
    // Asked a paper, reminded, closed two weeks after the 7 days it had to answer.
    app.sent = workBefore(new Date(app.decided.getTime() - between(14, 21) * DAY));
    app.review = workBefore(at(app.sent, -between(1, 6)));
    app.opened = at(app.review, -between(1, 8) - rand());

    return;
  }

  const days = deskMoments(app);
  if (app.outcome !== 'APPROVED') return;
  questionMoments(app, app.business ? days > 8 : days > 4.5);
  if (senior) signoffMoment(app);
}

// ---- the applicants -------------------------------------------------------------------------------

/** Moves a birth date back a year until the person was 18 on `date`. */
function adultOn(person, date) {
  while (eighteenth(person) + DAY > date) {
    const [y, rest] = [Number(person.date_of_birth.slice(0, 4)), person.date_of_birth.slice(4)];
    Object.assign(person, { date_of_birth: `${y - 1}${rest}` });
  }
}

/** A reference nobody has: CUS-YEAR-NNNNNN. */
function customerReference(state, year) {
  let ref;
  do ref = `CUS-${year}-${String(between(1, 999999)).padStart(6, '0')}`;
  while (state.references.has(ref));
  state.references.add(ref);

  return ref;
}

/** Writes the applicant's rows (customer, people, company), drawn as if applying on `when`. */
function applicant(state, business, when) {
  const { rows } = state;

  if (business) {
    const company = applicantCompany(when);
    company.rows.individuals.forEach(p => Object.assign(p, { is_pep: false }));
    Object.entries(company.rows).forEach(([table, list]) => rows[table].push(...list));

    return { ...company.rows, customer: company.customer, business: company.business };
  }

  const drawn = newCustomer();
  // Nobody here is a politically exposed person: their screening would be a story of its own.
  drawn.people.forEach(p => Object.assign(p, { is_pep: false }));
  Object.assign(drawn.customer, { status: 'ONBOARDING', onboarded_at: null, next_review_at: null });
  const made = memberRows({ ...drawn, created: when, offboardedAt: null });
  made.forEach(({ individual, member }) => {
    rows.individuals.push(individual);
    rows.customer_members.push(member);
  });
  rows.customers.push(drawn.customer);
  state.drawn.set(drawn.customer.id, drawn);

  return {
    customer: drawn.customer,
    business: null,
    individuals: made.map(m => m.individual),
    customer_members: made.map(m => m.member),
    business_members: [],
    businesses: [],
  };
}

/** The applicant's rows dated from the moment it applied. */
function dateApplicant(state, parts, opened) {
  const { customer } = parts;
  Object.assign(customer, {
    created_at: iso(opened),
    updated_at: iso(opened),
    reference: customerReference(state, opened.getUTCFullYear()),
  });
  parts.individuals.forEach(p => {
    adultOn(p, opened);
    Object.assign(p, { created_at: iso(opened), updated_at: iso(opened) });
  });
  parts.customer_members.forEach(m => Object.assign(m, { since: isoDate(opened) }));
  parts.businesses.forEach(b =>
    Object.assign(b, { created_at: iso(opened), updated_at: iso(opened) }),
  );
  parts.business_members.forEach(m => Object.assign(m, { since: isoDate(opened) }));
}

/** The rating the case file suggests (case-file.ts); a synthetic identity is high risk. */
function ratingOf(state, app, parts) {
  if (app.outcome === 'FRAUD') return 'HIGH';
  if (parts.business) return companyRating(parts.business);

  return applicantRating(parts.individuals, parts.customer);
}

/** A synthetic applicant: the wave's phone series, its postal area, the app. */
function waveApplicant(state, parts) {
  const n = state.waveCount;
  state.waveCount += 1;
  parts.individuals.forEach(p =>
    Object.assign(p, {
      phone: `+33 7 56 41 2${n % 10} ${String(10 + ((n * 7) % 89)).padStart(2, '0')}`,
      address_line1: `${3 + n * 4} ${WAVE.street}`,
      address_line2: null,
      postal_code: WAVE.postal,
      city: WAVE.city,
      country: 'FR',
      country_of_residence: 'FR',
    }),
  );
  Object.assign(parts.customer, { onboarding_channel: 'APP' });
}

/** The company once decided: card acceptance and who owns and runs it, as KYB left them. */
function companyDecided(app, parts, decider) {
  const approved = app.outcome === 'APPROVED';

  // Card acceptance is decided at onboarding: granted with the company, asked otherwise. A new
  // merchant has no chargeback history yet.
  if (!approved) {
    requestedOnly(parts.business);
  } else if (NOW.getTime() - app.decided < 90 * DAY) {
    Object.assign(parts.business, { chargeback_ratio: null });
  }

  // KYB confirmed who owns and runs the company (and its holding) on the day it was approved.
  parts.business_members.forEach(m =>
    Object.assign(m, {
      verified: approved,
      verified_by: approved ? decider : null,
      verified_at: approved ? isoDate(app.decided) : null,
    }),
  );
}

/** The customer once decided: active from the approval, declined, or a prospect again. */
function decideCustomer(state, app, parts, decider, reason) {
  const { customer } = parts;
  const approved = app.outcome === 'APPROVED';
  const cycle = CYCLE_DAYS[customer.risk_rating] * DAY;
  const status = approved ? 'ACTIVE' : customerStatusAfter(app.code);
  Object.assign(customer, {
    status,
    onboarded_at: approved ? isoDate(app.decided) : null,
    next_review_at: approved ? isoDate(new Date(app.decided.getTime() + cycle)) : null,
    updated_at: iso(app.decided),
  });
  const steps = [
    ['PROSPECT', app.opened, 'customer'],
    ['ONBOARDING', new Date(app.opened.getTime() + MINUTE), 'customer'],
  ];

  if (approved) {
    steps.push(['ACTIVE', app.decided, 'system', app.auto ? AUTO_NOTE : 'KYC approved']);
  } else {
    steps.push([status, app.decided, decider, reason]);
  }

  trail(state.rows, 'CUSTOMERS', customer, steps);
  if (parts.business) companyDecided(app, parts, decider);
}

/** The phone or browser an applicant applied from; access ends with a refusal. */
function applicationDevice(state, app, person) {
  const wave = app.outcome === 'FRAUD';
  let kind = weighted([
    [['IOS', 'iPhone 15'], 55],
    [['ANDROID', 'Samsung Galaxy S23'], 45],
  ]);
  if (app.channel === 'WEB') kind = ['WEB', pick(['Chrome on Windows', 'Safari on macOS'])];
  if (wave) kind = ['ANDROID', WAVE.device];
  const [platform, name] = kind;
  let version = platform === 'WEB' ? null : `7.${between(10, 14)}.${between(0, 5)}`;
  if (wave) version = WAVE.version;
  state.rows.devices.push({
    ...blank('devices'),
    id: uuid(),
    individual_id: person.id,
    fingerprint: wave
      ? WAVE.fingerprint
      : createHash('md5').update(`${person.id}:device`).digest('hex'),
    platform,
    device_name: name,
    app_version: version,
    first_seen_at: iso(app.opened),
    last_seen_at: iso(app.sent ? at(app.sent, between(2, 30)) : at(app.opened, 0.3)),
    is_trusted: false,
    revoked_at: app.code === 'NO_RESPONSE' ? null : iso(app.decided),
  });
}

// ---- the case and its papers ----------------------------------------------------------------------

const docsOf = (state, kyc) => state.rows.documents.filter(d => d.kyc_case_id === kyc.id);

/** The company papers, checked against the INPI register (the check the KYB workflow runs, same
 * request number). */
function registerStamp(state, kyc, business, by, when) {
  const id = `RNE-${createHash('md5')
    .update(String(business.id))
    .digest('hex')
    .slice(0, 10)
    .toUpperCase()}`;
  docsOf(state, kyc)
    .filter(d => COMPANY_PAPERS.includes(d.document_type) && d.verified_at)
    .forEach(d =>
      Object.assign(d, { provider_check_id: id, verified_by: by, verified_at: iso(when) }),
    );

  return id;
}

/** One status line of a request, after the ones informationRequest wrote. */
function requestLine(state, rfi, from, to, when, by, reason?) {
  state.rows.status_changes.push({
    id: uuid(),
    record_type: 'INFORMATION_REQUESTS',
    record_id: rfi.id,
    field: 'status',
    old_value: from,
    new_value: to,
    changed_by: by,
    changed_at: iso(when),
    reason: reason || null,
  });
}

/** A question the client answered with the paper asked, which then passed. */
function answeredRequest(state, kyc, person, app, topic, paper) {
  const rfi = informationRequest(state.ctx, kyc, person, app.sent, 'SENT', topic);
  const late = app.answered - app.sent > 3 * DAY;
  Object.assign(rfi, {
    status: 'ANSWERED',
    answered_at: iso(app.answered),
    answer: ANSWERS[topic],
    reminders_sent: late ? 1 : 0,
    last_reminder_at: late ? iso(at(app.sent, 72)) : null,
  });
  requestLine(state, rfi, 'SENT', 'ANSWERED', app.answered, 'customer');
  const read = workMoment(at(app.answered, 0.5));
  documentRow(state.ctx, kyc, {
    information_request_id: rfi.id,
    source: rfi.channel === 'EMAIL' ? 'EMAIL' : 'CUSTOMER_APP',
    uploaded_at: rfi.answered_at,
    ...paper,
    ...checked(read < app.decided ? read : app.decided, kyc.assigned_to),
  });
}

/** A question nobody answered: overdue, then cancelled when the case closes. */
function unansweredRequest(state, kyc, person, app, topic) {
  const rfi = informationRequest(state.ctx, kyc, person, app.sent, 'OVERDUE', topic);
  const why = 'Application closed: no answer from the applicant.';
  Object.assign(rfi, { status: 'CANCELLED', cancel_reason: why });
  requestLine(state, rfi, 'OVERDUE', 'CANCELLED', app.decided, kyc.assigned_to, why);
}

/** The IDs, selfies and proofs of address of the people on the case, checked at `when`. */
function peoplePapers(state, kyc, people, app, by, when = app.review) {
  return people.map(p =>
    personDocuments(state.ctx, kyc, p, at(app.opened, 0.02), when, by, 'done'),
  );
}

/** KYB: the beneficial owners' IDs, the company papers checked against the INPI register. */
function companyReview(state, app, kyc, business, people, by) {
  const owners = beneficialOwners(state.ctx, business).filter(Boolean);
  peoplePapers(
    state,
    kyc,
    owners.filter(o => !people.some(p => p.id === o.id)),
    app,
    by,
  );
  companyDocuments(state.ctx, kyc, business, at(app.opened, 0.05), app.review, by, true);
  const rne = registerStamp(state, kyc, business, by, app.review);
  const named = owners.length
    ? owners.map(o => `${o.first_name} ${o.last_name}`).join(', ')
    : 'none above 25%, the director as legal representative';
  Object.assign(kyc, {
    notes: `INPI register ${rne}: the company matches our file. Beneficial owners (RBE): ${named}.`,
  });
}

/** The paper asked on the way, an old proof of address or a Kbis older than the register
 * accepts, and the new one the client sent. */
function askedPaper(state, app, kyc, business, people, by) {
  const topic = business ? 'BUSINESS_KBIS' : 'PROOF_OF_ADDRESS';
  const old = docsOf(state, kyc).find(d =>
    business
      ? d.document_type === 'COMPANY_REGISTRATION'
      : d.document_type === 'PROOF_OF_ADDRESS' && d.individual_id === people[0].id,
  );
  failPaper(old, business ? OLD_KBIS : OLD_ADDRESS, app.review, by);
  old.issued_at = iso(new Date(toDate(old.uploaded_at).getTime() - between(100, 160) * DAY));
  answeredRequest(state, kyc, people[0], app, topic, {
    individual_id: business ? null : people[0].id,
    business_id: business ? business.id : null,
    document_type: old.document_type,
    document_number: old.document_number,
    issuing_country: old.issuing_country,
    issued_at: iso(new Date(app.answered.getTime() - between(1, 12) * DAY)),
    file_name: business ? 'kbis.pdf' : 'justificatif_domicile.pdf',
    provider_check_id: business ? old.provider_check_id : null,
  });
}

/** Papers checked, maybe a question on the way: the file the approval rests on. */
function approvedCase(state, app, kyc, parts, by) {
  const { customer, business } = parts;
  const people = payers(state.ctx, customer);
  // A system approval reads the provider's checks the minute they come back.
  const when = app.auto ? new Date(app.opened.getTime() + 5 * MINUTE) : app.review;
  const papers = peoplePapers(state, kyc, people, app, by, when);
  papers.forEach((docs, k) => {
    const member = (state.ctx.membersOf.get(customer.id) || []).find(
      m => m.individual_id === people[k].id,
    );
    if (member) member.proof_document_id = docs[0].id;
  });
  if (business) companyReview(state, app, kyc, business, people, by);
  if (app.sent) askedPaper(state, app, kyc, business, people, by);
}

/** Why the case was declined, its papers saying the same. */
function declinedCase(state, app, kyc, parts, by) {
  const { customer, business } = parts;
  const people = payers(state.ctx, customer);
  const [first] = peoplePapers(state, kyc, people, app, by);
  const paper = type => first.find(d => d.document_type === type);

  if (business) {
    companyDocuments(state.ctx, kyc, business, at(app.opened, 0.05), app.review, by, true);
    registerStamp(state, kyc, business, by, app.review);
  }

  const id = first[0];

  if (app.code === 'SYNTHETIC_IDENTITY') {
    failPaper(id, REFUSAL.SYNTHETIC_IDENTITY, app.review, by);
    if (paper('SELFIE')) failPaper(paper('SELFIE'), LIVENESS, app.review, by);
    kyc.notes = `Synthetic identity wave: the device, phone series and postal area (${WAVE.postal}) of other applications.`;

    return refusalReason(app.code);
  }

  if (app.code === 'IDENTITY_FAILED') {
    [id, paper('SELFIE')]
      .filter(Boolean)
      .forEach(d => failPaper(d, REFUSAL.IDENTITY_FAILED, app.review, by));
  }

  if (app.code === 'DOCUMENT_FORGED') {
    failPaper(paper('PROOF_OF_ADDRESS'), REFUSAL.DOCUMENT_FORGED, app.review, by);
  }

  if (app.code === 'UBO_MISMATCH') {
    const ubo = docsOf(state, kyc).find(d => d.document_type === 'UBO_DECLARATION');
    failPaper(ubo, REFUSAL.UBO_MISMATCH, app.review, by);
  }

  return refusalReason(app.code, pick(RISK_APPETITE[customer.customer_type]));
}

/** Papers sent but one missing, asked for and never sent. */
function silentCase(state, app, kyc, parts, by) {
  const { customer, business } = parts;
  const people = payers(state.ctx, customer);
  const [first] = peoplePapers(state, kyc, people, app, by);

  if (business) {
    companyDocuments(
      state.ctx,
      kyc,
      business,
      at(app.opened, 0.05),
      app.review,
      by,
      true,
      'no_ubo',
    );
    registerStamp(state, kyc, business, by, app.review);
    unansweredRequest(state, kyc, people[0], app, 'BUSINESS_UBO');

    return refusalReason(app.code);
  }

  const proof = first.find(d => d.document_type === 'PROOF_OF_ADDRESS');
  state.rows.documents.splice(state.rows.documents.indexOf(proof), 1);
  unansweredRequest(state, kyc, people[0], app, 'PROOF_OF_ADDRESS');

  return refusalReason(app.code);
}

/** The case's history, from its opening to its decision. */
function caseSteps(app, kyc, by, decider) {
  if (app.auto) {
    return [
      ['OPEN', app.opened],
      ['APPROVED', app.decided, 'system', AUTO_NOTE],
    ];
  }

  const steps = [
    ['OPEN', app.opened],
    ['IN_REVIEW', app.review, by],
  ];
  if (app.sent) steps.push(['WAITING_CUSTOMER', app.sent, by, 'Documents asked from the client']);
  if (app.answered) steps.push(['IN_REVIEW', app.answered, 'system', 'Client answered']);
  if (app.signoff) steps.push(['PENDING_APPROVAL', app.signoff, by, SIGNOFF_REASON]);
  steps.push([kyc.status, app.decided, decider, kyc.rejection_reason]);

  return steps;
}

/** The onboarding case of one application, its papers, questions and history. */
function onboardingCase(state, app, parts) {
  const { customer, business } = parts;
  const approved = app.outcome === 'APPROVED';
  const by = app.auto ? AUTO : op('onboarding');
  const decider = app.signoff || app.outcome === 'FRAUD' ? op('l2') : by;
  const kyc = kycCase(state.ctx, customer, {
    status: approved ? 'APPROVED' : 'REJECTED',
    opened_at: iso(app.opened),
    due_at: iso(onboardingDue(app.opened, business)),
    assigned_to: app.auto ? null : by,
    decided_by: decider,
    resolved_at: iso(app.decided),
    escalated_at: app.signoff ? iso(app.signoff) : null,
    escalation_reason: app.signoff ? SIGNOFF_REASON : null,
    risk_after: approved ? customer.risk_rating : null,
    rejection_code: approved ? null : app.code,
  });
  let reason = null;
  if (approved) approvedCase(state, app, kyc, parts, by);
  else if (app.code === 'NO_RESPONSE') reason = silentCase(state, app, kyc, parts, by);
  else reason = declinedCase(state, app, kyc, parts, by);
  kyc.rejection_reason = reason;
  trail(state.rows, 'KYC_CASES', kyc, caseSteps(app, kyc, by, decider));
  decideCustomer(state, app, parts, decider, reason);
  if (app.outcome === 'FRAUD') state.wave.push({ app, kyc, customer });

  return kyc;
}

// ---- the investigation behind the synthetic identity wave ------------------------------------------

/** The next number of a series this year, after the highest one given so far. */
function nextReference(list, prefix) {
  const year = String(NOW.getUTCFullYear());
  const start = `${prefix}-${year}-`;
  const top = list
    .map(r => r.reference)
    .filter(r => r && r.startsWith(start))
    .reduce((max, r) => Math.max(max, Number(r.slice(start.length))), 100);

  return `${start}${String(top + between(1, 2)).padStart(6, '0')}`;
}

/** The wave's cases, one investigation (identity fraud, from the KYC desk) and a SAR draft that
 * waits for the MLRO. No account was opened: nothing to freeze. */
function waveInvestigation(state) {
  const { rows } = state;
  const cases = state.wave.sort((a, b) => a.app.opened - b.app.opened);
  if (!cases.length) return;
  const first = cases[0];
  const last = cases[cases.length - 1];
  const analyst = op('l2');
  const opened = workMoment(at(first.app.decided, between(2, 20)));
  const toMlro = workBefore(new Date(NOW.getTime() - between(2, 5) * DAY));
  const summary =
    `Synthetic identity wave: ${cases.length} applications in two weeks from one device ` +
    `(${WAVE.device}, fingerprint ${WAVE.fingerprint.slice(
      0,
      12,
    )}…), phone numbers in one series ` +
    `and addresses in ${WAVE.city} (${WAVE.postal}). All declined at onboarding; no account opened.`;
  const inv = {
    ...blank('investigations'),
    id: uuid(),
    reference: nextReference(rows.investigations, 'INV'),
    customer_id: first.customer.id,
    type: 'IDENTITY_FRAUD',
    origin: 'KYC_ESCALATION',
    origin_kyc_case_id: first.kyc.id,
    status: 'PENDING_MLRO',
    assigned_to: analyst,
    opened_at: iso(opened),
    due_at: iso(new Date(opened.getTime() + 30 * DAY)),
    summary,
    sent_to_mlro_at: iso(toMlro),
    priority: 'HIGH',
  };
  rows.investigations.push(inv);
  cases.forEach(({ kyc }) => Object.assign(kyc, { investigation_id: inv.id }));
  trail(rows, 'INVESTIGATIONS', inv, [
    ['OPEN', opened, analyst],
    ['IN_PROGRESS', workMoment(at(opened, 2)), analyst],
    ['PENDING_MLRO', toMlro, analyst, 'SAR draft ready for the MLRO'],
  ]);
  const drafted = workBefore(at(toMlro, -between(2, 20)));
  const sar = {
    ...blank('sar_reports'),
    id: uuid(),
    reference: nextReference(rows.sar_reports, 'SAR'),
    customer_id: first.customer.id,
    investigation_id: inv.id,
    activity_type: 'SUSPICIOUS_PATTERN',
    activity_start_date: isoDate(first.app.opened),
    activity_end_date: isoDate(last.app.decided),
    total_amount: 0,
    transaction_count: 0,
    currency: 'EUR',
    narrative: `${summary} Attempted account openings with forged identities; the applicants never became customers.`,
    status: 'DRAFT',
    created_at: iso(drafted),
    updated_at: iso(toMlro),
  };
  rows.sar_reports.push(sar);
  trail(rows, 'SAR_REPORTS', sar, [['DRAFT', drafted, analyst]]);
}

// ---- accounts and money, once approved -------------------------------------------------------------

/** Account numbers after the highest the bank gave. */
function accountNumbers(rows) {
  let top = rows.accounts.reduce(
    (max, a) => Math.max(max, Number(a.iban.replace(/ /g, '').slice(14, 25))),
    0,
  );

  return () => {
    top += between(7, 91);

    return top;
  };
}

/** An account opens after the approval, never after now. */
function openAfter(account, decided) {
  const latest = NOW.getTime() - 10 * MINUTE;
  const wanted = toDate(account.opened_at).getTime();
  const opened = Math.max(decided.getTime() + between(1, 20) * MINUTE, Math.min(wanted, latest));
  Object.assign(account, { opened_at: iso(new Date(Math.min(opened, latest))) });
  account.last_activity_at = account.opened_at;
}

function openAccounts(state, app, customer, nextNumber) {
  const { rows } = state;

  if (app.business) {
    const account = {
      ...blank('accounts'),
      id: uuid(),
      customer_id: customer.id,
      iban: frenchIban(nextNumber()),
      bic: BIC,
      name: 'Compte professionnel',
      purpose: 'BUSINESS_OPERATIONS',
      type: 'BUSINESS',
      currency: 'EUR',
      plan: 'BUSINESS_PRO',
      balance: 0,
      available_balance: 0,
      overdraft_limit: pick([0, 0, 5000]),
      status: 'ACTIVE',
      opened_at: iso(at(app.decided, between(1, 48))),
    };
    openAfter(account, app.decided);
    rows.accounts.push(account);

    return;
  }

  const drawn = state.drawn.get(customer.id);
  // Drawn as if approved before today, so the current account is never left out; it opens after
  // the approval all the same (openAfter).
  const created = new Date(Math.min(app.decided.getTime(), TODAY.getTime() - 2 * HOUR));
  accountRows({ ...drawn, created }, nextNumber).forEach(account => {
    openAfter(account, app.decided);
    rows.accounts.push(account);
  });
}

/** Payees are added and mandates signed before they are used, and never after now. */
function datesBeforeUse(state, customers) {
  const { rows } = state;
  const opened = new Map(
    rows.accounts.filter(a => customers.has(a.customer_id)).map(a => [a.customer_id, a.opened_at]),
  );
  const firstUse = new Map();
  const txAt = new Map(rows.transactions.map(t => [t.id, t.created_at]));
  rows.outgoing_transfers.forEach(r => {
    const when = txAt.get(r.transaction_id);

    if (when && (!firstUse.has(r.beneficiary_id) || when < firstUse.get(r.beneficiary_id))) {
      firstUse.set(r.beneficiary_id, when);
    }
  });
  rows.sct_beneficiaries
    .filter(b => customers.has(b.customer_id))
    .forEach(b => {
      const start = toDate(opened.get(b.customer_id)).getTime();
      const end = toDate(firstUse.get(b.id) || iso(NOW)).getTime();
      b.added_at = iso(new Date(start + (end - start) * (0.2 + rand() * 0.6)));
    });
  rows.mandates
    .filter(m => customers.has(m.customer_id) && toDate(m.signed_at) > NOW)
    .forEach(m =>
      Object.assign(m, { signed_at: iso(new Date(NOW.getTime() - between(2, 20) * HOUR)) }),
    );
}

// ---- references in date order ---------------------------------------------------------------------

/** PREFIX-YEAR-NUMBER again in date order; the history lines quoting one follow. */
function renumber(rows, list, prefix, dateField) {
  const counters = {};
  const moved = new Map();
  list
    .slice()
    .sort((a, b) => (a[dateField] < b[dateField] ? -1 : 1))
    .forEach(row => {
      const year = row[dateField].slice(0, 4);
      counters[year] = (counters[year] || between(120, 480)) + between(1, 2);
      const reference = `${prefix}-${year}-${String(counters[year]).padStart(6, '0')}`;
      if (row.reference && row.reference !== reference) moved.set(row.reference, reference);
      Object.assign(row, { reference });
    });
  const quoted = new RegExp(`\\b${prefix}-\\d{4}-\\d{6}\\b`, 'g');
  rows.status_changes.forEach(c => {
    if (c.reason && c.reason.includes(`${prefix}-`)) {
      Object.assign(c, { reason: c.reason.replace(quoted, r => moved.get(r) || r) });
    }
  });
}

// ---- putting it together ----------------------------------------------------------------------------

/** One planned decision: its applicant, rating, moments and rows (not yet its case). */
function prepare(state, app) {
  const parts = applicant(state, app.business, app.decided);
  if (app.outcome === 'FRAUD') waveApplicant(state, parts);
  // A partner's applications (lagoon-history.ts) all come through the partner's app.
  if (state.channel) Object.assign(parts.customer, { onboarding_channel: state.channel });
  const rating = ratingOf(state, app, parts);
  Object.assign(parts.customer, { risk_rating: rating });
  app.channel = parts.customer.onboarding_channel;
  app.code = null;
  if (app.outcome === 'NO_RESPONSE') app.code = 'NO_RESPONSE';
  if (['DECLINED', 'FRAUD'].includes(app.outcome)) app.code = refusal(app.outcome, app.business);
  // The system approves only clean, low-risk retail applications made in the app or on the web.
  app.auto =
    app.outcome === 'APPROVED' &&
    !app.business &&
    rating === 'LOW' &&
    ['APP', 'WEB'].includes(app.channel) &&
    chance(AUTO_SHARE);
  caseMoments(app, { auto: app.auto, senior: SENIOR_RISKS.includes(rating) });
  // A system approval asks nothing; a question would have sent it to a person.
  if (app.auto) Object.assign(app, { sent: null, answered: null, signoff: null });
  dateApplicant(state, parts, app.opened);

  return parts;
}

/**
 * `plan` lists the decisions to build (plannedDecisions by default) and `channel` forces the
 * channel they came through: lagoon-history.ts decides a partner's applications the same way.
 */
function onboardingFunnel(rows, { plan = plannedDecisions, channel = null } = {}) {
  const state: Record<string, any> = {
    rows,
    channel,
    references: new Set(rows.customers.map(c => c.reference)),
    drawn: new Map(),
    wave: [],
    waveCount: 0,
  };
  const businessesBefore = rows.businesses.length;
  const planned = plan().map(app => ({ app, parts: prepare(state, app) }));
  const added = rows.businesses.slice(businessesBefore);
  state.ctx = context(rows, new Map());
  planned.forEach(({ app, parts }) => onboardingCase(state, app, parts));
  // Applicants who stopped or were refused keep the device they applied from.
  planned
    .filter(({ app }) => app.outcome !== 'APPROVED' && ['APP', 'WEB'].includes(app.channel))
    .forEach(({ app, parts }) =>
      parts.individuals.slice(0, 1).forEach(p => applicationDevice(state, app, p)),
    );
  waveInvestigation(state);

  const nextNumber = accountNumbers(rows);
  const approved = planned.filter(({ app }) => app.outcome === 'APPROVED');
  approved.forEach(({ app, parts }) => openAccounts(state, app, parts.customer, nextNumber));

  const shared = sharedOf(rows);
  const newPeople = rows.individuals.filter(p => !shared.people.has(p.id));
  newPeople.forEach(p => shared.people.set(p.id, p));
  added.forEach(b => shared.businesses.set(b.id, b));
  approved
    .map(({ parts }) => customerBanking(rows, parts.customer, shared, { newcomer: true }))
    .filter(Boolean)
    .forEach(ctx => closeTheBooks(rows, ctx));
  added.forEach(b => delete b.monthlyRevenue);
  datesBeforeUse(state, new Set(approved.map(({ parts }) => parts.customer.id)));

  const active = new Set(approved.map(({ parts }) => parts.customer.id));
  const people = new Map(newPeople.map(p => [p.id, p]));
  newcomerDevices(
    rows,
    rows.customer_members
      .filter(m => active.has(m.customer_id))
      .map(m => people.get(m.individual_id))
      .filter(Boolean),
  );

  renumber(rows, rows.kyc_cases, 'KYC', 'opened_at');
  renumber(rows, rows.information_requests, 'RFI', 'created_at');

  return planned.map(({ app }) => app);
}

export { AUTO, decisionIn, holidayWeek, onboardingFunnel, renumber };
