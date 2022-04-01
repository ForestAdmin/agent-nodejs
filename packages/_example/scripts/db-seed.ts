/* eslint-disable no-console */
import faker from '@faker-js/faker';

import { prepareDatabase as prepareDatabaseMssql } from '../src/datasources/sequelize/mssql';
import { prepareDatabase as prepareDatabaseMysql } from '../src/datasources/sequelize/mysql';
import { prepareDatabase as prepareDatabasePostgres } from '../src/datasources/sequelize/postgres';

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

  const ownerRecords = [];

  try {
    for (let i = 0; i < 10; i += 1) {
      ownerRecords.push({
        id: i,
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      });
    }

    await postgres.model('owner').bulkCreate(ownerRecords);

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
    await mysql.model('store').bulkCreate(storeRecords);

    let currentRentalRecordId = 0;
    let currentDvdRecordId = 0;
    const dvdRecords = [];
    const dvdRentalRecords = [];
    const rentalRecords = [];
    storeRecords.forEach(storeRecord => {
      for (let id = 0; id < faker.datatype.number({ min: 10, max: 50 }); id += 1) {
        rentalRecords.push({
          id: currentRentalRecordId,
          startDate: faker.date.recent(40),
          endDate: faker.date.soon(40),
        });
        currentRentalRecordId += 1;
      }

      rentalRecords.forEach(rentalRecord => {
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

      return dvdRecords;
    });

    await Promise.all([
      mssql.model('dvd').bulkCreate(dvdRecords),
      mssql.model('rental').bulkCreate(rentalRecords),
      mssql.model('dvd_rental').bulkCreate(dvdRentalRecords),
    ]);
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
