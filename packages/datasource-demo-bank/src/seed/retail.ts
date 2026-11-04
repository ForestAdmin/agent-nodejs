/** Retail customers: the people behind them, their memberships and their accounts. */
import {
  DAY,
  TODAY,
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
  uniqueName,
  uuid,
  weighted,
  withTime,
} from './random';
import {
  BAND_MIN_AGE,
  BIC,
  COUNTRIES,
  FRENCH_ONLY_EMPLOYERS,
  JOBS,
  LANGUAGE,
  MANAGERS,
  MONTHLY_NET,
  OTHER_NATIONALITIES,
  frenchIban,
} from './reference';

// ---- generation ----------------------------------------------------------------------------
const PAYMENT_PLANS = [
  ['STANDARD', 60],
  ['PREMIUM', 27],
  ['METAL', 13],
];
const OVERDRAFT = { STANDARD: 300, PREMIUM: 1000, METAL: 2500 };
const SOURCE_OF_FUNDS = {
  EMPLOYED: 'SALARY',
  SELF_EMPLOYED: 'BUSINESS_INCOME',
  RETIRED: 'PENSION',
  STUDENT: 'OTHER',
  UNEMPLOYED: 'SAVINGS',
};

function employmentStatus(age) {
  if (age >= 66) return 'RETIRED';
  if (age <= 23 && chance(0.7)) return 'STUDENT';

  return weighted([
    ['EMPLOYED', 75],
    ['SELF_EMPLOYED', 17],
    ['UNEMPLOYED', 8],
  ]);
}

function sourceOfWealth(band) {
  if (band !== 'ABOVE_120K' && band !== 'FROM_70K_TO_120K') return 'Savings from income';

  return pick([
    'Savings from salary',
    'Sale of a property',
    'Family inheritance',
    'Investment portfolio',
  ]);
}

function homeAddress(country) {
  const c = COUNTRIES[country];
  const [city, postal] = pick(c.cities);

  return { address_line1: `${between(1, 140)} ${pick(c.streets)}`, postal_code: postal, city };
}

function person(country, sex, lastName, home) {
  const c = COUNTRIES[country];
  const age = weighted([
    [between(18, 24), 10],
    [between(25, 40), 35],
    [between(41, 65), 38],
    [between(66, 88), 17],
  ]);
  const born = daysAgo(age * 365 + between(0, 364));
  const status = employmentStatus(age);
  // A job that fits the age, with an employer that hires where the person lives.
  const hiresHere = e => country === 'FR' || !FRENCH_ONLY_EMPLOYERS.has(e);
  const jobs = JOBS[status].filter(
    ([, band, list]) => age >= BAND_MIN_AGE[band] && (!list || list.some(hiresHere)),
  );
  const [occupation, band, list] = pick(jobs.length ? jobs : JOBS[status]);
  const employers = list && list.filter(hiresHere);
  const names = sex === 'M' ? c.male : c.female;

  // Nobody shares a full name. Past the plain first names: a compound one where it is usual
  // (Marie-Claire, in France and Belgium), never the same name twice; then another family name.
  const compound = () => {
    const one = pick(names);
    const other = pick(names.filter(n => n !== one));

    return `${one}-${other}`;
  };

  const candidate = k => {
    if (k < 30) return [pick(names), lastName];
    if (k < 50 && ['FR', 'BE'].includes(country)) return [compound(), lastName];

    return [pick(names), pick(c.last)];
  };

  const tried = new Map();
  const full = uniqueName(k => {
    const [given, family] = candidate(k);
    tried.set(`${given} ${family}`, [given, family]);

    return `${given} ${family}`;
  }, 90);
  const [firstName, familyName] = tried.get(full);
  const nationality = chance(0.88)
    ? country
    : pick(OTHER_NATIONALITIES.concat(Object.keys(COUNTRIES)));
  const birthCountry = COUNTRIES[nationality] ? nationality : country;
  const mailbox = pick(['gmail.com', 'outlook.com', 'yahoo.fr', 'proton.me']);

  return {
    first_name: firstName,
    last_name: familyName,
    date_of_birth: isoDate(born),
    nationality,
    place_of_birth: pick(COUNTRIES[birthCountry].cities)[0],
    country_of_residence: country,
    ...home,
    country,
    email: `${ascii(firstName)}.${ascii(familyName)}${between(1, 99)}@${mailbox}`.toLowerCase(),
    phone: c.phone(),
    is_pep: chance(0.012),
    is_sanctioned: false,
    occupation,
    employment_status: status,
    employer: employers ? pick(employers) : null,
    income_band: band,
    source_of_funds: chance(0.05) ? pick(['INHERITANCE', 'INVESTMENTS']) : SOURCE_OF_FUNDS[status],
    source_of_wealth: sourceOfWealth(band),
    tax_residence: country,
    tax_id: c.taxId(),
  };
}

