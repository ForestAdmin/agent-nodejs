/**
 * Lagoon at the bank: a fictional partner neobank whose customers apply on its own site and
 * reach our KYC team through "Submit application". Its own back office reads its clients through
 * Forest's Gateway API, scoped on `partner`.
 *
 * - History: Lagoon went live 18 weeks ago with about 3 applications a week, now 5 or 6 (fewer in
 *   mid-August). Each is decided like the funnel's (onboarding-funnel.js, same code): by the desk on
 *   working days, approved about 7 times in 10 (the approved ones get their accounts and statement),
 *   declined, or closed when the applicant stops answering. Never approved by the system: a partner
 *   application always meets a person.
 * - Open backlog: 7 applications, from 2 hours to 7 days old: new ones with clean papers, an ID
 *   Onfido will refuse (name differs), a proof of address never sent, one under review with every
 *   paper checked, two waiting on the client for a proof of address.
 * - Partners on every row: customers, their cases and their documents carry `partner`. The bank's
 *   older partner customers belong to Tidewell (retail) or Fernway (business), so a partner scope
 *   has something to leave out. Partner onboarding cases name the partner in their notes, as
 *   "Submit application" writes them.
 *
 * Built last, on a seeded stream of its own (seed/index.js withStream), so nothing drawn before moves.
 */
import { createHash } from 'crypto';

import {
  context,
  informationRequest,
  kycCase,
  onboardingDue,
  op,
  personDocuments,
  trail,
} from './crime';
import { decisionIn, holidayWeek, onboardingFunnel, renumber } from './onboarding-funnel';
import {
  DAY,
  NOW,
  between,
  iso,
  parisMonday,
  parisParts,
  parisTime,
  random as rand,
  scanFlaw,
  weighted,
  workMoment,
} from './random';
import { memberRows, newCustomer } from './retail';
import { applicantRating } from '../customizations/shared/case-file';

const PARTNER = 'Lagoon';
const HOUR = 3600 * 1000;
const MINUTE = 60 * 1000;
const WEEKS = 18;
// The bank's partners before Lagoon, by the kind of customer they bring.
const OTHER_PARTNERS = { RETAIL: 'Tidewell', BUSINESS: 'Fernway' };
const PREFIX = { Lagoon: 'LGN', Tidewell: 'TDW', Fernway: 'FNW' };
// The open applications: status, hours since the customer applied, what the file holds.
const BACKLOG: [string, number, string][] = [
  ['OPEN', 2, 'clean'],
  ['OPEN', 19, 'clean'],
  ['OPEN', 31, 'failed_id'],
  ['OPEN', 53, 'no_address'],
  ['IN_REVIEW', 76, 'checked'],
  ['WAITING_CUSTOMER', 98, 'asked'],
  ['WAITING_CUSTOMER', 170, 'asked'],
];

const at = (date, hours) => new Date(date.getTime() + hours * HOUR);
const hashHex = text => createHash('md5').update(String(text)).digest('hex');

// ---- the decided history -----------------------------------------------------------------------

/** Lagoon's decisions, week by week since it went live (the funnel's plan format). */
function lagoonPlan() {
  const mp = parisParts(parisMonday(NOW));
  const latest = NOW.getTime() - 30 * MINUTE;
  const list = [];

  for (let k = WEEKS - 1; k >= 0; k -= 1) {
    const monday = parisTime(mp.y, mp.m, mp.d - 7 * k, 0);
    const grown = (WEEKS - 1 - k) / (WEEKS - 1);
    const holiday = holidayWeek(monday);
    const count = Math.max(2, Math.round((3 + 3 * grown) * (holiday ? 0.6 : 1) + rand() - 0.5));
    // The desk knows Lagoon's files better as weeks go by.
    const pace = (1.1 - 0.2 * grown) * (holiday ? 1.4 : 1);

    for (let i = 0; i < count; i += 1) {
      const outcome = weighted([
        ['APPROVED', 72],
        ['DECLINED', 18],
        ['NO_RESPONSE', 10],
      ]);
      const decided = decisionIn(monday);

      if (decided.getTime() <= latest) {
        list.push({ outcome, business: false, decided, monday, pace, wave: false });
      }
    }
  }

  return list.sort((a, b) => a.decided - b.decided);
}

// ---- the open backlog --------------------------------------------------------------------------

/** One applicant on their own (Lagoon opens individual accounts), applying `hours` ago. */
function backlogApplicant(rows, references, hours) {
  let drawn = newCustomer();
  while (drawn.people.length > 1) drawn = newCustomer();
  const opened = new Date(NOW.getTime() - hours * HOUR - between(0, 50) * MINUTE);
  drawn.people.forEach(p => Object.assign(p, { is_pep: false }));
  let reference;
  do reference = `CUS-${opened.getUTCFullYear()}-${String(between(1, 999999)).padStart(6, '0')}`;
  while (references.has(reference));
  references.add(reference);
  Object.assign(drawn.customer, {
    status: 'ONBOARDING',
    onboarded_at: null,
    next_review_at: null,
    onboarding_channel: 'PARTNER',
    partner: PARTNER,
    reference,
    created_at: iso(opened),
    updated_at: iso(opened),
  });
  rows.customers.push(drawn.customer);
  const made = memberRows({ ...drawn, created: opened, offboardedAt: null });
  made.forEach(({ individual, member }) => {
    rows.individuals.push(individual);
    rows.customer_members.push(member);
  });
  // The rating the case file suggests, as the funnel's applicants get (case-file.js).
  Object.assign(drawn.customer, {
    risk_rating: applicantRating(
      made.map(m => m.individual),
      drawn.customer,
    ),
  });
  trail(rows, 'CUSTOMERS', drawn.customer, [
    ['PROSPECT', opened, 'customer'],
    ['ONBOARDING', new Date(opened.getTime() + MINUTE), 'customer'],
  ]);

  return { customer: drawn.customer, opened };
}

