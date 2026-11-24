/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
import type { DemoField } from '../src/connections/data-model';
import type { Sequelize } from 'sequelize';

import { build } from '@forestadmin/datasource-demo-bank/dist/seed/index';
import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname } from 'path';

import { demoFields } from '../src/connections/data-model';
import mongoose, { DOCUMENT_CHECK_FIELDS } from '../src/connections/mongoose';
import sequelizeMariaDb from '../src/connections/sequelize-mariadb';
import sequelizeMsSql from '../src/connections/sequelize-mssql';
import sequelizeMySql from '../src/connections/sequelize-mysql';
import sequelizePostgres from '../src/connections/sequelize-postgres';
import sequelizeSqlite, { SQLITE_STORAGE } from '../src/connections/sequelize-sqlite';
import { MERCHANTS_FILE } from '../src/merchants-api';

type Row = Record<string, unknown>;
type Rows = Record<string, Row[]>;

const SQL_ROWS_PER_INSERT = 500;
const MONGO_DOCUMENTS_PER_INSERT = 5000;
const ENTRY_MODES_WITH_A_DEVICE = ['ONLINE', 'MOBILE_WALLET'];

const SQL_TABLES: Array<[Sequelize, string[]]> = [
  [sequelizePostgres, ['customers', 'individuals', 'businesses', 'accounts', 'customer_members']],
  [sequelizeMySql, ['transactions', 'counterparties']],
  [sequelizeMsSql, ['chargebacks', 'dispute_requests', 'dispute_transactions']],
  [sequelizeMariaDb, ['cards']],
  [sequelizeSqlite, ['alerts', 'investigations', 'sar_reports', 'status_changes']],
];
const HISTORY_OF_EXPOSED_TABLES = [
  'CUSTOMERS',
  'KYC_CASES',
  'ALERTS',
  'INVESTIGATIONS',
  'SAR_REPORTS',
  'DISPUTE_REQUESTS',
  'CHARGEBACKS',
];

function groupBy(rows: Row[], key: string): Map<unknown, Row[]> {
  const groups = new Map<unknown, Row[]>();
  rows.forEach(row => groups.set(row[key], [...(groups.get(row[key]) ?? []), row]));

  return groups;
}

function withDates(row: Row, fields: DemoField[]): Row {
  const dated = { ...row };

  fields
    .filter(field => ['date', 'datetime'].includes(field.type) && row[field.name])
    .forEach(field => {
      dated[field.name] = new Date(row[field.name] as string);
    });

  return dated;
}

async function seedSqlTables(rows: Rows) {
  for (const [connection, tables] of SQL_TABLES) {
    await connection.sync({ force: true });

    for (const table of tables) {
      const model = connection.model(table);
      const list = rows[table] ?? [];

      for (let i = 0; i < list.length; i += SQL_ROWS_PER_INSERT) {
        await model.bulkCreate(list.slice(i, i + SQL_ROWS_PER_INSERT), { validate: false });
      }

      console.log(`${table}: ${list.length} rows (${connection.getDialect()})`);
    }
  }

  await sequelizeMariaDb.query(`
    CREATE OR REPLACE VIEW active_cards AS
    SELECT * FROM cards WHERE status = 'ACTIVE'
  `);
}

function kycCaseDocuments(rows: Rows) {
  const documentFields = demoFields('documents');
  const documentsByCase = groupBy(rows.documents, 'kyc_case_id');
  const individuals = new Map(rows.individuals.map(individual => [individual.id, individual]));
  const membersByCustomer = groupBy(rows.customer_members, 'customer_id');

  const applicantOf = (customerId: unknown) => {
    const members = membersByCustomer.get(customerId) ?? [];
    const member = members.find(m => m.is_primary_contact) ?? members[0];
    const individual = member && individuals.get(member.individual_id);

    return individual
      ? {
          first_name: individual.first_name,
          last_name: individual.last_name,
          date_of_birth: individual.date_of_birth,
          nationality: individual.nationality,
        }
      : null;
  };

  const caseDocument = ({ id, ...document }: Row) => {
    const embedded: Row = { _id: id, check: {} };

    Object.entries(withDates(document, documentFields)).forEach(([field, value]) => {
      if (DOCUMENT_CHECK_FIELDS[field]) {
        (embedded.check as Row)[DOCUMENT_CHECK_FIELDS[field]] = value;
      } else {
        embedded[field] = value;
      }
    });

    return embedded;
  };

  return rows.kyc_cases.map(({ id, ...kycCase }) => ({
    _id: id,
    ...kycCase,
    applicant: applicantOf(kycCase.customer_id),
    documents: (documentsByCase.get(id) ?? []).map(caseDocument),
  }));
}

