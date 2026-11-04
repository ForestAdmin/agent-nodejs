/**
 * The evidence a screening analyst reads before deciding on a hit, as fields of the hit (same
 * pattern as case-file.ts): the list entry, our customer or payee, the comparison of the two, the
 * payment screening held, and the decision once taken. One short value per field.
 */
import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import { reader } from '../shared/case-file';
import { PROVIDERS, freezeReport } from '../shared/providers';

const OK = '✓';
const LOOK = '⚠';
const BAD = '✗';
const YEAR = 365.25 * 24 * 3600 * 1000;

const eq = (field, value) =>
  new ConditionTreeLeaf(field, Array.isArray(value) ? 'In' : 'Equal', value);
const frDate = iso => (iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '');
const stamp = iso =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
const euros = n =>
  `${Number(n).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} EUR`;
const label = code => (code ? code.replace(/_/g, ' ').toLowerCase() : '');
const normalize = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
const LIST_NAMES = { EU: 'EU', UN: 'UN', OFAC: 'OFAC', UK_HMT: 'UK HMT', PEP: 'PEP database' };
const KIND = { PERSON: 'person', ENTITY: 'company', VESSEL: 'vessel', AIRCRAFT: 'aircraft' };
const TRIGGERS = {
  ONBOARDING: 'onboarding screening',
  DAILY_RESCREENING: 'daily rescreening of all customers',
  PAYMENT: 'payment screening',
  LIST_UPDATE: 'list update',
};

// ---- the two sides ---------------------------------------------------------------------------

/** Our side of the hit: a person, a company or a payee, with what we know to compare. */
async function subjectOf(list, hit) {
  if (hit.individual_id) {
    const [person] = await list(
      'individuals',
      [eq('id', hit.individual_id)],
      [
        'first_name',
        'last_name',
        'date_of_birth',
        'place_of_birth',
        'nationality',
        'country_of_residence',
      ],
    );
    const members = await list(
      'customer_members',
      [eq('individual_id', hit.individual_id)],
      ['customer_id', 'role'],
    );
    const customers = members.length
      ? await list(
          'customers',
          [
            eq(
              'id',
              members.map(m => m.customer_id),
            ),
          ],
          ['id', 'display_name', 'status', 'risk_rating', 'created_at'],
        )
      : [];

    return { kind: 'person', person, customers };
  }

  if (hit.business_id) {
    const [business] = await list(
      'businesses',
      [eq('id', hit.business_id)],
      ['legal_name', 'registration_number', 'country', 'city', 'industry'],
    );
    const customers = await list(
      'customers',
      [eq('business_id', hit.business_id)],
      ['id', 'display_name', 'status', 'risk_rating', 'created_at'],
    );

    return { kind: 'company', business, customers };
  }

  const [party] = await list(
    'counterparties',
    [eq('id', hit.counterparty_id)],
    ['name', 'country'],
  );
  const [payee] = await list(
    'sct_beneficiaries',
    [eq('counterparty_id', hit.counterparty_id)],
    ['iban', 'bank_name', 'added_at', 'customer_id'],
  );
  const [payer] = payee
    ? await list('customers', [eq('id', payee.customer_id)], ['id', 'display_name'])
    : [];

  return { kind: 'payee', party, payee, payer };
}

async function accountsOf(list, customers) {
  if (!customers.length) return [];

  return list(
    'accounts',
    [
      eq(
        'customer_id',
        customers.map(c => c.id),
      ),
      new ConditionTreeLeaf('status', 'NotEqual', 'CLOSED'),
    ],
    ['id', 'iban', 'status', 'freeze_reason'],
  );
}

// ---- fields ----------------------------------------------------------------------------------

function hitFields(hit, entry) {
  const list = LIST_NAMES[entry.list] || entry.list;

  return {
    hit_list: `${list} list · ${entry.regime || 'no regime stated'} · entry ${
      entry.source_entry_id
    }, listed ${frDate(entry.listed_at)}`,
    hit_entry: `${entry.name} (${KIND[entry.entity_type] || label(entry.entity_type)})${
      entry.aliases ? ` · also known as ${entry.aliases}` : ''
    }`,
    hit_entry_birth: entry.date_of_birth ? frDate(entry.date_of_birth) : 'Not on the list entry',
    hit_entry_country: entry.country || 'Not on the list entry',
    hit_score: `${Number(hit.match_score).toFixed(1)}% · matched on ${String(
      hit.matched_on || 'name',
    ).toLowerCase()}`,
    hit_found: `${PROVIDERS.screening} (simulated) · ${
      TRIGGERS[hit.trigger] || label(hit.trigger)
    }, ${stamp(hit.created_at)}`,
  };
}

