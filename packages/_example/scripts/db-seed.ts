/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Connection } from 'mongoose';
import { Sequelize } from 'sequelize';
import faker from '@faker-js/faker';

import initMsSql from './mssql-init';
import prepareDatabaseMongodb from '../src/datasources/mongoose/mongodb';
import sequelizeMariaDb from './mariadb-sequelize';
import sequelizeMsSql from '../src/datasources/sequelize/mssql';
import sequelizeMySql from '../src/datasources/sequelize/mysql';
import sequelizePostgres from '../src/datasources/sequelize/postgres';

async function createOwnerRecords(connection: Sequelize): Promise<any[]> {
  const ownerRecords = [];

  for (let i = 0; i < 10; i += 1) {
    ownerRecords.push({ firstName: faker.name.firstName(), lastName: faker.name.lastName() });
  }

  return connection.model('owner').bulkCreate(ownerRecords);
}

async function createStoreRecords(connection: Sequelize, ownerRecords: any[]): Promise<any[]> {
  return connection.model('store').bulkCreate(
    ownerRecords.reduce((records, ownerRecord) => {
      for (let i = 0; i < faker.datatype.number({ min: 1, max: 2 }); i += 1) {
        records.push({ name: faker.company.companyName(), ownerId: ownerRecord.id });
      }

      return records;
    }, []),
  );
}

async function createReviewRecords(connection: Connection, storeRecords: any[]): Promise<void> {
  const reviewsRecords = [];

  for (let i = 0; i < 30; i += 1) {
    reviewsRecords.push({
      title: faker.word.adjective(),
      message: faker.lorem.paragraphs(1),
      storeId: faker.helpers.randomize(storeRecords.map(({ id }) => id)),
    });
  }

  await connection.models.review.create(reviewsRecords);
}

async function createCustomerCardRecords(connection: Sequelize): Promise<any[]> {
  let customerRecords = [];

  for (let i = 0; i < 5; i += 1) {
    customerRecords.push({
      name: faker.name.lastName(),
      firstName: faker.name.firstName(),
    });
  }

  customerRecords = await connection.model('customer').bulkCreate(customerRecords);

  const cardRecords = [];

  for (let i = 0; i < 5; i += 1) {
    cardRecords.push({
      cardNumber: Number(faker.finance.creditCardNumber('################')),
      cardType: faker.helpers.randomize(['visa', 'mastercard', 'american express']),
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
  const dvdRecords = [];
  const dvdRentalRecords = [];
  const rentalRecords = [];
  storeRecords.forEach(storeRecord => {
    const temporaryRentalRecords = [];

    for (let i = 0; i < faker.datatype.number({ min: 2, max: 5 }); i += 1) {
      temporaryRentalRecords.push({
        id: currentRentalRecordId,
        startDate: faker.date.recent(40),
        endDate: faker.date.soon(40),
        customerId: faker.helpers.randomize(customerRecords.map(({ id }) => id)),
      });
      currentRentalRecordId += 1;
    }

    temporaryRentalRecords.forEach(rentalRecord => {
      for (let id = 0; id < faker.datatype.number({ min: 1, max: 3 }); id += 1) {
        dvdRecords.push({
          id: currentDvdRecordId,
          title: faker.name.title(),
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
    connection.model('dvd_rental').bulkCreate(dvdRentalRecords),
  ]);
}

async function clearDatabases() {
  const sequelizeInstances = [sequelizeMsSql, sequelizeMySql, sequelizePostgres, sequelizeMariaDb];

  for (const db of sequelizeInstances) {
    // eslint-disable-next-line no-await-in-loop
    await db.sync({ force: true });
  }

  const mongooseInstance = await prepareDatabaseMongodb();
  await mongooseInstance.dropDatabase();
}

async function closeDatabases() {
  const sequelizeInstances = [sequelizeMsSql, sequelizeMySql, sequelizePostgres, sequelizeMariaDb];
  const mongooseInstance = await prepareDatabaseMongodb();

  for (const db of [...sequelizeInstances, mongooseInstance]) {
    // eslint-disable-next-line no-await-in-loop
    await db.close();
  }
}

async function seedData() {
  try {
    await initMsSql();
    await clearDatabases();
    const mongooseInstance = await prepareDatabaseMongodb();

    const ownerRecords = await createOwnerRecords(sequelizePostgres);
    const storeRecords = await createStoreRecords(sequelizeMySql, ownerRecords);
    const customerRecords = await createCustomerCardRecords(sequelizeMariaDb);
    await createReviewRecords(mongooseInstance, storeRecords);
    await createDvdRentalsRecords(sequelizeMsSql, storeRecords, customerRecords);
  } catch (error) {
    console.error('---------------');
    console.error('The seed failed');
    console.error(error);
    console.error('---------------');
  } finally {
    await closeDatabases();
  }
}

(async () => {
  console.log(`Beginning seed...`);

  await seedData();
})();
