/**
 * The evidence a KYC reviewer reads before each decision, as fields of the case: a workflow
 * "read" step can only show fields of one record, not a list, so the agent writes each piece of
 * the file as one short text. A company case shows its company, documents, register, owners,
 * screening and risk; a retail case its applicants, their papers, screening and risk. The ID
 * checks show on both. Fields of the other kind stay empty.
 */
import type { RecordData } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { createHash } from 'crypto';

const DAY = 24 * 3600 * 1000;
// A Kbis extract is accepted when it is less than 3 months old.
const KBIS_MAX_DAYS = 90;
const COMPANY_DOCS = [
  ['COMPANY_REGISTRATION', 'Kbis extract'],
  ['ARTICLES_OF_ASSOCIATION', 'Articles of association'],
  ['UBO_DECLARATION', 'Beneficial owners declaration'],
];
const EU = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' '),
);
// A beneficial owner holds MORE than 25% (R561-1 CMF); with nobody above it, the legal
// representative is the beneficial owner by default.
const UBO_THRESHOLD = 25;

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const current = new ConditionTreeLeaf('until', 'Missing');
const frDate = iso => (iso ? new Date(iso).toLocaleDateString('fr-FR') : 'no date');

const label = code => {
  if (code === 'DRIVERS_LICENSE') return 'driving licence';

  return code ? code.replace(/_/g, ' ').toLowerCase() : '';
};

const fullName = p => `${p.first_name} ${p.last_name}`;
const pct = n => `${Math.round(n * 10) / 10}%`;
const euros = n => `${Math.round(Number(n)).toLocaleString('fr-FR')} EUR`;

function reader(dataSource) {
  return (table, leaves, fields, sort?) =>
    dataSource.getCollection(table).list(
      new PaginatedFilter({
        conditionTree: ConditionTreeFactory.intersect(...leaves),
        sort: sort && new Sort(sort),
      }),
      fields,
    );
}

/** The case's company, or null for a retail case. */
async function companyOf(list, kyc) {
  const [customer] = await list(
    'customers',
    [eq('id', kyc.customer_id)],
    ['id', 'business_id', 'expected_monthly_in', 'expected_monthly_out'],
  );
  if (!customer?.business_id) return null;
  const [business] = await list(
    'businesses',
    [eq('id', customer.business_id)],
    [
      'id',
      'legal_name',
      'legal_form',
      'registration_number',
      'incorporation_date',
      'industry',
      'nace_code',
      'city',
      'country',
      'vat_number',
      'website',
      'source_of_funds',
      'accepts_card_payments',
      'products_sold',
      'expected_monthly_volume',
      'average_basket',
      'online_share_pct',
      'delivery_delay_days',
      'is_sanctioned',
    ],
  );

  return business ? { ...business, customer } : null;
}

/** Each required company document: received and valid, or why not. Shared with Approve KYC. */
async function companyDocuments(list, kyc, business) {
  const docs = await list(
    'documents',
    [eq('kyc_case_id', kyc.id), eq('business_id', business.id)],
    ['document_type', 'issued_at', 'check_result', 'failure_reason'],
    { field: 'uploaded_at', ascending: true },
  );
  const latest = new Map<string, RecordData>(docs.map(doc => [doc.document_type, doc]));

  return COMPANY_DOCS.map(([type, name]) => {
    const doc = latest.get(type);
    if (!doc) return { type, name, ok: false, line: `✗ ${name}: not received` };

    if (doc.check_result === 'FAILED') {
      return { type, name, ok: false, line: `✗ ${name}: failed its check (${doc.failure_reason})` };
    }

    const age = (Date.now() - new Date(doc.issued_at).getTime()) / DAY;

    if (type === 'COMPANY_REGISTRATION' && age > KBIS_MAX_DAYS) {
      return {
        type,
        name,
        ok: false,
        line: `✗ ${name}: issued ${frDate(doc.issued_at)}, older than 3 months`,
      };
    }

    return { type, name, ok: true, line: `✓ ${name}: issued ${frDate(doc.issued_at)}` };
  });
}

/** Everyone behind the company: people owning it directly or through holdings, and directors. */
async function ownership(list, businessId, share = 1, via = [], seen = new Set()) {
  if (seen.has(businessId)) return [];
  seen.add(businessId);
  const members = await list(
    'business_members',
    [eq('business_id', businessId), current],
    ['individual_id', 'owner_business_id', 'role', 'ownership_pct'],
  );
  const rows = await Promise.all(
    members.map(async m => {
      const owned = (Number(m.ownership_pct) || 0) * share;
      if (m.individual_id) return [{ personId: m.individual_id, role: m.role, owned, via }];
      if (!m.owner_business_id) return [];
      const [holding] = await list('businesses', [eq('id', m.owner_business_id)], ['legal_name']);
      const name = `${holding?.legal_name || 'a holding'} (${pct(Number(m.ownership_pct) || 0)})`;

      return ownership(list, m.owner_business_id, owned / 100, [...via, name], seen);
    }),
  );

  return rows.flat();
}

async function owners(list, business) {
  const rows = await ownership(list, business.id);
  const ids = [...new Set(rows.map(r => r.personId))];
  const people = ids.length
    ? await list(
        'individuals',
        [eq('id', ids)],
        ['id', 'first_name', 'last_name', 'country_of_residence', 'nationality', 'is_pep'],
      )
    : [];
  const byId = new Map(people.map(p => [p.id, p]));
  // One line per person: their total share, and how they hold it.
  const perPerson = ids.map(id => {
    const own = rows.filter(r => r.personId === id);
    const owned = own.reduce((sum, r) => sum + r.owned, 0);

    return { person: byId.get(id), owned, rows: own };
  });

  const above = perPerson.filter(p => p.owned > UBO_THRESHOLD);
  const directors = perPerson.filter(p =>
    p.rows.some(r => ['DIRECTOR', 'MANAGER'].includes(r.role)),
  );

  return {
    perPerson,
    levels: Math.max(0, ...rows.map(r => r.via.length)),
    ubos: above.length ? above : directors,
    byDefault: !above.length && directors.length > 0,
  };
}

