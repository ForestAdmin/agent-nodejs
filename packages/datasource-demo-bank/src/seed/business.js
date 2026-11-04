/**
 * Business customers: the companies (as in the company register), who owns and runs them, the
 * customer relationship and its business account. Some companies are owned through a holding, so
 * KYB has a chain to follow; some directors are also retail customers of the bank.
 */
const {
  eighteenth,
  DAY,
  TODAY,
  ascii,
  between,
  chance,
  daysAgo,
  iso,
  isoDate,
  pick,
  random: rand,
  round2,
  uniqueName,
  uuid,
  weighted,
  withTime,
} = require('./random');
const { BIC, COUNTRIES, MANAGERS, frenchIban, mod97 } = require('./reference');
const { FREEZE_NOTES, homeAddress, person } = require('./retail');

// Industries the bank's business clients come from: NAF code (the French NACE), label, the legal
// form they usually take, whether they sell by card, and their typical monthly revenue (EUR).
const INDUSTRIES = [
  ['10.71C', 'Bakery', 'SARL', true, [25000, 70000], name => `Boulangerie ${name}`],
  ['56.10A', 'Restaurant', 'SAS', true, [40000, 120000], name => `Le Bistrot ${name}`],
  ['47.71Z', 'Clothing retail', 'SAS', true, [30000, 150000], name => `Maison ${name}`],
  ['47.91B', 'E-commerce', 'SAS', true, [50000, 400000], name => `${name} Shop`],
  ['96.02A', 'Hairdressing', 'EURL', true, [12000, 35000], name => `Salon ${name}`],
  ['55.10Z', 'Hotel', 'SAS', true, [80000, 300000], name => `Hôtel ${name}`],
  ['62.01Z', 'Software development', 'SAS', false, [40000, 250000], name => `${name} Digital`],
  ['70.22Z', 'Business consulting', 'SASU', false, [15000, 90000], name => `${name} Conseil`],
  ['41.20A', 'House building', 'SARL', false, [60000, 300000], name => `Bâtiments ${name}`],
  ['49.41A', 'Road freight', 'SARL', false, [50000, 200000], name => `Transports ${name}`],
  [
    '43.21A',
    'Electrical installation',
    'EURL',
    false,
    [20000, 80000],
    name => `${name} Électricité`,
  ],
  ['74.10Z', 'Design', 'SASU', false, [10000, 50000], name => `Atelier ${name}`],
  ['86.21Z', 'General practice', 'SELARL', false, [15000, 40000], name => `Cabinet ${name}`],
  ['68.20B', 'Property rental', 'SCI', false, [5000, 30000], name => `SCI ${name} Patrimoine`],
];
const HOLDING = ['64.20Z', 'Holding company', 'SAS', false, [0, 0], name => `${name} Holding`];
const SECTOR_PRODUCTS = {
  Bakery: 'Bread and pastries',
  Restaurant: 'Meals and drinks',
  'Clothing retail': 'Clothes and accessories',
  'E-commerce': 'Home goods sold online',
  Hairdressing: 'Haircuts and hair care',
  Hotel: 'Rooms and breakfast',
};

/** A SIREN number (9 digits, Luhn check digit), as on every French company. */
function siren() {
  const digits = Array.from({ length: 8 }, () => between(0, 9));
  // Luhn: from the right, the check digit is not doubled, the digit before it is, and so on.
  const sum = digits
    .map((d, i) => (i % 2 === 1 ? d * 2 : d))
    .map(d => (d > 9 ? d - 9 : d))
    .reduce((x, y) => x + y, 0);

  return [...digits, (10 - (sum % 10)) % 10].join('');
}

/** French intra-EU VAT number: FR + 2-digit key + SIREN. */
function vatNumber(sirenNumber) {
  const key = (12 + 3 * (Number(sirenNumber) % 97)) % 97;

  return `FR${String(key).padStart(2, '0')}${sirenNumber}`;
}

/** An LEI: 18 characters then 2 ISO 7064 check digits, like the IBAN's. */
function lei() {
  const chars = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
  const base = `9695${Array.from({ length: 14 }, () => pick(chars.split(''))).join('')}`;
  const numeric = `${base}00`.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));

  return `${base}${String(98 - mod97(numeric)).padStart(2, '0')}`;
}

/** For companies that sell by card: what they sell, volumes, chargeback risk, reserve. */
function cardAcceptance(label, monthly) {
  const online = label === 'E-commerce';

  return {
    accepts_card_payments: true,
    products_sold: SECTOR_PRODUCTS[label] || label,
    expected_monthly_volume: round2(monthly * (0.5 + rand() * 0.4)),
    average_basket: round2(label === 'Hotel' ? 180 + rand() * 120 : 8 + rand() * 60),
    online_share_pct: online ? 100 : between(0, 30),
    delivery_delay_days: online ? between(2, 10) : 0,
    chargeback_ratio: round2(rand() * (online ? 1.4 : 0.4)),
    reserve_pct: online ? between(5, 10) : null,
    reserve_days: online ? 90 : null,
  };
}