/** The people behind one customer relationship: one holder, or two for a joint account. */
function household() {
  const country = weighted(Object.entries(COUNTRIES).map(([code, c]) => [code, c.weight]));
  const lastName = pick(COUNTRIES[country].last);
  const home = homeAddress(country);
  const sex = () => (chance(0.5) ? 'M' : 'F');
  const people = [person(country, sex(), lastName, home)];
  if (chance(0.15)) people.push(person(country, sex(), lastName, home));

  return { country, lastName, people };
}

/** Nobody becomes a customer before their 18th birthday, and nobody joins today. */
function customerSince(people) {
  const adultSince = Math.max(...people.map(p => eighteenth(p) + DAY));
  const drawn = Math.max(daysAgo(between(5, 6 * 365)).getTime(), adultSince + between(0, 90) * DAY);

  return withTime(new Date(Math.min(daysAgo(1).getTime(), drawn)));
}

/** KYC reviews come every 1, 2 or 3 years depending on risk: the next one still ahead. */
function nextReview(created, risk) {
  const cycle = { LOW: 3 * 365, MEDIUM: 2 * 365, HIGH: 365 }[risk] * DAY;
  const elapsed = Math.floor((TODAY.getTime() - created.getTime()) / cycle) + 1;

  return new Date(created.getTime() + elapsed * cycle);
}

function newCustomer() {
  const id = uuid();
  const { country, lastName, people } = household();
  const drawn = customerSince(people);
  const status = weighted([
    ['ACTIVE', 83],
    ['ONBOARDING', 6],
    ['PROSPECT', 3],
    ['SUSPENDED', 3],
    ['OFFBOARDED', 5],
  ]);
  // An application takes days, not years: whoever is still onboarding applied recently.
  const created = status === 'ONBOARDING' ? withTime(daysAgo(between(2, 20))) : drawn;
  const risk = people.some(p => p.is_pep)
    ? 'HIGH'
    : weighted([
        ['LOW', 72],
        ['MEDIUM', 24],
        ['HIGH', 4],
      ]);
  const income = people.reduce((sum, p) => sum + MONTHLY_NET[p.income_band], 0);
  const monthlyIn = round2(income * (0.9 + rand() * 0.2));
  const left = status === 'OFFBOARDED';
  const offboardedAt = left
    ? new Date(created.getTime() + rand() * (TODAY.getTime() - created.getTime()))
    : null;
  const lastChange = offboardedAt || withTime(daysAgo(between(1, 60)));
  // "Marie & Paul Durand"; a couple with two family names says both.
  const names = people.every(p => p.last_name === lastName)
    ? `${people.map(p => p.first_name).join(' & ')} ${lastName}`
    : people.map(p => `${p.first_name} ${p.last_name}`).join(' & ');

  return {
    customer: {
      id,
      reference: `CUS-${created.getUTCFullYear()}-${String(between(1, 999999)).padStart(6, '0')}`,
      display_name: names,
      customer_type: 'RETAIL',
      status,
      risk_rating: risk,
      referral_code: `${ascii(lastName).slice(0, 4).toUpperCase()}${between(1000, 9999)}`,
      expected_monthly_in: monthlyIn,
      expected_monthly_out: round2(monthlyIn * (0.8 + rand() * 0.2)),
      next_review_at: left ? null : isoDate(nextReview(created, risk)),
      preferred_language: country === 'BE' && chance(0.4) ? 'NL' : LANGUAGE[country],
      onboarding_channel: weighted([
        ['APP', 70],
        ['WEB', 20],
        ['BRANCH', 5],
        ['PARTNER', 5],
      ]),
      onboarded_at: ['PROSPECT', 'ONBOARDING'].includes(status)
        ? null
        : isoDate(new Date(created.getTime() + between(0, 5) * DAY)),
      relationship_manager:
        risk === 'HIGH' || chance(0.1) ? `${pick(MANAGERS)}@forest-lab-bank.fr` : null,
      created_at: iso(created),
      updated_at: iso(new Date(Math.max(created.getTime(), lastChange.getTime()))),
    },
    people,
    created,
    offboardedAt,
  };
}

function memberRows({ customer, people, created, offboardedAt }) {
  return people.map((p, position) => {
    const changed = Math.max(created.getTime(), daysAgo(between(1, 400)).getTime());
    const individual = {
      id: uuid(),
      ...p,
      created_at: iso(created),
      updated_at: iso(withTime(new Date(changed))),
      birth_name: position > 0 && chance(0.5) ? pick(COUNTRIES[p.country].last) : null,
      address_line2: chance(0.12)
        ? pick(['Appartement 12', 'Bâtiment B', '3e étage', 'Résidence Les Pins'])
        : null,
      is_us_person: chance(0.005),
    };
    const member = {
      id: uuid(),
      customer_id: customer.id,
      individual_id: individual.id,
      role: position === 0 ? 'HOLDER' : 'JOINT_HOLDER',
      can_initiate_payments: true,
      is_primary_contact: position === 0,
      proof_document_id: null,
      since: isoDate(created),
      until: offboardedAt ? isoDate(offboardedAt) : null,
    };

    return { individual, member };
  });
}