/** A working moment `hours` after `date`, never later than a few minutes ago. */
function pickedUp(date, hours) {
  const moment = workMoment(at(date, hours));
  const latest = new Date(NOW.getTime() - 20 * MINUTE);

  return moment < latest ? moment : latest;
}

/** An ID whose scan shows `flaw` (random.js scanFlaw): its id derived from the drawn one. */
function withScan(doc, flaw) {
  let { id } = doc;

  while (scanFlaw(id) !== flaw) {
    const h = hashHex(id);
    id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(
      20,
      32,
    )}`;
  }

  Object.assign(doc, { id, file_url: doc.file_url.replace(/\/[^/]+\/([^/]+)$/, `/${id}/$1`) });
}

function backlogCase(ctx, { customer, opened }, [status, , file]) {
  const person = ctx.people.get(ctx.membersOf.get(customer.id)[0].individual_id);
  const reviewed = status !== 'OPEN';
  const by = reviewed ? op('onboarding') : null;
  const review = reviewed ? pickedUp(opened, between(1, 5)) : null;
  const kyc = kycCase(ctx, customer, {
    status,
    opened_at: iso(opened),
    due_at: iso(onboardingDue(opened, false)),
    assigned_to: by,
    updated_at: iso(review || opened),
  });
  const given = reviewed ? 'done' : 'clean';
  const docs = personDocuments(ctx, kyc, person, at(opened, 0.1), review || opened, by, given);
  const id = docs[0];
  if (file === 'failed_id') withScan(id, 'name');
  const steps = [['OPEN', opened]];
  if (review) steps.push(['IN_REVIEW', review, by]);

  if (file === 'no_address' || file === 'asked') {
    const proof = docs.find(d => d.document_type === 'PROOF_OF_ADDRESS');
    ctx.rows.documents.splice(ctx.rows.documents.indexOf(proof), 1);
  }

  if (file === 'asked') {
    const sent = pickedUp(review, between(1, 3));
    const late = NOW.getTime() - sent.getTime() > 7 * DAY;
    informationRequest(ctx, kyc, person, sent, late ? 'OVERDUE' : 'SENT', 'PROOF_OF_ADDRESS');
    Object.assign(kyc, { updated_at: iso(sent) });
    steps.push(['WAITING_CUSTOMER', sent, by, 'Documents asked from the client']);
  }

  trail(ctx.rows, 'KYC_CASES', kyc, steps);

  return kyc;
}

function openBacklog(rows) {
  const references = new Set(rows.customers.map(c => c.reference));
  const applicants = BACKLOG.map(([, hours]) => backlogApplicant(rows, references, hours));
  const ctx = context(rows, new Map());
  applicants.forEach((applicant, i) => backlogCase(ctx, applicant, BACKLOG[i]));
}

// ---- partners on every row ---------------------------------------------------------------------

/**
 * `partner` on each partner customer, its cases and its documents; its onboarding cases name the
 * partner in their notes like "Submit application" does. No random draw.
 */
function stampPartners(rows) {
  const partnerOf = new Map();
  rows.customers.forEach(c => {
    let partner = c.partner || null;
    if (!partner && c.onboarding_channel === 'PARTNER') partner = OTHER_PARTNERS[c.customer_type];
    Object.assign(c, { partner });
    if (partner) partnerOf.set(c.id, partner);
  });
  rows.kyc_cases.forEach(k => {
    const partner = partnerOf.get(k.customer_id) || null;
    Object.assign(k, { partner });
    if (!partner || k.type !== 'ONBOARDING' || k.channel !== 'PARTNER') return;
    const application = `${PREFIX[partner]}-${hashHex(k.id).slice(0, 6).toUpperCase()}`;
    const line = `Partner: ${partner} · application ${application}`;
    Object.assign(k, { notes: k.notes ? `${line}. ${k.notes}` : line });
  });
  rows.documents.forEach(d => Object.assign(d, { partner: partnerOf.get(d.customer_id) || null }));
}

function lagoonHistory(rows) {
  const before = new Set(rows.customers.map(c => c.id));
  onboardingFunnel(rows, { plan: lagoonPlan, channel: 'PARTNER' });
  rows.customers
    .filter(c => !before.has(c.id))
    .forEach(c => Object.assign(c, { partner: PARTNER }));
  openBacklog(rows);
  renumber(rows, rows.kyc_cases, 'KYC', 'opened_at');
  renumber(rows, rows.information_requests, 'RFI', 'created_at');
  stampPartners(rows);
}

export { OTHER_PARTNERS, PARTNER, lagoonHistory, stampPartners };