const NO_CARD_ACCEPTANCE = {
  accepts_card_payments: false,
  products_sold: null,
  expected_monthly_volume: null,
  average_basket: null,
  online_share_pct: null,
  delivery_delay_days: null,
  chargeback_ratio: null,
  reserve_pct: null,
  reserve_days: null,
};

// When the name is taken already: the same family in business again.
const SIBLINGS = ['', ' & Fils', ' Frères', ' et Associés', ' & Cie'];

function company(industry, lastName, created, showcase = false) {
  const [nace, label, legalForm, sellsByCard, revenue, base] = industry;
  const legal = uniqueName(k => `${base(lastName)}${SIBLINGS[k % SIBLINGS.length]} ${legalForm}`);
  const trading = legal.slice(0, legal.length - legalForm.length - 1);
  const naming = () => trading;
  const number = siren();
  const monthly = between(revenue[0], revenue[1] || 1);
  const incorporated = new Date(created.getTime() - between(200, 15 * 365) * DAY);
  const changed = Math.max(created.getTime(), daysAgo(between(1, 300)).getTime());

  return {
    id: uuid(),
    legal_name: `${naming(lastName)} ${legalForm}`,
    trading_name: naming(lastName),
    registration_number: number,
    legal_form: legalForm,
    ...homeAddress('FR'),
    country: 'FR',
    incorporation_date: isoDate(incorporated),
    industry: label,
    nace_code: nace,
    vat_number: vatNumber(number),
    lei: legalForm === 'SA' || monthly > 250000 ? lei() : null,
    source_of_funds: weighted([
      ['REVENUE', 70],
      ['SHAREHOLDER_FUNDS', 15],
      ['LOAN', 10],
      ['INVESTMENT', 5],
    ]),
    website: `https://www.${ascii(naming(lastName)).toLowerCase()}.fr`,
    ...(sellsByCard && (showcase || chance(0.8))
      ? cardAcceptance(label, monthly)
      : NO_CARD_ACCEPTANCE),
    is_sanctioned: false,
    created_at: iso(created),
    updated_at: iso(withTime(new Date(changed))),
    monthlyRevenue: monthly, // drives the statements, dropped before insert
  };
}

function individualRow(p, created) {
  return {
    id: uuid(),
    ...p,
    created_at: iso(created),
    updated_at: iso(created),
    birth_name: null,
    address_line2: null,
    is_us_person: false,
  };
}

function memberRow(businessId, fields, created) {
  return {
    id: uuid(),
    business_id: businessId,
    individual_id: null,
    owner_business_id: null,
    ownership_pct: null,
    until: null,
    since: isoDate(created),
    verified: true,
    verified_by: `${pick(MANAGERS)}@forest-lab-bank.fr`,
    verified_at: isoDate(new Date(created.getTime() + between(0, 5) * DAY)),
    source: weighted([
      ['COMPANY_REGISTER', 55],
      ['UBO_REGISTER', 35],
      ['CLIENT_DECLARATION', 10],
    ]),
    ...fields,
  };
}

/** Split 100% between n owners, the first one holding the most. */
function shares(n) {
  if (n === 1) return [100];
  const first = between(51, 90);
  const rest = 100 - first;

  return n === 2 ? [first, rest] : [first, Math.ceil(rest / 2), Math.floor(rest / 2)];
}

// People who run or act for a company are 21 or older: no company starts with a minor.
const grownUp = p => TODAY - new Date(p.date_of_birth) > 21 * 365.25 * DAY;

/** New people for companies, or (for directors) sometimes someone who already banks with us. */
function peopleFor(rows, retailPeople) {
  const adults = retailPeople.filter(grownUp);

  const newPerson = (created, lastName) => {
    let p = person('FR', chance(0.5) ? 'M' : 'F', lastName, homeAddress('FR'));
    while (!grownUp(p)) p = person('FR', chance(0.5) ? 'M' : 'F', lastName, homeAddress('FR'));
    const row = individualRow(p, created);
    rows.individuals.push(row);

    return row;
  };

  const director = (created, lastName) =>
    chance(0.3) && adults.length ? pick(adults) : newPerson(created, lastName);

  return { newPerson, director };
}

/** When the company became a customer: drawn, but never before its director turned 18. */
function customerSince(drawnAt, boss) {
  const adult = eighteenth(boss) + 90 * DAY;
  const clamped = Math.min(daysAgo(30).getTime(), Math.max(drawnAt.getTime(), adult));

  return clamped === drawnAt.getTime()
    ? drawnAt
    : withTime(new Date(Math.floor(clamped / DAY) * DAY));
}

