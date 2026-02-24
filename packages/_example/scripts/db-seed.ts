/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { faker } from '@faker-js/faker';
import { Connection, Schema } from 'mongoose';
import { Sequelize } from 'sequelize';

import mongoose from '../src/connections/mongoose';
import sequelizeMariaDb from '../src/connections/sequelize-mariadb';
import sequelizeMsSql from '../src/connections/sequelize-mssql';
import sequelizeMySql from '../src/connections/sequelize-mysql';
import sequelizePostgres from '../src/connections/sequelize-postgres';

async function createOwnerRecords(connection: Sequelize): Promise<any[]> {
  const ownerRecords: any[] = [];

  for (let i = 0; i < 10; i += 1) {
    ownerRecords.push({ firstName: faker.name.firstName(), lastName: faker.name.lastName() });
  }

  return connection.model('owner').bulkCreate(ownerRecords);
}

async function createReviewRecords(connection: Sequelize, storeRecords: any[]): Promise<any[]> {
  const reviewRecords: any[] = [];

  for (let i = 0; i < 10; i += 1) {
    reviewRecords.push({
      message: faker.lorem.paragraph(1),
      title: faker.random.words(3),
      storeId: faker.datatype.boolean() ? null : faker.helpers.arrayElement(storeRecords).id,
    });
  }

  return connection.model('review').bulkCreate(reviewRecords);
}

async function createStoreRecords(connection: Sequelize, ownerRecords: any[]): Promise<any[]> {
  return connection.model('store').bulkCreate(
    ownerRecords.reduce((records, ownerRecord) => {
      for (let i = 0; i < faker.datatype.number({ min: 1, max: 2 }); i += 1) {
        records.push({ name: faker.company.name(), ownerId: ownerRecord.id });
      }

      return records;
    }, []),
  );
}

async function createSaleRecords(connection: Connection, accounts: { _id }[]): Promise<void> {
  const records: any[] = [];
  const thingSchema = new Schema({}, { strict: false });
  const Sale = connection.model('sale', thingSchema);

  for (let i = 0; i < 100; i += 1) {
    records.push({
      saleDate: faker.datatype.datetime(),
      saleItems: faker.helpers.uniqueArray(
        () => ({
          name: faker.commerce.productName(),
          tags: faker.helpers.arrayElements(
            ['stationary', 'office', 'general', 'school', 'travel', 'kids', 'general'],
            faker.datatype.number(3),
          ),
          price: faker.datatype.number({ min: 10, max: 100, precision: 0.01 }),
          quantity: faker.datatype.number({ min: 10, max: 100, precision: 1 }),
        }),
        faker.datatype.number(15),
      ),
      storeLocation: faker.address.city(),
      customer: {
        gender: faker.helpers.arrayElement(['M', 'F', 'N']),
        age: faker.datatype.number(100),
        email: faker.internet.email(),
        satisfaction: faker.datatype.number({ min: 0, max: 5, precision: 0.5 }),
        // eslint-disable-next-line no-underscore-dangle
        accountNumber: faker.helpers.arrayElement(accounts.map(account => account._id)),
      },
      couponUsed: faker.helpers.arrayElement([true, false]),
      purchaseMethod: faker.helpers.arrayElement(['Online', 'In-store', 'In-mail', 'Door-to-door']),
    });
  }

  await Sale.create(records);
}

async function createAccountRecords(connection: Connection, storeRecords: any[]) {
  const records: any[] = [];

  for (let i = 0; i < 30; i += 1) {
    records.push({
      firstname: faker.name.firstName(),
      lastname: faker.name.lastName(),
      storeId: faker.helpers.arrayElement(storeRecords).id,
      address: {
        streetNumber: faker.datatype.number(100),
        streetName: faker.address.street(),
        city: faker.address.cityName(),
        country: faker.address.country(),
      },
      bills: faker.helpers.uniqueArray(
        () => ({
          title: faker.finance.transactionDescription(),
          amount: faker.datatype.number({ min: 1, max: 100, precision: 0.01 }),
          issueDate: faker.datatype.datetime(),
          items: faker.helpers.uniqueArray(
            () => ({
              importance: faker.helpers.arrayElement(['high', 'medium', 'low']),
              title: faker.finance.transactionDescription(),
              amount: faker.datatype.number({ min: 1, max: 100, precision: 0.01 }),
            }),
            3,
          ),
        }),
        4,
      ),
    });
  }

  return connection.models.account.create(records);
}

async function createCustomerCardRecords(connection: Sequelize): Promise<any[]> {
  let customerRecords: any[] = [];

  for (let i = 0; i < 5000; i += 1) {
    customerRecords.push({
      name: faker.name.lastName(),
      firstName: faker.name.firstName(),
    });
  }

  customerRecords = await connection.model('customer').bulkCreate(customerRecords);

  const cardRecords: any[] = [];

  for (let i = 0; i < 5; i += 1) {
    cardRecords.push({
      cardNumber: Number(faker.finance.creditCardNumber('################')),
      cardType: faker.helpers.arrayElement(['visa', 'mastercard', 'american express']),
      isActive: faker.datatype.boolean(),
      customerId: customerRecords[i].id,
    });
  }

  await connection.model('card').bulkCreate(cardRecords);

  return customerRecords;
}

