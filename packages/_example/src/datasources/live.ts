import { LiveDataSource } from '@forestadmin/datasource-live';
import faker from '@faker-js/faker';

import createMySqlSequelize from './sequelize/mysql';

export const liveSchema = {
  collections: {
    address: {
      actions: {},
      fields: {
        id: { columnType: 'Number', isPrimaryKey: true, type: 'Column' },
        zipCode: { columnType: 'String', type: 'Column' },
        address: { columnType: 'String', type: 'Column' },
        storeId: { columnType: 'Number', type: 'Column' },
      },
      searchable: false,
      segments: [] as string[],
    },
  },
} as const;

// This seed is in this file because the records are loaded in the memory.
export async function seedLiveDataSource(dataSource: LiveDataSource) {
  // there are dependencies in this database.
  const mysql = await createMySqlSequelize();

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