const age = born => Math.floor((Date.now() - new Date(born).getTime()) / YEAR);
const since = rows =>
  rows.length ? frDate(rows.map(r => r.created_at).sort()[0]).slice(-4) : null;

const NO_BIRTH = 'Not compared: a company has no date of birth';

/** "Customer since 2021 · risk LOW · 2 account(s) open", or what to say without a customer. */
function relationship(customers, accounts, none) {
  if (!customers.length) return none;
  const frozen = accounts.filter(a => a.status === 'FROZEN').length;

  return `Customer since ${since(customers)} · risk ${customers[0].risk_rating || '?'} · ${
    accounts.length
  } account(s) open${frozen ? `, ${frozen} frozen` : ''}`;
}

function personSide({ person, customers }, accounts) {
  const name = `${person.first_name} ${person.last_name}`;
  const born = person.place_of_birth ? `, born in ${person.place_of_birth}` : '';

  return {
    customer_name: customers.length
      ? `${name} · customer ${customers.map(c => c.display_name).join(', ')}`
      : `${name} · not a customer yet (screened during an onboarding)`,
    customer_birth: `${frDate(person.date_of_birth)} (age ${age(person.date_of_birth)})${born}`,
    customer_country: `Nationality ${person.nationality || '?'}, lives in ${
      person.country_of_residence || '?'
    }`,
    customer_relationship: relationship(customers, accounts, 'No account yet'),
  };
}

function companySide({ business, customers }, accounts) {
  return {
    customer_name: `${business.legal_name} · SIREN ${business.registration_number}`,
    customer_birth: NO_BIRTH,
    customer_country: `Registered in ${business.country || '?'} (${business.city || '?'})`,
    customer_relationship: relationship(
      customers,
      accounts,
      'Not a customer: owner or holding of a customer',
    ),
  };
}

function payeeSide({ party, payee, payer }) {
  const by = payer?.display_name || 'the customer';

  if (!payee) {
    return {
      customer_name: party.name,
      customer_birth: NO_BIRTH,
      customer_country: `Country ${party.country || '?'}`,
      customer_relationship: 'Payee not on file',
    };
  }

  return {
    customer_name: `${party.name} · payee of our customer ${by}`,
    customer_birth: NO_BIRTH,
    customer_country: `Account in ${payee.iban.slice(0, 2)} at ${payee.bank_name} (${payee.iban})`,
    customer_relationship: `Payee added on ${frDate(payee.added_at)} by ${by}`,
  };
}

function customerFields(subject, accounts) {
  if (subject.kind === 'person') return personSide(subject, accounts);
  if (subject.kind === 'company') return companySide(subject, accounts);

  return payeeSide(subject);
}

/** A company or a payee against a listed company: no birth date, the name and country decide. */
function companyComparison(subject, entry) {
  const names = [entry.name, ...String(entry.aliases || '').split(/[;,]/)].map(normalize);
  const company = subject.kind === 'company';
  const ours = company ? subject.business.legal_name : subject.party.name;
  const country = company
    ? subject.business.country
    : subject.payee?.iban.slice(0, 2) || subject.party.country;
  const sameName = names.includes(normalize(ours));
  const sameCountry = country === entry.country;
  const where = country === 'FR' ? 'French' : `based in ${country}`;
  let verdict = `${OK} Different company: ${ours} is ${where}, the listed ${entry.name} is in ${entry.country}; the names only look alike`;

  if (sameName) {
    verdict = `${BAD} Strong match: same name as the listed company, paid to an account in ${country}. Decide by hand`;
  } else if (sameCountry) {
    verdict = `${LOOK} Possible match: close name, same country (${country}). Compare the registration numbers by hand`;
  }

  const alias = normalize(ours) === normalize(entry.name) ? '' : ` (an alias of ${entry.name})`;
  let countryLine = `${sameName ? LOOK : OK} Different: ${
    entry.country
  } on the list, ${country} ours`;
  if (sameCountry) countryLine = `${BAD} Same: ${country}`;

  return {
    compare_name: sameName
      ? `${BAD} Same name: ${ours}${alias}`
      : `${LOOK} Close spelling only: ${ours} vs ${entry.name}`,
    compare_birth: `○ ${NO_BIRTH}`,
    compare_country: countryLine,
    compare_verdict: verdict,
  };
}

