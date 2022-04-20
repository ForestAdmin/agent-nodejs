/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { Sequelize } from 'sequelize';
import faker from '@faker-js/faker';

import { prepareDatabase as prepareDatabaseMssql } from '../src/datasources/sequelize/mssql';
import { prepareDatabase as prepareDatabaseMysql } from '../src/datasources/sequelize/mysql';
import { prepareDatabase as prepareDatabasePostgres } from '../src/datasources/sequelize/postgres';
import prepareSqlDatasource from './db-seed-direct-sql';

async function createOwnerRecords(db: Sequelize): Promise<any[]> {
  const ownerRecords = [];

  for (let i = 0; i < 5; i += 1) {
    ownerRecords.push({ firstName: faker.name.firstName(), lastName: faker.name.lastName() });
  }

  return db.model('owner').bulkCreate(ownerRecords);
}

async function createStoreRecords(db: Sequelize, ownerRecords: any[]): Promise<any[]> {
  return db.model('store').bulkCreate(
    ownerRecords.reduce((records, ownerRecord) => {
      for (let i = 0; i < faker.datatype.number({ min: 1, max: 2 }); i += 1) {
        records.push({ name: faker.company.companyName(), ownerId: ownerRecord.id });
      }

      return records;
    }, []),
  );
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
  db: Sequelize,
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
    db.model('dvd').bulkCreate(dvdRecords),
    db.model('rental').bulkCreate(rentalRecords),
    db.model('dvd_rental').bulkCreate(dvdRentalRecords),
  ]);
}

async function seedData() {
  let mssql: Sequelize;
  let mysql: Sequelize;
  let postgres: Sequelize;
  let mariadb: Sequelize;

  try {
    [mssql, mysql, postgres, mariadb] = await Promise.all([
      prepareDatabaseMssql(),
      prepareDatabaseMysql(),
      prepareDatabasePostgres(),
      prepareSqlDatasource(),
    ]);

    for (const db of [mssql, mysql, postgres, mariadb]) {
      // eslint-disable-next-line no-await-in-loop
      await db.sync({ force: true });
    }

    const ownerRecords = await createOwnerRecords(postgres);
    const storeRecords = await createStoreRecords(mysql, ownerRecords);
    const customerRecords = await createCustomerCardRecords(mariadb);
    await createDvdRentalsRecords(mssql, storeRecords, customerRecords);
  } catch (error) {
    console.error('---------------');
    console.error('The seed failed');
    console.error(error);
    console.error('---------------');
  } finally {
    for (const db of [mssql, mysql, postgres, mariadb]) {
      // eslint-disable-next-line no-await-in-loop
      await db.close();
    }
  }
}

(async () => {
  console.log(`Beginning seed...`);

  await seedData();
})();