const OK = '✓';
const LOOK = '⚠';
const BAD = '✗';
const where = person => person.country_of_residence || person.nationality || '?';
const holdings = n => (n ? `${n} holding level${n > 1 ? 's' : ''}` : 'owned directly');
const holding = r => (r.via.length ? `through ${r.via.join(' → ')}` : 'direct');

/** Owners: one value per line of the file, so each shows on its own row. */
function ownerFields({ perPerson, levels, ubos, byDefault }) {
  const share = ({ person, owned, rows }) =>
    `${fullName(person)} (${where(person)}${person.is_pep ? ', PEP' : ''}) ${pct(owned)} ${rows
      .filter(r => r.owned)
      .map(holding)
      .join(' and ')}`;
  const minor = perPerson.filter(p => p.owned > 0 && p.owned <= UBO_THRESHOLD);
  const directors = perPerson.filter(p =>
    p.rows.some(r => ['DIRECTOR', 'MANAGER'].includes(r.role)),
  );
  const routes = [...new Set(perPerson.flatMap(p => p.rows.flatMap(r => r.via)))];

  return {
    owners_ubo: (() => {
      if (byDefault) {
        const names = ubos.map(p => fullName(p.person)).join(', ');

        return `${OK} Nobody above 25%: ${names}, legal representative, is the beneficial owner by default`;
      }

      return ubos.length
        ? `${OK} ${ubos.map(share).join(' · ')}`
        : `${BAD} Nobody above 25% and no legal representative on file`;
    })(),
    owners_minor: minor.length ? `○ ${minor.map(share).join(' · ')}` : 'None',
    owners_directors: directors.length
      ? `${OK} ${directors.map(p => fullName(p.person)).join(', ')}`
      : `${BAD} No director on file`,
    owners_structure: levels
      ? `${levels > 2 ? LOOK : OK} ${levels} holding level${levels > 1 ? 's' : ''}: ${routes.join(
          ', ',
        )}`
      : `${OK} Owned directly, no holding`,
  };
}

async function hits(list, business, people) {
  const subjects = [eq('business_id', business.id)];

  if (people.length) {
    subjects.push(
      eq(
        'individual_id',
        people.map(p => p.id),
      ),
    );
  }

  return list(
    'screening_hits',
    [ConditionTreeFactory.union(...subjects)],
    ['reference', 'screened_name', 'hit_type', 'match_score', 'status'],
  );
}

function screeningText(found, nobody = 'No hit on the company or its people') {
  if (!found.length) return `${OK} ${nobody}`;

  return found
    .map(
      h =>
        `${h.status === 'FALSE_POSITIVE' ? '○' : BAD} ${h.reference}: ${h.screened_name}, ${label(
          h.hit_type,
        )}, score ${h.match_score}, ${
          h.status === 'FALSE_POSITIVE' ? 'cleared before' : label(h.status)
        }`,
    )
    .join(' · ');
}

/** Card acceptance: granted already, asked for (its sales profile filled in), or not asked. */
const cardsAsked = b => Boolean(b.accepts_card_payments || b.products_sold);
const riskyCards = b => cardsAsked(b) && (b.online_share_pct > 60 || b.delivery_delay_days > 14);

function cardsText(b) {
  if (!cardsAsked(b)) return `${OK} Not requested`;
  const profile = `${b.products_sold || 'products not stated'}, ${euros(
    b.expected_monthly_volume || 0,
  )} a month, average basket ${euros(b.average_basket || 0)}, ${
    b.online_share_pct ?? '?'
  }% online, delivered in ${b.delivery_delay_days ?? '?'} days`;

  return b.accepts_card_payments
    ? `${OK} Granted already: ${profile}`
    : `${LOOK} Requested, to decide: ${profile}`;
}

function companyFields(b) {
  // The legal form is part of most names already (Guérin Conseil SASU).
  const name = b.legal_name.endsWith(b.legal_form)
    ? b.legal_name
    : `${b.legal_name} (${b.legal_form})`;

  return {
    company_identity: `${name} · SIREN ${b.registration_number} · created ${frDate(
      b.incorporation_date,
    )} · VAT ${b.vat_number || 'none'}`,
    company_activity: `${b.industry || 'Industry not stated'} (NACE ${b.nace_code || '?'}) · ${
      b.city || '?'
    }, ${b.country || '?'} · funds from ${label(b.source_of_funds)} · ${b.website || 'no website'}`,
    company_volumes: `${euros(b.customer.expected_monthly_in || 0)} in, ${euros(
      b.customer.expected_monthly_out || 0,
    )} out a month`,
    company_cards: cardsText(b),
  };
}

const DOC_FIELD = {
  COMPANY_REGISTRATION: 'doc_kbis',
  ARTICLES_OF_ASSOCIATION: 'doc_articles',
  UBO_DECLARATION: 'doc_ubo',
};

function documentFields(docs) {
  const missing = docs.filter(d => !d.ok);

  return {
    ...Object.fromEntries(docs.map(d => [DOC_FIELD[d.type], d.line.replace(`${d.name}: `, '')])),
    docs_complete: missing.length
      ? `${BAD} No: ${missing.map(d => d.line.slice(2)).join(' · ')}`
      : `${OK} Yes`,
  };
}