function birthLine(ours, theirs, years) {
  if (!theirs) return `${LOOK} No date of birth on the list entry`;
  if (theirs === ours) return `${BAD} Same: ${frDate(ours)}`;

  if (years === 0) {
    return `${LOOK} Same year (${ours.slice(0, 4)}), another day: ${frDate(
      theirs,
    )} on the list, ${frDate(ours)} ours`;
  }

  return `${OK} Different: ${frDate(theirs)} on the list, ${frDate(
    ours,
  )} ours (${years} years apart)`;
}

function personVerdict(sameBirth, sameCountry, theirs, years) {
  if (sameBirth && sameCountry) {
    return `${BAD} Strong match: same name, date of birth and nationality. Decide by hand: a true sanctions match freezes the accounts`;
  }

  if (theirs && years >= 2) return `${OK} Different person: born ${years} years apart`;
  const why = theirs ? 'born the same year, another day' : 'no date of birth to compare';

  return `${LOOK} Possible match: ${why}, ${
    sameCountry ? 'same nationality' : 'another nationality'
  }. Compare by hand`;
}

/** A person against a listed person: the date of birth decides, the nationality backs it. */
function personComparison({ person }, entry) {
  const ours = person.date_of_birth;
  const theirs = entry.date_of_birth;
  const years = theirs ? Math.abs(Number(ours.slice(0, 4)) - Number(theirs.slice(0, 4))) : null;
  const sameBirth = Boolean(theirs) && theirs === ours;
  const sameCountry = Boolean(entry.country) && entry.country === person.nationality;

  return {
    compare_name: `${BAD} Same full name: ${person.first_name} ${person.last_name}`,
    compare_birth: birthLine(ours, theirs, years),
    compare_country: sameCountry
      ? `${sameBirth ? BAD : LOOK} Same nationality: ${entry.country}`
      : `${OK} Different: ${entry.country || '?'} on the list, nationality ${
          person.nationality
        } ours (lives in ${person.country_of_residence})`,
    compare_verdict: personVerdict(sameBirth, sameCountry, theirs, years),
  };
}

/** Our side against the list entry, line by line, then the verdict the lines add up to. */
function comparisonFields(subject, entry) {
  return subject.kind === 'person'
    ? personComparison(subject, entry)
    : companyComparison(subject, entry);
}

async function paymentFields(list, hit) {
  if (!hit.transaction_id) return { payment_held: '○ No payment held by this hit' };
  const [tx] = await list(
    'transactions',
    [eq('id', hit.transaction_id)],
    ['amount', 'status', 'status_reason', 'created_at', 'booked_at', 'reference', 'account_id'],
  );
  // Relations are not there yet at this layer of the agent: each table is read on its own.
  const [account] = await list('accounts', [eq('id', tx.account_id)], ['iban', 'customer_id']);
  const [payer] = await list('customers', [eq('id', account.customer_id)], ['display_name']);
  const [party] = hit.counterparty_id
    ? await list('counterparties', [eq('id', hit.counterparty_id)], ['name'])
    : [];
  const what = `${euros(tx.amount)} from ${payer?.display_name || '?'} (${
    account?.iban || '?'
  }) to ${party?.name || hit.screened_name}${tx.reference ? `, "${tx.reference}"` : ''}`;

  if (tx.status === 'HELD') {
    return { payment_held: `${LOOK} Held since ${stamp(tx.created_at)}: ${what}` };
  }

  if (tx.status === 'BOOKED') {
    return {
      payment_held: `${OK} Released and sent on ${stamp(tx.booked_at)} (${
        PROVIDERS.sepa
      }, simulated): ${what}`,
    };
  }

  return {
    payment_held: `${BAD} ${
      tx.status_reason || (tx.status === 'REJECTED' ? 'Not sent' : label(tx.status))
    }: ${what}`,
  };
}

