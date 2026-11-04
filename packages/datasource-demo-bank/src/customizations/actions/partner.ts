/**
 * The two Smart Actions a partner's app calls through Forest's Gateway API (B2B2X: the partner
 * brings the customer, the bank does the KYC). The Gateway has no create or update route, so the
 * partner writes through actions (the CLI's PARTNER_PORTAL.md shows how).
 *
 * - "Submit application" (Global, on kyc_cases): the person, the retail customer and its OPEN
 *   onboarding case, channel PARTNER, partner = the partner's name on the customer and the case
 *   (a partner team's Forest scope reads it), also in the case notes ("Partner: Lagoon"). It
 *   lands in the Retail onboarding inbox like any application (live.js writes them the same way).
 * - "Upload document" (Single, on kyc_cases): one paper, fetched from the portal (uploads.js) or
 *   given as a small File, stored like the papers the bank's app sends: a documents row waiting
 *   for its check, the file at the bank's own address.
 *
 * Both run as the Gateway's service account: Forest's activity log names it.
 */
import { randomUUID } from 'crypto';

import { tables } from '../../model/schema';
import {
  ID_FILES,
  applicant,
  documentRow,
  forestStore,
  newRun,
  onboardingCase,
} from '../../seed/live';
import { scanFlaw } from '../../seed/random';
import { COUNTRIES, LANGUAGE } from '../../seed/reference';
import { badge, card } from '../shared/render';
import { UploadError, fetchUpload, fromFileField, keep, safeName } from '../shared/uploads';

