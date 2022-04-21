import LiveDataSource from '@forestadmin/datasource-live/dist/datasource';
import faker from '@faker-js/faker';

import prepareDatabaseMysql from '../sequelize/mysql';

// This seed is in this file because the records are loaded in the memory.
export default async function seed(dataSource: LiveDataSource) {
  // there are dependencies in this database.
  const mysql = prepareDatabaseMysql();

  try {
    const storeRecords = await mysql.model('store').findAll({ attributes: ['id'] });
    const addressRecords = storeRecords.map((storeRecord, index) => ({
      id: index,
      zipCode: faker.address.zipCode(),
      address: faker.address.streetAddress(),
      storeId: storeRecord.get('id'),
    }));
    await dataSource.getCollection('address').create(addressRecords);
  } catch {
    // eslint-disable-next-line no-console
    console.log('Please run `yarn db:up & yarn db:seed` to run the db with data');
  } finally {
    await mysql.close();
  }
}