/** The rules of the workflow's risk step, applied: a starting point, never the decision. */
function suggestedRating(b, { open, confirmed, peps, abroad, levels }) {
  const high = [
    confirmed.length && 'a confirmed screening match',
    peps.length && 'a PEP',
    b.is_sanctioned && 'the company is sanctioned',
  ].filter(Boolean);
  if (high.length) return `${BAD} HIGH: ${high.join(', ')}`;
  const medium = [
    open.length && 'an open screening hit',
    abroad.length && 'a beneficial owner outside the EU',
    levels > 2 && 'a complex structure',
    riskyCards(b) && 'card sales mostly online or slow to deliver',
  ].filter(Boolean);

  return medium.length
    ? `${LOOK} MEDIUM: ${medium.join(', ')}`
    : `${OK} LOW: none of the risk factors below`;
}

function cardRisk(b) {
  if (!cardsAsked(b)) return `${OK} No card acceptance asked`;
  const profile = `${b.online_share_pct ?? 0}% online, delivered in ${
    b.delivery_delay_days ?? 0
  } days`;

  return riskyCards(b) ? `${LOOK} ${profile}` : `${OK} Within limits: ${profile}`;
}

function riskFields(b, found, own) {
  const facts = {
    open: found.filter(h => h.status === 'OPEN'),
    confirmed: found.filter(h => h.status === 'TRUE_MATCH'),
    peps: own.perPerson.filter(p => p.person.is_pep).map(p => fullName(p.person)),
    abroad: own.ubos
      .filter(u => !EU.has(u.person.country_of_residence))
      .map(u => `${fullName(u.person)} (${u.person.country_of_residence})`),
    levels: own.levels,
  };
  const { open, confirmed, peps, abroad, levels } = facts;

  return {
    risk_rating_suggested: suggestedRating(b, facts),
    risk_hits:
      open.length || confirmed.length
        ? `${BAD} ${open.length} open, ${confirmed.length} confirmed`
        : `${OK} No open or confirmed hit`,
    risk_pep: peps.length ? `${BAD} ${peps.join(', ')}` : `${OK} No PEP`,
    risk_residence: abroad.length
      ? `${LOOK} Outside the EU: ${abroad.join(', ')}`
      : `${OK} All beneficial owners live in the EU`,
    risk_structure:
      levels > 2
        ? `${LOOK} Complex: ${levels} holding levels`
        : `${OK} Simple: ${holdings(levels)}`,
    risk_cards: cardRisk(b),
  };
}

// ---- outside checks: shown once they ran, "Not checked yet" before -----------------------------

const md5 = text => createHash('md5').update(String(text)).digest('hex');
const NEW_OFFICES = [
  '12 rue de la République',
  '48 avenue Jean Jaurès',
  '5 place du Marché',
  '27 boulevard Gambetta',
];
const stamp = iso =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** What INPI holds: our file, plus any filing made after the Kbis on file (an office transfer). */
function registerOf(business, kbis) {
  const age = kbis ? (Date.now() - new Date(kbis.issued_at).getTime()) / DAY : 0;
  if (age <= KBIS_MAX_DAYS) return { office: business.address_line1, filing: null };
  const seed = parseInt(md5(business.id).slice(0, 4), 16);
  const filed = new Date(new Date(kbis.issued_at).getTime() + (20 + (seed % 25)) * DAY);

  return {
    office: NEW_OFFICES[seed % NEW_OFFICES.length],
    filing: { what: 'Transfer of the registered office', filed: filed.toISOString() },
  };
}

/** The INPI check as the case shows it, from the verdicts the check recorded on the papers. */
async function registerFields(list, kyc, business) {
  const papers = await list(
    'documents',
    [eq('kyc_case_id', kyc.id), eq('business_id', business.id)],
    ['document_type', 'issued_at', 'provider_check_id', 'verified_at'],
    { field: 'uploaded_at', ascending: false },
  );
  const checked = papers.find(doc => String(doc.provider_check_id).startsWith('RNE-'));

  if (!checked) {
    const waiting = 'Not checked yet: the workflow runs "Check the company register"';

    return { register_result: waiting, register_differences: waiting };
  }

  const [full] = await list(
    'businesses',
    [eq('id', business.id)],
    ['id', 'address_line1', 'postal_code', 'city'],
  );
  const kbis = papers.find(doc => doc.document_type === 'COMPANY_REGISTRATION');
  const register = registerOf(full, kbis);
  const source = `INPI ${checked.provider_check_id}, ${stamp(checked.verified_at)}`;

  if (!register.filing) {
    return {
      register_result: `${OK} Matches our file on all 7 points (${source})`,
      register_differences:
        'None: legal name, form, SIREN, creation date, office, directors and beneficial owners match',
    };
  }

  const city = `${full.postal_code} ${full.city}`;

  return {
    register_result: `${LOOK} 1 difference: registered office (${source})`,
    register_differences: `${LOOK} Registered office: at INPI ${
      register.office
    }, ${city} · in our file ${full.address_line1}, ${city}. ${
      register.filing.what
    } filed on ${frDate(register.filing.filed)}, after the Kbis on file: ask for a fresh Kbis.`,
  };
}

const ID_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'];
// A confidence the provider would give, fixed per document (never random).
const score = (id, low, high) =>
  (low + (parseInt(md5(`${id}score`).slice(0, 6), 16) % ((high - low) * 10 + 1)) / 10).toFixed(1);
// Checked once the provider stamped it: its answer can be "look closer" (MANUAL_REVIEW) too.
const ran = doc => Boolean(doc.verified_at);

const DOC_NAMES = {
  NATIONAL_ID: 'National ID card',
  PASSPORT: 'Passport',
  DRIVERS_LICENSE: 'Driving licence',
};