function cardTransactionDocuments(rows: Rows) {
  const fields = demoFields('card_transactions');
  const holders = new Map(rows.cards.map(card => [card.id, card.holder_id]));
  const deviceByIndividual = new Map(
    [...groupBy(rows.devices, 'individual_id')].map(([individualId, devices]) => [
      individualId,
      devices[0],
    ]),
  );

  const deviceOf = (cardTransaction: Row) => {
    if (!ENTRY_MODES_WITH_A_DEVICE.includes(cardTransaction.entry_mode as string)) return null;
    const device = deviceByIndividual.get(holders.get(cardTransaction.card_id));

    return device
      ? {
          id: device.id,
          individual_id: device.individual_id,
          platform: device.platform,
          device_name: device.device_name,
          app_version: device.app_version,
          is_trusted: device.is_trusted,
        }
      : null;
  };

  return rows.card_transactions.map(row => {
    const {
      id,
      authorization_code: code,
      entry_mode: entryMode,
      is_3ds: is3ds,
      wallet_type: walletType,
      authorized_at: authorizedAt,
      decline_reason: declineReason,
      ...cardTransaction
    } = withDates(row, fields);

    return {
      _id: id as string,
      ...cardTransaction,
      authorization: {
        code,
        entry_mode: entryMode,
        is_3ds: is3ds,
        wallet_type: walletType,
        authorized_at: authorizedAt,
        decline_reason: declineReason,
      },
      device: deviceOf(row),
    };
  });
}

async function seedMongo(rows: Rows) {
  await mongoose.asPromise();
  await mongoose.dropDatabase();

  const kycCases = kycCaseDocuments(rows);
  await mongoose.model('kyc_cases').insertMany(kycCases);
  console.log(`kyc_cases: ${kycCases.length} documents (mongoose)`);

  const cardTransactions = cardTransactionDocuments(rows);
  const collection = mongoose.db.collection<{ _id: string }>('card_transactions');

  for (let i = 0; i < cardTransactions.length; i += MONGO_DOCUMENTS_PER_INSERT) {
    await collection.insertMany(cardTransactions.slice(i, i + MONGO_DOCUMENTS_PER_INSERT));
  }

  console.log(`card_transactions: ${cardTransactions.length} documents (mongo)`);
}

async function seedMerchantsApi(rows: Rows) {
  const counterparties = new Map(rows.counterparties.map(c => [c.id, c.name]));
  const merchants = rows.card_merchants.map(merchant => ({
    ...merchant,
    name: counterparties.get(merchant.counterparty_id) ?? null,
  }));

  await writeFile(MERCHANTS_FILE, JSON.stringify(merchants, null, 2));
  console.log(`card_merchants: ${merchants.length} records (${MERCHANTS_FILE})`);
}

async function closeConnections() {
  for (const [connection] of SQL_TABLES) await connection.close();
  await mongoose.close();
}

async function seedData() {
  const { rows } = build() as { rows: Rows };
  rows.status_changes = rows.status_changes.filter(change =>
    HISTORY_OF_EXPOSED_TABLES.includes(change.record_type as string),
  );

  try {
    await mkdir(dirname(SQLITE_STORAGE), { recursive: true });
    await rm(SQLITE_STORAGE, { force: true });
    await seedSqlTables(rows);
    await seedMongo(rows);
    await seedMerchantsApi(rows);
  } finally {
    await closeConnections();
  }
}

(async () => {
  console.log('Beginning seed...');

  try {
    await seedData();
    console.log('Seed completed! 🌱');
  } catch (error) {
    console.error('The seed failed');
    console.error(error);
    process.exitCode = 1;
  }
})();