/** Who owns the company: people directly, or a holding owned by its boss (a chain for KYB). */
function ownership(rows, biz, boss, created, people, lastName) {
  if (chance(0.2)) {
    const holding = company(HOLDING, lastName, created);
    rows.businesses.push(holding);
    rows.business_members.push(
      memberRow(holding.id, { individual_id: boss.id, role: 'OWNER', ownership_pct: 100 }, created),
      memberRow(
        biz.id,
        { owner_business_id: holding.id, role: 'OWNER', ownership_pct: 100 },
        created,
      ),
    );
  } else {
    const partner = chance(0.4) ? [people.newPerson(created, pick(COUNTRIES.FR.last))] : [];
    const owners = [boss, ...partner];
    shares(owners.length).forEach((pct, i) => {
      const role = i === 0 ? 'OWNER' : 'SHAREHOLDER';
      rows.business_members.push(
        memberRow(biz.id, { individual_id: owners[i].id, role, ownership_pct: pct }, created),
      );
    });
  }

  rows.business_members.push(
    memberRow(biz.id, { individual_id: boss.id, role: 'DIRECTOR' }, created),
  );
}

/** The customer relationship of a company. */
function businessCustomerRow(biz, boss, created, lastName, applying) {
  const status = applying
    ? 'ONBOARDING'
    : weighted([
        ['ACTIVE', 92],
        ['SUSPENDED', 4],
        ['OFFBOARDED', 4],
      ]);
  // A politically exposed director makes the relationship high risk.
  const risk = boss.is_pep
    ? 'HIGH'
    : weighted([
        ['LOW', 60],
        ['MEDIUM', 32],
        ['HIGH', 8],
      ]);
  const monthlyIn = round2(biz.monthlyRevenue || 20000);
  const offboardedAt =
    status === 'OFFBOARDED' ? new Date(created.getTime() + rand() * (TODAY - created)) : null;
  const onboarded = new Date(created.getTime() + between(1, 10) * DAY);
  const customer = {
    id: uuid(),
    reference: `CUS-${created.getUTCFullYear()}-${String(between(1, 999999)).padStart(6, '0')}`,
    display_name: biz.trading_name,
    customer_type: 'BUSINESS',
    status,
    business_id: biz.id,
    risk_rating: risk,
    referral_code: `${ascii(lastName).slice(0, 4).toUpperCase()}${between(1000, 9999)}`,
    expected_monthly_in: monthlyIn,
    expected_monthly_out: round2(monthlyIn * (0.75 + rand() * 0.2)),
    // The next KYC review is due within the risk cycle (1, 2 or 3 years).
    next_review_at:
      status === 'OFFBOARDED'
        ? null
        : isoDate(daysAgo(-between(20, { LOW: 3, MEDIUM: 2, HIGH: 1 }[risk] * 365))),
    preferred_language: 'FR',
    onboarding_channel: weighted([
      ['WEB', 50],
      ['APP', 30],
      ['PARTNER', 15],
      ['BRANCH', 5],
    ]),
    onboarded_at: status === 'ONBOARDING' ? null : isoDate(onboarded),
    relationship_manager: chance(0.5) ? `${pick(MANAGERS)}@forest-lab-bank.fr` : null,
    created_at: iso(created),
    updated_at: iso(offboardedAt || withTime(daysAgo(between(1, 60)))),
  };

  // An application takes days, not years: a company still onboarding applied recently.
  if (status === 'ONBOARDING') {
    const applied = withTime(daysAgo(between(3, 25)));
    Object.assign(customer, {
      reference: `CUS-${applied.getUTCFullYear()}-${customer.reference.slice(-6)}`,
      created_at: iso(applied),
      updated_at: iso(applied),
    });

    return { customer, offboardedAt, created: applied };
  }

  return { customer, offboardedAt, created };
}

/** Who can act for the company at the bank: its boss signs; sometimes an employee helps. */
function businessMembers(rows, { customer, offboardedAt }, boss, created, people) {
  const member = fields => ({
    id: uuid(),
    customer_id: customer.id,
    is_primary_contact: false,
    proof_document_id: null,
    until: null,
    ...fields,
  });
  rows.customer_members.push(
    member({
      individual_id: boss.id,
      role: 'SIGNATORY',
      can_initiate_payments: true,
      is_primary_contact: true,
      since: isoDate(created),
      until: offboardedAt ? isoDate(offboardedAt) : null,
    }),
  );

  if (chance(0.35)) {
    const helper = people.newPerson(created, pick(COUNTRIES.FR.last));

    // Of age when the company became a customer, not only today.
    while (eighteenth(helper) + DAY > created.getTime()) {
      const [y, rest] = [Number(helper.date_of_birth.slice(0, 4)), helper.date_of_birth.slice(4)];
      Object.assign(helper, { date_of_birth: `${y - 1}${rest}` });
    }

    rows.customer_members.push(
      member({
        individual_id: helper.id,
        role: 'AUTHORISED_USER',
        can_initiate_payments: chance(0.5),
        since: isoDate(new Date(created.getTime() + between(10, 300) * DAY)),
      }),
    );
  }
}