function idLine(doc, person) {
  const who = `${fullName(person)} · ${DOC_NAMES[doc.document_type]}`;
  if (!ran(doc)) return `○ ${who}: not checked yet`;

  if (doc.check_result === 'PASSED') {
    return `${OK} ${who}: genuine, ${score(doc.id, 96, 99.9)}% confidence, expires ${frDate(
      doc.expires_at,
    )}`;
  }

  const reason = (doc.failure_reason || 'did not pass').replace(/^./, c => c.toLowerCase());
  if (/expired/i.test(reason)) return `${BAD} ${who}: ${reason}`;
  if (/name/i.test(reason)) return `${BAD} ${who}: ${reason}, ${score(doc.id, 20, 48)}% name match`;

  return `${LOOK} ${who}: ${reason}, ${score(doc.id, 60, 82)}% confidence`;
}

function faceLine(selfie, person) {
  if (!selfie) return `○ ${fullName(person)}: no selfie (ID checked at a branch)`;
  if (!ran(selfie)) return `○ ${fullName(person)}: not checked yet`;

  if (selfie.check_result === 'PASSED') {
    return `${OK} ${fullName(person)}: selfie matches the ID photo, ${score(
      selfie.id,
      95,
      99.5,
    )}% similarity`;
  }

  return `${BAD} ${fullName(person)}: ${
    selfie.failure_reason || 'selfie does not match the ID photo'
  }`;
}

/** The ID provider's checks on the case's people, once they ran. */
async function idFields(list, kyc) {
  const docs = await list(
    'documents',
    [eq('kyc_case_id', kyc.id), eq('document_type', [...ID_TYPES, 'SELFIE'])],
    [
      'id',
      'individual_id',
      'document_type',
      'check_result',
      'failure_reason',
      'expires_at',
      'verified_at',
      'provider_check_id',
    ],
    { field: 'uploaded_at', ascending: true },
  );
  if (!docs.length) return {};
  const latest = new Map<string, RecordData>(
    docs.map(doc => [
      `${doc.individual_id}:${doc.document_type === 'SELFIE' ? 'face' : 'id'}`,
      doc,
    ]),
  );
  const ids = [...latest.entries()].filter(([k]) => k.endsWith(':id')).map(([, doc]) => doc);
  const people = await list(
    'individuals',
    [
      eq(
        'id',
        ids.map(doc => doc.individual_id),
      ),
    ],
    ['id', 'first_name', 'last_name'],
  );
  const personOf = doc =>
    people.find(p => p.id === doc.individual_id) || { first_name: '?', last_name: '' };
  const faces = ids.map(doc => latest.get(`${doc.individual_id}:face`));
  const all = [...ids, ...faces.filter(Boolean)];
  const failed = all.filter(doc => ran(doc) && doc.check_result === 'FAILED');
  const doubtful = all.filter(
    doc => ran(doc) && doc.check_result !== 'PASSED' && !failed.includes(doc),
  );
  const last = ids
    .filter(ran)
    .sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)))[0];
  const source = last ? ` · ID check ${last.provider_check_id}, ${stamp(last.verified_at)}` : '';
  const count = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const selfies = faces.filter(Boolean).length;
  let result = `${OK} Passed: ${count(ids.length, 'ID')} and ${count(selfies, 'selfie')}${source}`;

  if (!ids.every(ran)) {
    result = 'Not checked yet: the workflow runs "Verify document"';
  } else if (failed.length) {
    result = `${BAD} Failed: ${count(failed.length, 'document')} did not pass${source}`;
  } else if (doubtful.length) {
    result = `${LOOK} Needs a closer look: ${count(doubtful.length, 'document')}${source}`;
  }

  return {
    idcheck_documents: ids.map(doc => idLine(doc, personOf(doc))).join(' · '),
    idcheck_faces: ids.map((doc, i) => faceLine(faces[i], personOf(doc))).join(' · '),
    idcheck_result: result,
  };
}

// ---- retail applicants: who they are, their papers, their risk ---------------------------------

// A proof of address is accepted when it is less than 3 months old.
const ADDRESS_MAX_DAYS = 90;
// Above 70k EUR a year the bank asks for a payslip, a tax notice or a bank statement.
const INCOME_PROOF_BANDS = ['FROM_70K_TO_120K', 'ABOVE_120K'];
const BANDS = {
  BELOW_20K: ['below 20k EUR', 20000],
  FROM_20K_TO_40K: ['20k to 40k EUR', 40000],
  FROM_40K_TO_70K: ['40k to 70k EUR', 70000],
  FROM_70K_TO_120K: ['70k to 120k EUR', 120000],
  ABOVE_120K: ['above 120k EUR', Infinity],
};
// Trades where customers often pay cash: a classic money-laundering risk factor.
const CASH_TRADES = ['Restaurant owner'];
const PAPERS = {
  'facture_edf.pdf': 'EDF bill',
  'facture_orange.pdf': 'Orange bill',
  'quittance_loyer.pdf': 'rent receipt',
  'avis_imposition.pdf': 'tax notice',
  'justificatif_domicile.pdf': 'proof of address',
  'bulletin_salaire.pdf': 'payslip',
  'releve_bancaire.pdf': 'bank statement',
};
const APPLICANT_FIELDS = [
  'id',
  'first_name',
  'last_name',
  'date_of_birth',
  'nationality',
  'place_of_birth',
  'country_of_residence',
  'address_line1',
  'postal_code',
  'city',
  'country',
  'email',
  'phone',
  'is_pep',
  'is_sanctioned',
  'occupation',
  'employment_status',
  'employer',
  'income_band',
  'source_of_funds',
  'source_of_wealth',
  'tax_residence',
  'is_us_person',
];

