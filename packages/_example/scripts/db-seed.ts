/* eslint-disable no-console */
import { Dialect, Sequelize } from 'sequelize';
import faker from '@faker-js/faker';

import { prepareDatabase } from '../src/datasources/sequelize/generic';
import databases from '../config/databases';

async function seedData(dialect: Dialect, connectionString: string) {
  const sequelize = await prepareDatabase(dialect as Dialect, connectionString);

  try {
    await sequelize.sync({ force: true });

    let cityRecords = [];
    let countryRecords = [];
    const addressRecords = [];
    const ENTRIES = 100;

    for (let i = 0; i < ENTRIES; i += 1) {
      countryRecords.push({
        country: faker.address.country(),
        lastUpdate: faker.datatype.datetime(),
      });
    }

    countryRecords = await sequelize.model(`${dialect}Country`).bulkCreate(countryRecords);

    for (let i = 0; i < ENTRIES; i += 1) {
      cityRecords.push({
        city: faker.address.city(),
        lastUpdate: faker.datatype.datetime(),
        countryId: countryRecords[Math.floor(Math.random() * countryRecords.length)].countryId,
      });
    }

    cityRecords = await sequelize.model(`${dialect}City`).bulkCreate(cityRecords);

    for (let i = 0; i < ENTRIES; i += 1) {
      addressRecords.push({
        address: faker.address.streetAddress(),
        address2: faker.address.secondaryAddress(),
        postalCode: faker.address.zipCode(),
        cityId: cityRecords[Math.floor(Math.random() * cityRecords.length)].cityId,
      });
    }

    await sequelize.model(`${dialect}Address`).bulkCreate(addressRecords);
  } finally {
    await sequelize.close();
  }
}

(async () => {
  await Promise.all(
    databases.map(async ({ dialect, connectionString, dbName, createDatabase }) => {
      console.log(`Begining seed of ${dialect}`);

      if (createDatabase) {
        let connection: Sequelize;

        try {
          connection = new Sequelize(`${dialect}://${connectionString}`, { logging: false });
          await connection.getQueryInterface().createDatabase(dbName);
        } finally {
          await connection.close();
        }
      }

      await seedData(dialect as Dialect, `${dialect}://${connectionString}/${dbName}`);
      console.log(`Seed of ${dialect} finished`);
    }),
  );
})();
