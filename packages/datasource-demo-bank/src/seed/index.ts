/**
 * Builds the demo SQLite database: deterministic (fixed seed), consistent (dates and statuses
 * agree), dated relative to today so a demo never looks stale.
 *
 * Every table of the data model is created from data-model.ts, read through schema.ts.
 * Filled so far: parties (retail and business customers, companies and their owners), core banking
 * (counterparties, cards, mandates, six months of transactions), financial crime (KYC, devices,
 * screening, alerts, investigations, SARs, with the stories of stories.ts) and disputes (dispute
 * requests, chargebacks, SEPA disputes, holds, complaints) and e-invoicing (directory entries,
 * invoices, payment matching, e-reporting) and credit (applications, loans and repayments,
 * guarantees, collections, limit requests) and the lifecycle (closures, authority requests,
 * company events, insolvencies, deceased customers, QA reviews).
 * Every id is a UUID, the same on every run.
 */
import knex from 'knex';

import { alertCases } from './alert-cases';
import { coreBanking } from './banking';
import { businessCustomers } from './business';
import { credit } from './credit';
import { financialCrime } from './crime';
import { deskHistory } from './desk-history';
import { disputes } from './disputes';
import { einvoicing } from './einvoicing';
import { lagoonHistory } from './lagoon-history';
import { lifecycle } from './lifecycle';
import { onboardingFunnel } from './onboarding-funnel';
import { paymentsDesk } from './payments-desk';
import { between, reset, withStream } from './random';
import { frenchIban } from './reference';
import { accountRows, memberRows, newCustomer } from './retail';
import { tables } from './schema';
import { assignStories } from './stories';

/** Every row of the demo, before it is written: parties first, then core banking on top. */
function build(count = 300, businessCount = 60) {
  reset();
  let accountNumber = 10450020;

  const nextAccountNumber = () => {
    accountNumber += between(7, 91);

    return accountNumber;
  };

  const rows = { customers: [], individuals: [], customer_members: [], accounts: [] };

  Array.from({ length: count }).forEach(() => {
    const drawn = newCustomer();
    rows.customers.push(drawn.customer);
    memberRows(drawn).forEach(({ individual, member }) => {
      rows.individuals.push(individual);
      rows.customer_members.push(member);
    });
    rows.accounts.push(...accountRows(drawn, nextAccountNumber));
  });

  const companies = businessCustomers(businessCount, rows.individuals.slice(), nextAccountNumber);
  Object.entries(companies).forEach(([table, list]) => {
    rows[table] = (rows[table] || []).concat(list);
  });

  const stories = assignStories(rows);
  coreBanking(rows, stories);
  // The guided alerts last: they draw nothing from the random stream (alert-cases.ts). Then, with
  // no draw from the seeded stream either, the payments desk's open cases, and the compliance
  // queues on the customers nobody took (crime.ts complianceQueue).
  financialCrime(
    rows,
    stories,
    [disputes, einvoicing, credit, lifecycle, alertCases],
    [paymentsDesk],
  );
  // Last, on a stream of its own: 26 weeks of applications, decided (onboarding-funnel.ts).
  withStream('onboarding-funnel', () => onboardingFunnel(rows));
  // Then the other desks' half year of decided work, on a stream of its own (desk-history.ts).
  withStream('desk-history', () => deskHistory(rows, stories));
  // Last of all, on its own stream: Lagoon's applications and the partner on every row
  // (lagoon-history.ts).
  withStream('lagoon-history', () => lagoonHistory(rows));

  return { rows, stories };
}

const COLUMN = {
  uuid: (t, name) => t.uuid(name),
  enum: (t, name) => t.string(name),
  string: (t, name) => t.string(name),
  integer: (t, name) => t.integer(name),
  decimal: (t, name) => t.decimal(name, 14, 2),
  date: (t, name) => t.date(name),
  datetime: (t, name) => t.datetime(name),
  boolean: (t, name) => t.boolean(name),
  json: (t, name) => t.json(name),
};

function defineColumns(t, fields) {
  fields.forEach(field => {
    const column = COLUMN[field.type](t, field.name);
    if (field.primaryKey) column.primary();
  });

  // Join tables have no id: their two links are the key, or Forest cannot open their rows.
  if (!fields.some(f => f.primaryKey)) {
    t.primary(fields.filter(f => f.foreignKey).map(f => f.name));
  }
}

/**
 * Writes the demo to the SQLite file `filename`. `extend` (optional) adds rows to the built ones
 * (table → rows) before anything is written.
 */
async function seed(filename, extend?: (rows) => Promise<void>) {
  const db = knex({ client: 'sqlite3', connection: { filename }, useNullAsDefault: true });

  try {
    const { rows } = build();
    if (extend) await extend(rows);
    // A demo database, written once at boot: no journal to keep, one transaction for every row
    // (each batch committed on its own made the disk the slowest part of the seed).
    await db.raw('PRAGMA journal_mode = OFF');
    await db.raw('PRAGMA synchronous = OFF');
    await db.transaction(async trx => {
      // Tables are created and filled one after the other, in batches SQLite accepts.
      /* eslint-disable no-await-in-loop */
      for (const [table, { fields }] of Object.entries(tables)) {
        await trx.schema.createTable(table, t => defineColumns(t, fields));
        const list = rows[table] || [];

        for (let i = 0; i < list.length; i += 200) {
          await trx(table).insert(list.slice(i, i + 200));
        }
      }
      /* eslint-enable no-await-in-loop */
    });

    return Object.fromEntries(Object.entries(rows).map(([table, list]) => [table, list.length]));
  } finally {
    await db.destroy();
  }
}

export { seed, build, frenchIban };