const daysOld = iso => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
const paperName = doc => PAPERS[doc.file_name] || label(doc.document_type);
const yearsOld = iso => Math.floor(daysOld(iso) / 365.25);

/** The case's retail customer and its people (the primary contact first), or null. */
async function applicantsOf(list, kyc) {
  const [customer] = await list(
    'customers',
    [eq('id', kyc.customer_id)],
    ['id', 'customer_type', 'onboarding_channel', 'expected_monthly_in', 'expected_monthly_out'],
  );
  if (customer?.customer_type !== 'RETAIL') return null;
  const members = await list(
    'customer_members',
    [eq('customer_id', customer.id), current],
    ['individual_id', 'is_primary_contact'],
  );
  const ids = members.map(m => m.individual_id).filter(Boolean);
  const found = ids.length ? await list('individuals', [eq('id', ids)], APPLICANT_FIELDS) : [];
  const first = members.find(m => m.is_primary_contact)?.individual_id;
  const people = found.sort((a, b) => Number(b.id === first) - Number(a.id === first));

  return { customer, people, channel: kyc.channel || customer.onboarding_channel };
}

/** "Nurse (employed, Clinique Pasteur)", or just "Retired" when the status says the same. */
function occupation(p) {
  const status = label(p.employment_status);
  const details = [status !== p.occupation.toLowerCase() && status, p.employer].filter(Boolean);

  return details.length ? `${p.occupation} (${details.join(', ')})` : p.occupation;
}

const fundsText = p =>
  p.source_of_funds === 'OTHER' && p.employment_status === 'STUDENT'
    ? 'other (a student: family support)'
    : label(p.source_of_funds);

function applicantFields({ customer, people, channel }) {
  const each = line => people.map(line).join(' · ');

  return {
    applicant_identity: each(
      p =>
        `${fullName(p)}, born ${frDate(p.date_of_birth)} (${yearsOld(p.date_of_birth)}) in ${
          p.place_of_birth || '?'
        }, nationality ${p.nationality || '?'}`,
    ),
    applicant_contact: each(
      p =>
        `${fullName(p)}: ${p.address_line1}, ${p.postal_code} ${p.city} (${p.country}), ${
          p.email
        }, ${p.phone}`,
    ),
    applicant_profile: each(
      p =>
        `${fullName(p)}: ${occupation(p)}, income ${
          BANDS[p.income_band]?.[0] || '?'
        } a year, funds from ${fundsText(p)}, wealth: ${String(
          p.source_of_wealth || 'not stated',
        ).toLowerCase()}, lives in ${p.country_of_residence}, tax resident ${p.tax_residence}${
          p.is_us_person ? ', US person (FATCA)' : ''
        }, ${p.is_pep ? 'PEP' : 'not a PEP'}`,
    ),
    applicant_volumes: `${euros(customer.expected_monthly_in || 0)} in, ${euros(
      customer.expected_monthly_out || 0,
    )} out a month · applied through ${label(channel)}`,
  };
}

const ASK_ADDRESS =
  'a proof of address dated less than 3 months ago (energy or phone bill, rent receipt, tax notice)';

function idPaper(p, doc) {
  const who = fullName(p);
  if (!doc) return { ok: false, line: `${BAD} ${who}: no ID received`, ask: 'a photo of your ID' };
  const what = `${who} · ${DOC_NAMES[doc.document_type]}`;

  if (doc.check_result === 'FAILED') {
    return {
      ok: false,
      line: `${BAD} ${what}: failed its check (${String(doc.failure_reason).toLowerCase()})`,
      ask: 'a new photo of your ID, the whole card visible and without glare',
    };
  }

  if (doc.expires_at && new Date(doc.expires_at) < new Date()) {
    return {
      ok: false,
      line: `${BAD} ${what}: expired on ${frDate(doc.expires_at)}`,
      ask: 'a valid ID: the one we received has expired',
    };
  }

  return {
    ok: true,
    line: `${OK} ${what} no. ${doc.document_number}, valid until ${frDate(doc.expires_at)}`,
  };
}

function selfiePaper(p, doc, channel) {
  const who = fullName(p);
  if (channel === 'BRANCH') return { ok: true, line: `○ ${who}: none needed, ID seen at a branch` };
  if (!doc) return { ok: false, line: `${BAD} ${who}: no selfie received`, ask: 'a selfie' };

  if (doc.check_result === 'FAILED') {
    return { ok: false, line: `${BAD} ${who}: ${doc.failure_reason}`, ask: 'a new selfie' };
  }

  return { ok: true, line: `${OK} ${who}: received, the ID check matches it to the ID` };
}

function addressPaper(p, doc) {
  const who = fullName(p);
  if (!doc) return { ok: false, line: `${BAD} ${who}: not received`, ask: ASK_ADDRESS };

  if (doc.check_result === 'FAILED') {
    return { ok: false, line: `${BAD} ${who}: ${doc.failure_reason}`, ask: ASK_ADDRESS };
  }

  if (!doc.issued_at) {
    return {
      ok: false,
      line: `${BAD} ${who}: ${paperName(doc)} with no date: under 3 months old cannot be told`,
      ask: ASK_ADDRESS,
    };
  }

  const age = daysOld(doc.issued_at);
  const issued = `${paperName(doc)} issued ${frDate(doc.issued_at)}`;

  if (age > ADDRESS_MAX_DAYS) {
    return {
      ok: false,
      line: `${BAD} ${who}: ${issued}, ${age} days ago: older than 3 months`,
      ask: ASK_ADDRESS,
    };
  }

  return { ok: true, line: `${OK} ${who}: ${issued} (${age} days ago)` };
}

