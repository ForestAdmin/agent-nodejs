/* eslint-disable no-console */
import faker from '@faker-js/faker';

import { prepareDatabase as prepareDatabaseMssql } from '../src/datasources/sequelize/mssql';
import { prepareDatabase as prepareDatabaseMysql } from '../src/datasources/sequelize/mysql';
import { prepareDatabase as prepareDatabasePostgres } from '../src/datasources/sequelize/postgres';

async function createOwners(db) {
  const ownerRecords = [];

  for (let id = 0; id < 5; id += 1) {
    ownerRecords.push({ id, firstName: faker.name.firstName(), lastName: faker.name.lastName() });
  }

  await db.model('owner').bulkCreate(ownerRecords);

  return ownerRecords;
}

async function createStoreRecords(db, ownerRecords) {
  let currentId = 1;

  const storeRecords = ownerRecords.reduce((records, ownerRecord) => {
    for (let i = 0; i < faker.datatype.number({ min: 1, max: 2 }); i += 1) {
      records.push({
        id: currentId,
        name: faker.company.companyName(),
        ownerId: ownerRecord.id,
      });
      currentId += 1;
    }

    return records;
  }, []);
  await db.model('store').bulkCreate(storeRecords);

  return storeRecords;
}

async function createDvdRentalsRecords(db, storeRecords) {
  let currentRentalRecordId = 0;
  let currentDvdRecordId = 0;
  const dvdRecords = [];
  const dvdRentalRecords = [];
  const rentalRecords = [];
  storeRecords.forEach(storeRecord => {
    const temporaryRentalRecords = [];

    for (let id = 0; id < faker.datatype.number({ min: 2, max: 5 }); id += 1) {
      temporaryRentalRecords.push({
        id: currentRentalRecordId,
        startDate: faker.date.recent(40),
        endDate: faker.date.soon(40),
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
  const [mssql, mysql, postgres] = await Promise.all([
    prepareDatabaseMssql(),
    prepareDatabaseMysql(),
    prepareDatabasePostgres(),
  ]);

  for (const db of [mssql, mysql, postgres]) {
    // eslint-disable-next-line no-await-in-loop
    await db.sync({ force: true });
  }

  try {
    const ownerRecords = await createOwners(postgres);
    const storeRecords = await createStoreRecords(mysql, ownerRecords);
    await createDvdRentalsRecords(mssql, storeRecords);
  } catch {
    console.error('The seed failed');
  } finally {
    for (const db of [mssql, mysql, postgres]) {
      // eslint-disable-next-line no-await-in-loop
      await db.close();
    }
  }
}

(async () => {
  console.log(`Beginning seed...`);

  await seedData();
})();