const DAY = 24 * 3600 * 1000;
const CLOSED_CASE = ['APPROVED', 'REJECTED'];
const ID_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'];
// The papers a person sends when opening a retail account.
const RETAIL_PAPERS = [
  ...ID_TYPES,
  'SELFIE',
  'PROOF_OF_ADDRESS',
  'PROOF_OF_INCOME',
  'BANK_STATEMENT',
];
const REVIEW_YEARS = { LOW: 3, MEDIUM: 2, HIGH: 1 };
// The flaws an ID's scan can show (random.js scanFlaw); a selfie's or a bill's mean nothing on an ID.
const ID_SCANS = ['clean', 'glare', 'cropped', 'name'];
// A bill addressed to someone else is read as such on arrival (the bank reads the name and date).
const OTHER_NAME = 'Name does not match the application: the bill is addressed to someone else';
const READER = 'Document reading on arrival';
const COUNTRY = /^[A-Z]{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const enumOf = (table, field) => tables[table].fields.find(f => f.name === field).enum;
const label = code =>
  code === 'DRIVERS_LICENSE' ? 'driving licence' : code.replace(/_/g, ' ').toLowerCase();
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
const text = value => String(value ?? '').trim();

// A Date field's day as typed, whatever time zone it travels with (1990-05-12T00:00:00+02:00).
// Null when it is no real day: 2024-02-31 is not read as March 2nd.
const dayOf = value => {
  if (!value) return null;
  const typed = /^\d{4}-\d{2}-\d{2}/.exec(String(value));
  const date = new Date(typed ? `${typed[0]}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toISOString().slice(0, 10);

  return !typed || day === typed[0] ? day : null;
};

const dayStamp = (run, value) =>
  dayOf(value) ? run.stamp(new Date(`${dayOf(value)}T00:00:00Z`)) : null;
const notAmount = value =>
  value === null ||
  value === undefined ||
  value === '' ||
  !Number.isFinite(Number(value)) ||
  Number(value) < 0;
const money = n => Math.round(Number(n) * 100) / 100;
const euros = n => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR`;

// ---------------------------------------------------------------------------------------------
// Submit application
// ---------------------------------------------------------------------------------------------

const APPLICATION_FORM = [
  {
    label: 'Partner',
    type: 'String',
    isRequired: true,
    description: 'The partner app the customer applied through',
  },
  { label: 'Partner reference', type: 'String', description: 'The application id at the partner' },
  { label: 'First name', type: 'String', isRequired: true },
  { label: 'Last name', type: 'String', isRequired: true },
  { label: 'Birth name', type: 'String' },
  { label: 'Date of birth', type: 'Date', isRequired: true },
  { label: 'Place of birth', type: 'String' },
  { label: 'Nationality', type: 'String', isRequired: true, description: 'Country code: FR, DE…' },
  { label: 'Email', type: 'String', isRequired: true },
  { label: 'Phone', type: 'String', isRequired: true },
  { label: 'Address', type: 'String', isRequired: true },
  { label: 'Address line 2', type: 'String' },
  { label: 'Postal code', type: 'String', isRequired: true },
  { label: 'City', type: 'String', isRequired: true },
  { label: 'Country', type: 'String', isRequired: true, description: 'Country code: FR, DE…' },
  { label: 'Tax residence', type: 'String', description: 'Country code; the address by default' },
  { label: 'Tax ID', type: 'String' },
  { label: 'US person', type: 'Boolean' },
  {
    label: 'Employment status',
    type: 'Enum',
    enumValues: enumOf('individuals', 'employment_status'),
    isRequired: true,
  },
  { label: 'Occupation', type: 'String', isRequired: true },
  { label: 'Employer', type: 'String' },
  {
    label: 'Income band',
    type: 'Enum',
    enumValues: enumOf('individuals', 'income_band'),
    isRequired: true,
  },
  {
    label: 'Source of funds',
    type: 'Enum',
    enumValues: enumOf('individuals', 'source_of_funds'),
    isRequired: true,
  },
  { label: 'Source of wealth', type: 'String' },
  { label: 'Expected monthly income', type: 'Number', isRequired: true, description: 'EUR' },
  { label: 'Expected monthly spending', type: 'Number', isRequired: true, description: 'EUR' },
  {
    label: 'Preferred language',
    type: 'Enum',
    enumValues: enumOf('customers', 'preferred_language'),
  },
];

const filled = names => values => names.every(name => text(values[name]));
// The agent does not hold an Enum field to its list when the action runs: the rules do.
const listed = name => values =>
  APPLICATION_FORM.find(field => field.label === name).enumValues.includes(values[name]);
const countryCode = name => values => COUNTRY.test(text(values[name]).toUpperCase());

const adult = values => {
  const day = dayOf(values['Date of birth']);
  const age = day ? (Date.now() - new Date(day).getTime()) / (365.25 * DAY) : NaN;

  return age >= 18 && age <= 120;
};

// What an application must hold, and how the error names it when it does not.
const APPLICATION_RULES: [(values) => unknown, string][] = [
  [filled(['Partner']), 'the partner'],
  [filled(['First name', 'Last name']), 'a first and a last name'],
  [adult, 'a date of birth at least 18 years ago'],
  [countryCode('Nationality'), 'a nationality as a 2-letter country code'],
  [countryCode('Country'), 'a country as a 2-letter country code'],
  [v => !text(v['Tax residence']) || countryCode('Tax residence')(v), 'a 2-letter tax residence'],
  [v => EMAIL.test(text(v.Email)), 'a valid email'],
  [filled(['Phone']), 'a phone number'],
  [filled(['Address', 'Postal code', 'City']), 'a full address'],
  [filled(['Occupation']), 'an occupation'],
  [listed('Employment status'), 'an employment status from its list'],
  [listed('Income band'), 'an income band from its list'],
  [listed('Source of funds'), 'a source of funds from its list'],
  [v => !v['Preferred language'] || listed('Preferred language')(v), 'a language from its list'],
  [v => !notAmount(v['Expected monthly income']), 'the expected monthly income'],
  [v => !notAmount(v['Expected monthly spending']), 'the expected monthly spending'],
];

/** What the form says, or why the bank cannot take it. */
function readApplication(values) {
  const v = name => text(values[name]);
  const code = name => v(name).toUpperCase();
  const problems = APPLICATION_RULES.filter(([holds]) => !holds(values)).map(([, what]) => what);
  if (problems.length) return { error: `The application needs ${problems.join(', ')}.` };

  return {
    partner: v('Partner'),
    partnerReference: v('Partner reference') || null,
    person: {
      first_name: v('First name'),
      last_name: v('Last name'),
      birth_name: v('Birth name') || null,
      date_of_birth: dayOf(values['Date of birth']),
      nationality: code('Nationality'),
      place_of_birth: v('Place of birth') || null,
      country_of_residence: code('Country'),
      address_line1: v('Address'),
      address_line2: v('Address line 2') || null,
      postal_code: v('Postal code'),
      city: v('City'),
      country: code('Country'),
      email: v('Email').toLowerCase(),
      phone: v('Phone'),
      is_pep: false,
      is_sanctioned: false,
      occupation: v('Occupation'),
      employment_status: values['Employment status'],
      employer: v('Employer') || null,
      income_band: values['Income band'],
      source_of_funds: values['Source of funds'],
      source_of_wealth: v('Source of wealth') || null,
      tax_residence: code('Tax residence') || code('Country'),
      tax_id: v('Tax ID') || null,
      is_us_person: values['US person'] === true || values['US person'] === 'true',
    },
    monthlyIn: money(values['Expected monthly income']),
    monthlyOut: money(values['Expected monthly spending']),
    language: values['Preferred language'] || null,
  };
}

/**
 * The risk the bank starts from, on what the applicant declared: medium when they live outside the
 * countries the bank serves, declare a top income or expect large sums. Screening and the ID check
 * come later, in the onboarding workflow.
 */
function declaredRisk({ person, monthlyIn, monthlyOut }: { person?; monthlyIn?; monthlyOut? }) {
  const abroad = !COUNTRIES[person.country] || person.tax_residence !== person.country;
  const large = Math.max(monthlyIn, monthlyOut) > 15000 || person.income_band === 'ABOVE_120K';

  return abroad || large || person.is_us_person ? 'MEDIUM' : 'LOW';
}

/** The person's earlier application or customer file, if they have one. */
async function earlierFile(run, person) {
  const [twin] = await run.store.list(
    'individuals',
    [
      ['first_name', '=', person.first_name],
      ['last_name', '=', person.last_name],
      ['date_of_birth', '=', person.date_of_birth],
    ],
    ['id'],
  );
  if (!twin) return null;
  const members = await run.store.list(
    'customer_members',
    [['individual_id', '=', twin.id]],
    ['customer_id'],
  );
  const [open] = await run.store.list(
    'kyc_cases',
    [
      ['customer_id', 'in', members.map(m => m.customer_id)],
      ['type', '=', 'ONBOARDING'],
      ['status', '!in', CLOSED_CASE],
    ],
    ['reference'],
  );

  return open ? `has an application in progress (${open.reference})` : 'is known to the bank';
}

function applicationCard(application, customer, kyc, risk) {
  const { person, partner, partnerReference } = application;

  return card({
    eyebrow: `Partner: ${partner}`,
    title: `Application ${kyc.reference}`,
    status: ['Waiting for documents', 'grey'],
    rows: [
      ['Applicant', `${person.first_name} ${person.last_name}`],
      ['Customer', `${customer.reference} · retail · onboarding`],
      ['Partner reference', partnerReference],
      ['Lives in', `${person.postal_code} ${person.city}, ${person.country}`],
      ['Declared income', `${label(person.income_band)} · ${label(person.source_of_funds)}`],
      [
        'Expected per month',
        `${euros(application.monthlyIn)} in, ${euros(application.monthlyOut)} out`,
      ],
      ['Starting risk', { html: badge(risk, risk === 'LOW' ? 'green' : 'amber') }],
      ['Due', kyc.due_at && String(kyc.due_at).slice(0, 10)],
    ],
    note: 'In the Retail onboarding inbox. The partner sends the papers with "Upload document".',
  });
}

async function submitApplication(context, resultBuilder) {
  const application = readApplication(context.formValues);
  if (application.error) return resultBuilder.error(application.error);
  const run = newRun(forestStore(context.dataSource));
  const { person } = application;
  const known = await earlierFile(run, person);
  if (known) return resultBuilder.error(`${person.first_name} ${person.last_name} ${known}.`);

  const individual = { id: randomUUID(), ...person, created_at: run.at(9), updated_at: run.at(9) };
  await run.store.insert('individuals', individual);
  const risk = declaredRisk(application);
  const ascii = person.last_name
    .normalize('NFD')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
  const customer = await applicant(
    run,
    {
      display_name: `${person.first_name} ${person.last_name}`,
      customer_type: 'RETAIL',
      risk_rating: risk,
      referral_code: `${ascii || 'LAB'}${1000 + Math.floor(Math.random() * 9000)}`,
      expected_monthly_in: application.monthlyIn,
      expected_monthly_out: application.monthlyOut,
      next_review_at: run.stamp(new Date(run.now.getTime() + REVIEW_YEARS[risk] * 365 * DAY)),
      preferred_language: application.language || LANGUAGE[person.country] || 'EN',
      onboarding_channel: 'PARTNER',
      // Its own field, so Forest can scope the partner's team to its own clients.
      partner: application.partner,
    },
    { individual_id: individual.id, role: 'HOLDER' },
    { device: false },
  );
  const notes = `Partner: ${application.partner}${
    application.partnerReference ? ` · application ${application.partnerReference}` : ''
  }`;
  const kyc = await onboardingCase(
    run,
    customer,
    { notes, partner: application.partner },
    `Application received from ${application.partner}`,
  );

  return resultBuilder.success(
    `Application ${kyc.reference} received from Partner: ${application.partner}, for ${customer.display_name} (${customer.reference}).`,
    { html: applicationCard(application, customer, kyc, risk) },
  );
}

// ---------------------------------------------------------------------------------------------
// Upload document
// ---------------------------------------------------------------------------------------------

const UPLOAD_FORM = [
  { label: 'Document type', type: 'Enum', enumValues: RETAIL_PAPERS, isRequired: true },
  {
    label: 'File URL',
    type: 'String',
    description:
      'A link on the partner portal: the bank fetches the file (the Gateway takes 16 KB per call)',
  },
  { label: 'File', type: 'File', description: 'Or the file itself, if it is very small' },
  { label: 'File name', type: 'String', description: 'Optional: the name the customer gave it' },
  { label: 'Document number', type: 'String', description: 'IDs only' },
  { label: 'Issued on', type: 'Date' },
  { label: 'Expires on', type: 'Date', description: 'IDs only' },
  { label: 'Issuing country', type: 'String', description: 'IDs only; nationality by default' },
];

/** An id whose scan shows `flaw` (random.js scanFlaw), so the ID check reads what the file shows. */
function idWithScan(flaw) {
  let id = randomUUID();
  while (scanFlaw(id) !== flaw) id = randomUUID();

  return id;
}

/** The person behind the case's customer: its primary contact. */
async function holderOf(run, customerId) {
  const members = await run.store.list(
    'customer_members',
    [['customer_id', '=', customerId]],
    ['individual_id', 'is_primary_contact'],
  );
  const member = members.find(m => m.is_primary_contact) || members[0];
  if (!member?.individual_id) return null;
  const [person] = await run.store.list(
    'individuals',
    [['id', '=', member.individual_id]],
    ['id', 'last_name', 'nationality'],
  );

  return person || null;
}

/** The file, and the portal origin it came from (null for a File given inline). */
async function receivedFile(values) {
  if (values.File?.buffer) return { file: fromFileField(values.File), origin: null };

  if (text(values['File URL'])) {
    const file = await fetchUpload(values['File URL']);

    return { file, origin: new URL(text(values['File URL'])).origin };
  }

  throw new UploadError('Give a File URL on the partner portal, or the file itself.');
}

/** The name the bank files it under: the customer's own name for it, or the app's. */
function fileName(type, person, file, given) {
  if (text(given)) return safeName(given, file.name.split('.').pop());

  if (ID_FILES[type] && person) {
    const name = person.last_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z]/g, '');

    return `${ID_FILES[type]}_${name}.${file.name.split('.').pop()}`;
  }

  return file.name;
}

function uploadCard(kyc, type, row, file, origin) {
  return card({
    eyebrow: origin ? `Partner upload · ${origin}` : 'Partner upload',
    title: `${capital(label(type))} received`,
    status: row.failure_reason
      ? [`Refused: ${row.failure_reason}`, 'red']
      : ['Waiting for its check', 'grey'],
    rows: [
      ['Case', kyc.reference],
      [
        'File',
        `${row.file_name} · ${file.mime} · ${Math.max(
          1,
          Math.round(file.buffer.length / 1024),
        )} KB`,
      ],
      ['Document number', row.document_number],
      ['Issued', row.issued_at && String(row.issued_at).slice(0, 10)],
      ['Expires', row.expires_at && String(row.expires_at).slice(0, 10)],
    ],
    note: 'Copied to the bank’s document store; the onboarding workflow checks it.',
  });
}

/** The documents row of an uploaded paper, filed like the app's. */
function uploadRow(run, kyc, person, file, values) {
  const type = values['Document type'];
  const isId = ID_TYPES.includes(type);
  const id = isId ? idWithScan(ID_SCANS.includes(file.scan) ? file.scan : 'clean') : randomUUID();
  const name = fileName(type, person, file, values['File name']);
  // The date the customer typed, or the one printed on the paper.
  const issued = values['Issued on'] || file.issued;
  const otherName = type === 'PROOF_OF_ADDRESS' && file.scan === 'other_name';

  return {
    id,
    document_type: type,
    individual_id: person?.id || null,
    document_number: isId ? text(values['Document number']) || null : null,
    issued_at: dayStamp(run, issued),
    expires_at: isId ? dayStamp(run, values['Expires on']) : null,
    issuing_country: isId
      ? text(values['Issuing country']).toUpperCase() || person?.nationality || null
      : null,
    file_name: name,
    file_url: `https://files.forest-lab-bank.fr/kyc/${kyc.customer_id}/${id}/${name}`,
    partner: kyc.partner || null,
    ...(otherName && {
      check_result: 'FAILED',
      failure_reason: OTHER_NAME,
      verified_at: run.stamp(new Date()),
      verified_by: READER,
    }),
  };
}

async function uploadDocument(context, resultBuilder) {
  const kyc = await context.getRecord(['id', 'reference', 'status', 'customer_id', 'partner']);

  if (CLOSED_CASE.includes(kyc.status)) {
    return resultBuilder.error(`${kyc.reference} is ${kyc.status.toLowerCase()} already.`);
  }

  const values = context.formValues;
  const type = values['Document type'];
  if (!RETAIL_PAPERS.includes(type)) return resultBuilder.error('Pick the type of document.');

  const notADay = ['Issued on', 'Expires on'].find(name => values[name] && !dayOf(values[name]));
  if (notADay) return resultBuilder.error(`${notADay} is not a real date.`);

  let file;
  let origin;

  try {
    ({ file, origin } = await receivedFile(values));
  } catch (error) {
    if (error instanceof UploadError) return resultBuilder.error(error.message);
    throw error;
  }

  const run = newRun(forestStore(context.dataSource));
  const person = await holderOf(run, kyc.customer_id);
  const row = uploadRow(run, kyc, person, file, values);
  await documentRow(run, kyc, 0, row);
  keep(row.id, { ...file, name: row.file_name });
  await run.store.patch('kyc_cases', kyc.id, { updated_at: run.stamp(new Date()) });

  return resultBuilder.success(
    `${capital(label(type))} added to ${kyc.reference}, ${
      row.failure_reason ? `refused: ${row.failure_reason.toLowerCase()}` : 'waiting for its check'
    }.`,
    { html: uploadCard(kyc, type, row, file, origin) },
  );
}

function addPartnerActions(collection) {
  collection.addAction('Submit application', {
    scope: 'Global',
    form: APPLICATION_FORM,
    execute: submitApplication,
  });
  collection.addAction('Upload document', {
    scope: 'Single',
    form: UPLOAD_FORM,
    execute: uploadDocument,
  });
}

export { RETAIL_PAPERS, addPartnerActions, declaredRisk, readApplication };