function incomePaper(p, doc) {
  const who = fullName(p);

  if (!doc) {
    return {
      ok: false,
      line: `${BAD} ${who}: not received, needed for an income above 70k EUR a year`,
      ask: 'a proof of income (your last payslip, tax notice or 3 months of bank statements)',
    };
  }

  return { ok: true, line: `${OK} ${who}: ${paperName(doc)} issued ${frDate(doc.issued_at)}` };
}

const paperKind = type => {
  if (ID_TYPES.includes(type)) return 'id';
  if (['PROOF_OF_INCOME', 'BANK_STATEMENT'].includes(type)) return 'income';

  return { SELFIE: 'selfie', PROOF_OF_ADDRESS: 'address' }[type] || null;
};

/** Each paper the application needs from each person: received and valid, or why not. */
async function applicantPapers(list, kyc, applicants) {
  const { people, channel } = applicants;
  const docs = people.length
    ? await list(
        'documents',
        [
          eq('kyc_case_id', kyc.id),
          eq(
            'individual_id',
            people.map(p => p.id),
          ),
        ],
        [
          'individual_id',
          'document_type',
          'document_number',
          'issued_at',
          'expires_at',
          'file_name',
          'check_result',
          'failure_reason',
        ],
        { field: 'uploaded_at', ascending: true },
      )
    : [];
  const latest = new Map(
    docs.map(doc => [`${doc.individual_id}:${paperKind(doc.document_type)}`, doc]),
  );
  const of = (p, kind) => latest.get(`${p.id}:${kind}`);

  return people.flatMap(p => [
    { kind: 'id', ...idPaper(p, of(p, 'id')) },
    { kind: 'selfie', ...selfiePaper(p, of(p, 'selfie'), channel) },
    { kind: 'address', ...addressPaper(p, of(p, 'address')) },
    ...(INCOME_PROOF_BANDS.includes(p.income_band)
      ? [{ kind: 'income', ...incomePaper(p, of(p, 'income')) }]
      : []),
  ]);
}

function paperFields(papers) {
  const lines = kind =>
    papers
      .filter(p => p.kind === kind)
      .map(p => p.line)
      .join(' · ');
  const missing = papers.filter(p => !p.ok);

  return {
    doc_id: lines('id'),
    doc_selfie: lines('selfie'),
    doc_address: lines('address'),
    doc_income: lines('income') || '○ Not needed: declared income below 70k EUR a year',
    docs_complete: missing.length
      ? `${BAD} No: ${missing.map(p => p.line.slice(2)).join(' · ')}`
      : `${OK} Yes`,
  };
}

/** Why a person's occupation or source of funds needs a closer look (none: consistent). */
function fundsFlags(p) {
  return [
    CASH_TRADES.includes(p.occupation) &&
      `${p.occupation.toLowerCase()}, a trade where customers often pay cash`,
    p.source_of_funds === 'INHERITANCE' && 'funds from an inheritance, no notary deed on file',
    p.source_of_funds === 'OTHER' &&
      p.employment_status !== 'STUDENT' &&
      'source of funds "other", not explained',
  ].filter(Boolean);
}

/** What the household declares it earns a month, at most, against what it plans to pay in. */
function volumesCheck({ customer, people }) {
  const ceiling = people.reduce((sum, p) => sum + (BANDS[p.income_band]?.[1] ?? 0) / 12, 0);
  const monthlyIn = Number(customer.expected_monthly_in) || 0;
  const expected = `${euros(monthlyIn)} a month expected in`;

  if (ceiling === Infinity) {
    return { ok: true, line: `${OK} ${expected}, declared income above 120k EUR a year` };
  }

  if (monthlyIn > ceiling) {
    return {
      ok: false,
      line: `${LOOK} ${expected}, above the declared income (at most ${euros(ceiling)} a month)`,
    };
  }

  return {
    ok: true,
    line: `${OK} ${expected}, within the declared income (up to ${euros(ceiling)} a month)`,
  };
}

const outsideEu = p => !EU.has(p.country_of_residence) || !EU.has(p.tax_residence);

/**
 * The rating the risk step suggests for applicants with no screening hit, as a level: the seed
 * rates its applicants with it, so the case file and the customer agree.
 */
function applicantRating(people, customer) {
  if (people.some(p => p.is_pep || p.is_sanctioned)) return 'HIGH';
  const medium =
    people.some(outsideEu) ||
    people.some(p => fundsFlags(p).length) ||
    !volumesCheck({ customer, people }).ok;

  return medium ? 'MEDIUM' : 'LOW';
}

/** The same for a company with no hit and owners in the EU: card sales mostly online are medium. */
const companyRating = business => (riskyCards(business) ? 'MEDIUM' : 'LOW');