/** The company's business account (none while onboarding); balances come from its statement. */
function businessAccount(rows, { customer, offboardedAt }, created, nextAccountNumber) {
  if (customer.status === 'ONBOARDING') return;
  const opened = new Date(created.getTime() + between(1, 10) * DAY);
  const status = { ACTIVE: 'ACTIVE', SUSPENDED: 'FROZEN', OFFBOARDED: 'CLOSED' }[customer.status];
  const frozen = status === 'FROZEN';
  const reason = pick(['AML_INVESTIGATION', 'AUTHORITY_REQUEST']);
  rows.accounts.push({
    id: uuid(),
    customer_id: customer.id,
    iban: frenchIban(nextAccountNumber()),
    bic: BIC,
    name: 'Compte professionnel',
    purpose: 'BUSINESS_OPERATIONS',
    type: 'BUSINESS',
    currency: 'EUR',
    plan: 'BUSINESS_PRO',
    balance: 0,
    available_balance: 0,
    overdraft_limit: pick([0, 5000, 10000, 20000]),
    status,
    opened_at: iso(opened),
    last_activity_at: iso(opened),
    closed_at: status === 'CLOSED' ? iso(offboardedAt < opened ? opened : offboardedAt) : null,
    frozen_at: frozen ? iso(withTime(daysAgo(between(2, 60)))) : null,
    freeze_reason: frozen ? reason : null,
    freeze_note: frozen ? FREEZE_NOTES[reason] : null,
    interest_rate: null,
  });
}

/**
 * Companies, their structure, and business customers. `retailPeople` lets some directors be people
 * who already bank with us as retail customers.
 */
function businessCustomers(count, retailPeople, nextAccountNumber) {
  const rows = {
    businesses: [],
    business_members: [],
    individuals: [],
    customers: [],
    customer_members: [],
    accounts: [],
  };
  const people = peopleFor(rows, retailPeople);

  Array.from({ length: count }).forEach((unused, i) => {
    // The first companies cover every industry once, so every kind of business shows in the demo.
    const industry = i < INDUSTRIES.length ? INDUSTRIES[i] : pick(INDUSTRIES);
    const lastName = pick(COUNTRIES.FR.last);
    const drawnAt = withTime(daysAgo(between(30, 5 * 365)));
    const boss = people.director(drawnAt, lastName);
    const created = customerSince(drawnAt, boss);
    const biz = company(industry, lastName, created, i < INDUSTRIES.length);
    rows.businesses.push(biz);
    ownership(rows, biz, boss, created, people, lastName);
    // A few companies are still applying, so the business onboarding desk has work.
    const relationship = businessCustomerRow(biz, boss, created, lastName, i % 15 === 7);
    rows.customers.push(relationship.customer);
    businessMembers(rows, relationship, boss, relationship.created, people);
    businessAccount(rows, relationship, relationship.created, nextAccountNumber);
  });

  return rows;
}

/**
 * A company applying to become a customer on `created` (onboarding-funnel.js): the company, who
 * owns it, its director (always someone new) and the relationship, still ONBOARDING, signed by its
 * director alone. No account: one opens once the application is approved.
 */
function applicantCompany(created) {
  const rows = {
    businesses: [],
    business_members: [],
    individuals: [],
    customers: [],
    customer_members: [],
  };
  const people = peopleFor(rows, []);
  const industry = pick(INDUSTRIES);
  const lastName = pick(COUNTRIES.FR.last);
  const boss = people.newPerson(created, lastName);
  const biz = company(industry, lastName, created);
  rows.businesses.push(biz);
  ownership(rows, biz, boss, created, people, lastName);
  const { customer } = businessCustomerRow(biz, boss, created, lastName, false);
  rows.customers.push(customer);
  rows.customer_members.push({
    id: uuid(),
    customer_id: customer.id,
    individual_id: boss.id,
    role: 'SIGNATORY',
    can_initiate_payments: true,
    is_primary_contact: true,
    proof_document_id: null,
    since: isoDate(created),
    until: null,
  });

  return { rows, customer, business: biz, boss };
}

module.exports = { applicantCompany, businessCustomers, siren, vatNumber };