/** What a true sanctions match did: accounts frozen, cards blocked, the DG Trésor told. */
async function freezeLine(list, hit, accounts) {
  const frozen = accounts.filter(a => a.freeze_reason === 'SANCTIONS');
  const cards = frozen.length
    ? await list(
        'cards',
        [
          eq(
            'account_id',
            frozen.map(a => a.id),
          ),
          eq('status', 'BLOCKED'),
        ],
        ['id'],
      )
    : [];
  const report = freezeReport(hit.id, new Date(hit.reviewed_at).getUTCFullYear());

  return [
    frozen.length && `accounts frozen: ${frozen.map(a => a.iban).join(', ')}`,
    cards.length && `${cards.length} card(s) blocked`,
    `freeze reported to ${PROVIDERS.dgTresor} (simulated), report ${report}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

async function decisionFields(list, hit, accounts) {
  const [inv] = hit.investigation_id
    ? await list('investigations', [eq('id', hit.investigation_id)], ['reference', 'status'])
    : [];
  const mlro = inv
    ? `${BAD} ${inv.reference}, sanctions investigation ${
        inv.status === 'PENDING_MLRO' ? 'waiting for the MLRO' : label(inv.status)
      }`
    : 'Not sent to the MLRO';

  if (hit.status === 'OPEN') {
    return { decision_result: 'Open: no decision yet', decision_mlro: mlro };
  }

  const by = `by ${hit.reviewed_by} on ${stamp(hit.reviewed_at)}`;

  if (hit.status === 'FALSE_POSITIVE') {
    return {
      decision_result: `○ False positive (${hit.decision_reason}), ${by}`,
      decision_mlro: mlro,
    };
  }

  const done = hit.hit_type === 'SANCTIONS' ? ` · ${await freezeLine(list, hit, accounts)}` : '';

  return {
    decision_result: `${BAD} True ${label(hit.hit_type)} match, ${by}${done}`,
    decision_mlro: mlro,
  };
}

const HIT_FIELDS = [
  'id',
  'status',
  'hit_type',
  'match_score',
  'matched_on',
  'trigger',
  'created_at',
  'screened_name',
  'individual_id',
  'business_id',
  'counterparty_id',
  'transaction_id',
  'watchlist_entry_id',
  'investigation_id',
  'reviewed_by',
  'reviewed_at',
  'decision_reason',
];

async function hitFile(list, hit) {
  const [entry] = await list(
    'watchlist_entries',
    [eq('id', hit.watchlist_entry_id)],
    [
      'list',
      'name',
      'aliases',
      'country',
      'date_of_birth',
      'regime',
      'source_entry_id',
      'listed_at',
      'entity_type',
    ],
  );
  const subject = await subjectOf(list, hit);
  const accounts = await accountsOf(list, subject.customers || []);

  return {
    ...hitFields(hit, entry),
    ...customerFields(subject, accounts),
    ...comparisonFields(subject, entry),
    ...(await paymentFields(list, hit)),
    ...(await decisionFields(list, hit, accounts)),
  };
}

// field: label. The prefix groups them, so a workflow step can read one group by its name.
const LABELS = {
  hit_list: 'Hit · List',
  hit_entry: 'Hit · List entry',
  hit_entry_birth: 'Hit · Date of birth on the list',
  hit_entry_country: 'Hit · Country on the list',
  hit_score: 'Hit · Match score',
  hit_found: 'Hit · Found by',
  customer_name: 'Customer · Name',
  customer_birth: 'Customer · Date of birth',
  customer_country: 'Customer · Country',
  customer_relationship: 'Customer · Relationship',
  compare_name: 'Comparison · Name',
  compare_birth: 'Comparison · Date of birth',
  compare_country: 'Comparison · Country',
  compare_verdict: 'Comparison · Verdict',
  payment_held: 'Payment · Held payment',
  decision_result: 'Decision · Result',
  decision_mlro: 'Decision · MLRO',
};
const FIELDS = Object.keys(LABELS);

function addScreeningEvidence(collection) {
  // One computation per hit and request, whichever fields are asked for.
  const cache = new WeakMap();

  const fileOf = (record, context) => {
    if (!cache.has(record)) {
      const list = reader(context.dataSource);
      cache.set(
        record,
        list('screening_hits', [eq('id', record.id)], HIT_FIELDS).then(([hit]) =>
          hit ? hitFile(list, hit) : {},
        ),
      );
    }

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

export { FIELDS, LABELS, addScreeningEvidence };