function applicantRiskFields(applicants, found) {
  const { people } = applicants;
  const open = found.filter(h => h.status === 'OPEN');
  const confirmed = found.filter(h => h.status === 'TRUE_MATCH');
  const peps = people.filter(p => p.is_pep).map(fullName);
  const abroad = people.filter(outsideEu);
  const funds = people.map(p => [p, fundsFlags(p)]).filter(([, flags]) => flags.length);
  const volumes = volumesCheck(applicants);
  const high = [
    confirmed.length && 'a confirmed screening match',
    peps.length && 'a PEP',
    people.some(p => p.is_sanctioned) && 'an applicant under sanctions',
  ].filter(Boolean);
  const medium = [
    open.length && 'an open screening hit',
    abroad.length && 'an applicant living or paying tax outside the EU',
    funds.length && 'an occupation or source of funds to explain',
    !volumes.ok && 'more money expected in than the declared income',
  ].filter(Boolean);
  let rating = `${OK} LOW: none of the risk factors below`;
  if (high.length) rating = `${BAD} HIGH: ${high.join(', ')}`;
  else if (medium.length) rating = `${LOOK} MEDIUM: ${medium.join(', ')}`;

  return {
    risk_rating_suggested: rating,
    risk_hits:
      open.length || confirmed.length
        ? `${BAD} ${open.length} open, ${confirmed.length} confirmed`
        : `${OK} No open or confirmed hit`,
    risk_pep: peps.length ? `${BAD} ${peps.join(', ')}` : `${OK} No PEP`,
    risk_residence: abroad.length
      ? `${LOOK} Outside the EU: ${abroad
          .map(
            p =>
              `${fullName(p)} lives in ${p.country_of_residence}, tax resident ${p.tax_residence}`,
          )
          .join(' · ')}`
      : `${OK} All applicants live and pay tax in the EU`,
    risk_funds: funds.length
      ? `${LOOK} ${funds.map(([p, flags]) => `${fullName(p)}: ${flags.join(', ')}`).join(' · ')}`
      : `${OK} Consistent: ${people
          .map(p => `${fullName(p)}, ${p.occupation.toLowerCase()}, funds from ${fundsText(p)}`)
          .join(' · ')}`,
    risk_volumes: volumes.line,
  };
}

async function applicantHits(list, people) {
  if (!people.length) return [];

  return list(
    'screening_hits',
    [
      eq(
        'individual_id',
        people.map(p => p.id),
      ),
    ],
    ['reference', 'screened_name', 'hit_type', 'match_score', 'status'],
  );
}

/** A retail application: who applies, their papers (onboarding only), screening and risk. */
async function applicantFile(list, kyc, applicants) {
  const papers = kyc.type === 'ONBOARDING' ? await applicantPapers(list, kyc, applicants) : null;
  const found = await applicantHits(list, applicants.people);

  return {
    ...applicantFields(applicants),
    ...(papers ? paperFields(papers) : {}),
    screening_result: screeningText(found, 'No hit on the applicants'),
    ...applicantRiskFields(applicants, found),
  };
}

/**
 * What to ask a retail applicant for: the papers missing or outdated; with every paper on file, a
 * proof of where the money comes from (the senior's question). Shared with Request missing documents.
 */
async function applicantRequest(list, kyc) {
  const applicants = await applicantsOf(list, kyc);
  if (!applicants) return null;
  const papers = await applicantPapers(list, kyc, applicants);
  const asks = [...new Set(papers.filter(p => !p.ok).map(p => p.ask))];

  if (!asks.length) {
    asks.push(
      'a document showing where the money you plan to pay in comes from (notary deed of an inheritance, sale contract, payslips or accounts)',
    );
  }

  return { asks, papers };
}

/** Everything about one case, computed once for all its fields. */
async function caseFacts(list, kyc) {
  const ids = await idFields(list, kyc);
  const business = await companyOf(list, kyc);

  if (!business) {
    const applicants = await applicantsOf(list, kyc);

    return applicants ? { ...(await applicantFile(list, kyc, applicants)), ...ids } : ids;
  }

  const [docs, own] = await Promise.all([
    companyDocuments(list, kyc, business),
    owners(list, business),
  ]);
  const found = await hits(
    list,
    business,
    own.perPerson.map(p => p.person),
  );

  return {
    ...companyFields(business),
    ...documentFields(docs),
    ...(await registerFields(list, kyc, business)),
    ...ownerFields(own),
    ...ids,
    screening_result: screeningText(found),
    ...riskFields(business, found, own),
  };
}

// field: label. The prefix of a name groups them.
const LABELS = {
  applicant_identity: 'Applicant · Identity',
  applicant_contact: 'Applicant · Contact',
  applicant_profile: 'Applicant · Declared profile',
  applicant_volumes: 'Applicant · Expected volumes',
  company_identity: 'Company · Identity',
  company_activity: 'Company · Activity',
  company_volumes: 'Company · Expected volumes',
  company_cards: 'Company · Card acceptance',
  doc_kbis: 'Documents · Kbis extract',
  doc_articles: 'Documents · Articles of association',
  doc_ubo: 'Documents · Beneficial owners declaration',
  doc_id: 'Documents · ID document',
  doc_selfie: 'Documents · Selfie',
  doc_address: 'Documents · Proof of address',
  doc_income: 'Documents · Proof of income',
  docs_complete: 'Documents · Complete',
  register_result: 'Register · Result',
  register_differences: 'Register · Differences',
  owners_ubo: 'Owners · More than 25%',
  owners_minor: 'Owners · 25% or less',
  owners_directors: 'Owners · Directors',
  owners_structure: 'Owners · Structure',
  idcheck_documents: 'ID checks · Documents',
  idcheck_faces: 'ID checks · Face match',
  idcheck_result: 'ID checks · Result',
  screening_result: 'Screening · Result',
  risk_rating_suggested: 'Risk · Suggested rating',
  risk_hits: 'Risk · Screening hits',
  risk_pep: 'Risk · PEP',
  risk_residence: 'Risk · Residence',
  risk_structure: 'Risk · Structure',
  risk_cards: 'Risk · Card sales',
  risk_funds: 'Risk · Occupation and funds',
  risk_volumes: 'Risk · Income vs volumes',
  auto_check: 'Automatic check · Result',
  // The rating "Rate the risk" wrote (the case's risk_after): what Retail onboarding's rule reads.
  risk_decided: 'Risk rating · Decided',
};
const FIELDS = Object.keys(LABELS);

