import type { Customer } from './types';
import type { Knex } from 'knex';

import { daysAgo } from './dates';
import {
  CITIES,
  COUNTRIES,
  DIAL,
  FIRST,
  HIGH_RISK_COUNTRIES,
  LAST,
  STREETS,
  deaccent,
} from './pools';
import { chance, insertAll, pick, randint, sample, shuffle } from './utils';

const N = 150;

/**
 * Builds the customer base, then derives every other table from it. Risk rating,
 * PEP/sanctions flags and onboarding status are correlated on purpose: sanctioned
 * customers never clear onboarding, high-risk ones skew towards risky countries.
 */
export default async function seedCustomers(knex: Knex): Promise<Customer[]> {
  await knex.schema.createTable('customers', table => {
    table.increments('id').primary();
    table.string('first_name');
    table.string('last_name');
    table.string('email');
    table.string('phone');
    table.date('date_of_birth');
    table.string('nationality');
    table.string('country_of_residence');
    table.string('address_line1');
    table.string('address_line2');
    table.string('city');
    table.string('postal_code');
    table.string('country');
    table.string('onboarding_status');
    table.string('risk_rating');
    table.boolean('is_pep');
    table.boolean('is_sanctioned');
    table.string('referral_code');
    table.datetime('created_at');
    table.datetime('updated_at');
  });

  const nHigh = Math.round(N * 0.2);
  const nMed = Math.round(N * 0.33);
  const riskPlan = shuffle([
    ...Array<string>(nHigh).fill('HIGH'),
    ...Array<string>(nMed).fill('MEDIUM'),
    ...Array<string>(N - nHigh - nMed).fill('LOW'),
  ]);
  const ids = Array.from({ length: N }, (_, i) => i + 1);
  const highIds = ids.filter(i => riskPlan[i - 1] === 'HIGH');
  const elevatedIds = ids.filter(i => ['HIGH', 'MEDIUM'].includes(riskPlan[i - 1]));
  const sanctionedIds = new Set(sample(highIds, Math.max(2, Math.round(N * 0.035))));
  const pepIds = new Set(sample(elevatedIds, Math.max(4, Math.round(N * 0.08))));

  const customers: Customer[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i <= N; i += 1) {
    const fn = FIRST[(i - 1) % FIRST.length];
    const ln = LAST[(i * 7) % LAST.length];
    const risk = riskPlan[i - 1];
    const sanctioned = sanctionedIds.has(i);
    const pep = pepIds.has(i);

    let cor: string;
    let onb: string;

    if (risk === 'HIGH') {
      cor = chance(0.5) ? pick(HIGH_RISK_COUNTRIES) : pick(COUNTRIES);
      onb = pick(['APPROVED', 'PENDING_REVIEW', 'REJECTED']);
    } else if (risk === 'MEDIUM') {
      cor = pick(COUNTRIES);
      onb = pick(['APPROVED', 'APPROVED', 'PENDING_REVIEW']);
    } else {
      cor = pick(COUNTRIES);
      onb = pick(['APPROVED', 'APPROVED', 'APPROVED', 'STARTED']);
    }

    if (sanctioned) onb = pick(['REJECTED', 'PENDING_REVIEW']); // never clears onboarding

    const country = CITIES[cor] ? cor : pick(COUNTRIES);
    const [city, postal] = pick(CITIES[country]);
    const created = randint(60, 220);

    const slug = deaccent(`${fn.toLowerCase()}.${ln.toLowerCase()}`);
    let email = `${slug}@example.com`;
    if (seenEmails.has(email)) email = `${slug}${i}@example.com`; // names repeat at scale
    seenEmails.add(email);

    customers.push({
      id: i,
      first_name: fn,
      last_name: ln,
      email,
      phone: `+${DIAL[cor] ?? '33'} ${randint(600, 799)} ${randint(100000, 999999)}`,
      date_of_birth: `${randint(1962, 2003)}-${String(randint(1, 12)).padStart(2, '0')}-${String(
        randint(1, 28),
      ).padStart(2, '0')}`,
      nationality: pick(COUNTRIES),
      country_of_residence: cor,
      address_line1: `${pick(STREETS)} ${randint(1, 180)}`,
      address_line2: chance(0.8) ? null : `Apt ${randint(1, 40)}`,
      city,
      postal_code: postal,
      country,
      onboarding_status: onb,
      risk_rating: risk,
      is_pep: pep,
      is_sanctioned: sanctioned,
      referral_code: chance(0.7) ? null : `REF${randint(1000, 9999)}`,
      created_at: daysAgo(created),
      updated_at: daysAgo(randint(1, Math.max(2, created - 10))),
    });
  }

  await insertAll(knex, 'customers', customers);

  return customers;
}
