import LiveDataSource from '@forestadmin/datasource-live/dist/datasource';
import faker from '@faker-js/faker';

import sequelizeMySql from '../../connections/sequelize-mysql';

// This seed is in this file because the records are loaded in the memory.
export async function seedLiveDatasource(dataSource: LiveDataSource) {
  try {
    const storeRecords = await sequelizeMySql.model('store').findAll({ attributes: ['id'] });
    const addressRecords = storeRecords.map((storeRecord, index) => ({
      id: index,
      zipCode: faker.address.zipCode(),
      address: faker.address.streetAddress(),
      storeId: storeRecord.get('id'),
    }));
    await dataSource.getCollection('address').create(null, addressRecords);
  } catch {
    // eslint-disable-next-line no-console
    console.log('Please run `yarn db:up & yarn db:seed` to run the db with data');
  }
}

export const liveDatasourceSchema = {
  address: {
    id: { columnType: 'Number', isPrimaryKey: true, type: 'Column' },
    zipCode: { columnType: 'String', type: 'Column' },
    address: { columnType: 'String', type: 'Column' },
    storeId: { columnType: 'Number', type: 'Column' },
  },
} as const;