// What the automatic onboarding decides on: a file is clean when its documents are complete, every
// ID and every selfie passed, the screening found nobody and the suggested rating is LOW (each of
// these lines starts with ✓).
// One field says it, so the decision is one rule: "Automatic check · Result" is CLEAN.
const CLEAN = 'CLEAN';
// Each check and the word a reason starts with (short: it is read in a list column).
const AUTO_CHECKS = {
  docs_complete: 'Documents',
  idcheck_result: 'ID check',
  idcheck_faces: 'Selfie',
  screening_result: 'Screening',
  risk_rating_suggested: 'Risk',
};

/** Why a file is not clean, one line per failing check (none: clean). */
function checkReasons(file) {
  return Object.entries(AUTO_CHECKS).flatMap(([field, name]) => {
    const value = file?.[field];
    if (typeof value !== 'string') return [`${name}: not available yet`];
    // Face match has one line per person: each must pass. The others read their first sign.
    const failing =
      field === 'idcheck_faces'
        ? value.split(' · ').filter(line => !line.startsWith(OK))
        : [value].filter(line => !line.startsWith(OK));

    return failing.map(line => `${name}: ${line}`);
  });
}

/** The automatic check: CLEAN, or the first reason the file is not. */
const automaticCheck = file => checkReasons(file)[0] || CLEAN;

/** Everything about one case, with its automatic check and the rating decided (if any). */
async function caseFile(list, kyc): Promise<RecordData> {
  const file = await caseFacts(list, kyc);

  return { ...file, auto_check: automaticCheck(file), risk_decided: kyc.risk_after || null };
}

// What only a check tells. Empty on a case still in the queue until its action runs on it ("Check
// documents", "Screen against sanctions lists": each writes a line named after its check in the
// case's history), so the demo shows the action fill them. The automatic check and the workflows'
// later steps keep reading the facts.
const CHECKED_BY = {
  documents: [
    'doc_kbis',
    'doc_articles',
    'doc_ubo',
    'doc_id',
    'doc_selfie',
    'doc_address',
    'doc_income',
    'docs_complete',
  ],
  screening: ['screening_result', 'risk_hits', 'risk_pep', 'risk_rating_suggested'],
};
const CHECK_OF = Object.fromEntries(
  Object.entries(CHECKED_BY).flatMap(([check, names]) => names.map(name => [name, check])),
);
const UNCHECKED = ['OPEN', 'IN_REVIEW'];

/** The checks already run on a case; every one for a case out of the queue. */
async function checksRun(list, kyc) {
  if (!UNCHECKED.includes(kyc.status)) return new Set(Object.keys(CHECKED_BY));
  const lines = await list(
    'status_changes',
    [eq('record_type', 'KYC_CASES'), eq('record_id', kyc.id), eq('field', Object.keys(CHECKED_BY))],
    ['field'],
  );

  return new Set(lines.map(l => l.field));
}

/** A paper's line, "✓ Who: details" or "✓ Who · ID type no. …", as the result card shows it. */
function paperRow(what, line, ok) {
  const text = line.slice(2);
  const cut = /: | · /.exec(text);
  const who = cut ? text.slice(0, cut.index) : text;
  const details = cut ? text.slice(cut.index + cut[0].length) : text;
  let tone = ok ? 'green' : 'red';
  if (line.startsWith('○')) tone = 'grey';

  return { what, who, details: details.charAt(0).toUpperCase() + details.slice(1), tone, ok };
}

const PAPER_NAMES = {
  id: 'ID document',
  selfie: 'Selfie',
  address: 'Proof of address',
  income: 'Proof of income',
};

/**
 * The papers of a case, checked: the "Documents ·" fields and one row per paper for the result
 * card of "Check documents". Null when the case has nobody to check.
 */
async function documentCheck(list, kyc) {
  const business = await companyOf(list, kyc);

  if (business) {
    const docs = await companyDocuments(list, kyc, business);

    return {
      fields: documentFields(docs),
      rows: docs.map(d => ({ ...paperRow(d.name, d.line, d.ok), who: business.legal_name })),
    };
  }

  const applicants = await applicantsOf(list, kyc);
  if (!applicants) return null;
  const papers = await applicantPapers(list, kyc, applicants);

  return {
    fields: paperFields(papers),
    rows: papers.map(p => paperRow(PAPER_NAMES[p.kind], p.line, p.ok)),
  };
}

function addCaseFile(collection) {
  // One computation per case and request, whichever of its fields are asked for.
  const cache = new WeakMap();
  const checksCache = new WeakMap();

  const fileOf = (record, context) => {
    if (!cache.has(record)) cache.set(record, caseFile(reader(context.dataSource), record));

    return cache.get(record);
  };

  const checksOf = (record, context) => {
    if (!checksCache.has(record)) {
      checksCache.set(record, checksRun(reader(context.dataSource), record));
    }

    return checksCache.get(record);
  };

  const valueOf = async (name, record, context) => {
    if (CHECK_OF[name] && !(await checksOf(record, context)).has(CHECK_OF[name])) return null;

    return (await fileOf(record, context))?.[name] ?? null;
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: 'String',
      dependencies: ['id', 'customer_id', 'type', 'channel', 'status', 'risk_after'],
      getValues: (records, context) => Promise.all(records.map(r => valueOf(name, r, context))),
    }),
  );
  // Filterable, so a rule can test it. Rarely filtered on: emulated, record by record.
  collection.emulateFieldFiltering('auto_check');
  collection.emulateFieldFiltering('risk_decided');
}

export {
  FIELDS,
  applicantRating,
  checkReasons,
  companyRating,
  KBIS_MAX_DAYS,
  LABELS,
  addCaseFile,
  applicantRequest,
  caseFile,
  companyDocuments,
  documentCheck,
  owners,
  reader,
  registerOf,
};