function accountStatus(customerStatus) {
  const status = { ACTIVE: 'ACTIVE', SUSPENDED: 'FROZEN', OFFBOARDED: 'CLOSED' }[customerStatus];

  return status === 'ACTIVE' && chance(0.03) ? 'DORMANT' : status;
}

function lastActivity(status, offboardedAt) {
  if (status === 'DORMANT') return withTime(daysAgo(between(400, 900)));
  if (status === 'CLOSED') return offboardedAt;

  return withTime(daysAgo(between(1, 20)));
}

function balance(status, type, monthlyIn) {
  if (status === 'CLOSED') return 0;
  if (type === 'SAVINGS') return round2(monthlyIn * (2 + rand() * 18));

  return round2(monthlyIn * (0.1 + rand() * 1.4));
}

// An AML freeze drawn here is lifted once the case behind it exists (crime.ts amlFreezes): an AML
// case alone gives no ground to freeze. Kept in the draw so the rest of the data does not move.
const FREEZE_REASONS = ['FRAUD_SUSPICION', 'AML_INVESTIGATION', 'AUTHORITY_REQUEST'];
// What the operator wrote when freezing, per reason.
const FREEZE_NOTES = {
  FRAUD_SUSPICION: 'Customer reported card payments they do not recognise; frozen pending review.',
  AML_INVESTIGATION: 'Precautionary freeze while the investigation is open.',
  AUTHORITY_REQUEST: 'Garnishment order received from the tax authority (SATD).',
};

/** What the account is for, consistent with its type: savings accounts save, current accounts spend. */
function accountPurpose(type, holder) {
  if (type === 'SAVINGS') return chance(0.25) ? 'INVESTMENT' : 'SAVINGS';

  return holder.employment_status === 'EMPLOYED' && chance(0.6) ? 'SALARY' : 'DAILY_BANKING';
}

function accountName(type, holders) {
  if (type === 'SAVINGS') return "Livret d'épargne";

  return holders > 1 ? 'Compte joint' : 'Compte courant';
}

/** One account of a customer, or null when it would only open in the future. */
function accountRow(type, plan, { customer, people, created, offboardedAt }, nextAccountNumber) {
  const later = type === 'SAVINGS' ? between(30, 400) * DAY : 0;
  let opened = new Date(created.getTime() + between(0, 3) * DAY + later);
  // A current account opens with its customer; only a later savings account can still be to come.
  if (opened > TODAY && type !== 'SAVINGS') opened = new Date(created.getTime() + 3600000);
  if (opened > TODAY) return null;
  const drawn = accountStatus(customer.status);
  // Dormant means no activity for more than a year: a younger account stays active.
  const status = drawn === 'DORMANT' && opened > daysAgo(400) ? 'ACTIVE' : drawn;
  const active = lastActivity(status, offboardedAt);
  const amount = balance(status, type, customer.expected_monthly_in);
  const after = date => iso(date < opened ? opened : date);
  const reason = pick(FREEZE_REASONS);

  return {
    id: uuid(),
    customer_id: customer.id,
    iban: frenchIban(nextAccountNumber()),
    bic: BIC,
    name: accountName(type, people.length),
    purpose: accountPurpose(type, people[0]),
    type,
    currency: 'EUR',
    plan: type === 'SAVINGS' ? 'STANDARD' : plan,
    balance: amount,
    available_balance: amount,
    overdraft_limit: type === 'SAVINGS' ? 0 : OVERDRAFT[plan],
    status,
    opened_at: iso(opened),
    last_activity_at: after(active),
    closed_at: status === 'CLOSED' ? after(offboardedAt) : null,
    frozen_at: status === 'FROZEN' ? after(withTime(daysAgo(between(2, 90)))) : null,
    freeze_reason: status === 'FROZEN' ? reason : null,
    freeze_note: status === 'FROZEN' ? FREEZE_NOTES[reason] : null,
    interest_rate: type === 'SAVINGS' ? round2(1.5 + rand() * 1.5) : null,
  };
}

/** A current account, sometimes a savings account; prospects and onboarding customers have none. */
function accountRows(drawn, nextAccountNumber) {
  if (['PROSPECT', 'ONBOARDING'].includes(drawn.customer.status)) return [];
  const plan = weighted(PAYMENT_PLANS);
  const types = chance(0.4) ? ['CURRENT', 'SAVINGS'] : ['CURRENT'];

  return types.map(type => accountRow(type, plan, drawn, nextAccountNumber)).filter(Boolean);
}

export {
  FREEZE_NOTES,
  accountRows,
  homeAddress,
  memberRows,
  newCustomer,
  person,
  OVERDRAFT,
  PAYMENT_PLANS,
};
