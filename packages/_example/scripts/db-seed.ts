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

    currentId = 0;
    const dvdRecords = storeRecords.reduce((records, storeRecord) => {
      for (let i = 0; i < faker.datatype.number({ min: 1, max: 30 }); i += 1) {
        records.push({
          id: currentId,
          title: faker.name.title(),
          rentalPrice: faker.datatype.number({ min: 1, max: 30 }),
          storeId: storeRecord.id,
        });

        currentId += 1;
      }

      return records;
    }, []);

    await mssql.model('dvd').bulkCreate(dvdRecords);

    currentId = 0;
    const dvdRentalRecords = [];
    const rental = dvdRecords.reduce((records, dvdRecord) => {
      for (let i = 0; i < faker.datatype.number({ min: 0, max: 30 }); i += 1) {
        records.push({
          id: currentId,
          startDate: faker.date.past(),
          endDate: faker.date.future(),
        });
        dvdRentalRecords.push({ dvdId: dvdRecord.id, rentalId: currentId });
        currentId += 1;
      }

      return records;
    }, []);
    await mssql.model('rental').bulkCreate(rental);
    await mssql.model('dvd_rental').bulkCreate(dvdRentalRecords);
  } catch (e) {
    console.error(e);
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