async function createDvdRentalsRecords(
  connection: Sequelize,
  storeRecords: any[],
  customerRecords: any[],
): Promise<void> {
  let currentRentalRecordId = 0;
  let currentDvdRecordId = 0;
  const dvdRecords: any[] = [];
  const dvdRentalRecords: any[] = [];
  const rentalRecords: any[] = [];
  storeRecords.forEach(storeRecord => {
    const temporaryRentalRecords: any[] = [];

    for (let i = 0; i < faker.datatype.number({ min: 2, max: 5 }); i += 1) {
      temporaryRentalRecords.push({
        id: currentRentalRecordId,
        startDate: faker.date.recent(40),
        endDate: faker.date.soon(40),
        customerId: faker.helpers.arrayElement(customerRecords).id,
      });
      currentRentalRecordId += 1;
    }

    temporaryRentalRecords.forEach(rentalRecord => {
      for (let id = 0; id < faker.datatype.number({ min: 1, max: 3 }); id += 1) {
        dvdRecords.push({
          id: currentDvdRecordId,
          title: faker.random.words(3),
          rentalPrice: faker.datatype.number({ min: 1, max: 30 }),
          storeId: storeRecord.id,
        });
        dvdRentalRecords.push({ dvdId: currentDvdRecordId, rentalId: rentalRecord.id });

        currentDvdRecordId += 1;
      }
    });

    rentalRecords.push(...temporaryRentalRecords);
  });

  await Promise.all([
    connection.model('dvd').bulkCreate(dvdRecords),
    connection.model('rental').bulkCreate(rentalRecords),
  ]);

  await connection.model('dvd_rental').bulkCreate(dvdRentalRecords);
}

async function clearDatabases(mongooseInstance: Connection, sequelizeInstances: Sequelize[]) {
  for (const db of sequelizeInstances) {
    // eslint-disable-next-line no-await-in-loop
    await db.sync({ force: true });
  }

  await mongooseInstance.dropDatabase();
}

async function closeDatabases(mongooseInstance: Connection, sequelizeInstances: Sequelize[]) {
  for (const db of [...sequelizeInstances, mongooseInstance]) {
    // eslint-disable-next-line no-await-in-loop
    await db.close();
  }
}

async function seedData() {
  const sequelizeInstances = [
    sequelizeMsSql,
    sequelizeMySql,
    sequelizePostgres,
    sequelizeMariaDb,
    sequelizeMsSql,
  ];

  try {
    await clearDatabases(mongoose, sequelizeInstances);

    const ownerRecords = await createOwnerRecords(sequelizePostgres);
    const storeRecords = await createStoreRecords(sequelizeMySql, ownerRecords);
    const customerRecords = await createCustomerCardRecords(sequelizeMariaDb);
    const accounts = await createAccountRecords(mongoose, storeRecords);
    await createSaleRecords(mongoose, accounts);
    await createDvdRentalsRecords(sequelizeMsSql, storeRecords, customerRecords);
    await createReviewRecords(sequelizePostgres, storeRecords);

    // Bug repro: create tables with FK in public, then create schema2 with the same
    // table names and FK column names. This triggers the Sequelize FK introspection bug
    // where FK relations disappear from the public schema.
    await sequelizePostgres.query(`
      DROP TABLE IF EXISTS public.product CASCADE;
      DROP TABLE IF EXISTS public.category CASCADE;
      DROP SCHEMA IF EXISTS schema2 CASCADE;

      CREATE TABLE public.category (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );

      CREATE TABLE public.product (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category_code TEXT NOT NULL REFERENCES public.category(code)
      );

      INSERT INTO public.category (code, name) VALUES ('electronics', 'Electronics'), ('books', 'Books');
      INSERT INTO public.product (name, category_code) VALUES ('Laptop', 'electronics'), ('Novel', 'books');

      -- schema2: same table names AND same FK column names = same auto-constraint names
      CREATE SCHEMA schema2;

      CREATE TABLE schema2.category (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );

      CREATE TABLE schema2.product (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category_code TEXT NOT NULL REFERENCES schema2.category(code)
      );
    `);
    console.log('Created category/product tables + schema2 duplicate (bug repro)');

    await sequelizeMariaDb.query(`
      CREATE OR REPLACE VIEW active_cards AS
      SELECT * FROM card WHERE is_active = 1
    `);
  } catch (error) {
    console.error('---------------');
    console.error('The seed failed');
    console.error(error);
    console.error('---------------');
  } finally {
    await closeDatabases(mongoose, sequelizeInstances);
  }
}

(async () => {
  console.log(`Beginning seed...`);
  await seedData();
  console.log(`Seed completed! 🌱`);
})();
