import {
  CollectionSchema,
  DataSource,
  DataSourceSchema,
  FieldTypes,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { LiveDataSource } from '@forestadmin/datasource-live';
import faker from '@faker-js/faker';

import { prepareDatabase as prepareDatabaseMysql } from './sequelize/mysql';

const address: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    zipCode: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
    address: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
    storeId: {
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
  },
  searchable: false,
  segments: [],
};

const dataSourceSchema: DataSourceSchema = { collections: { address } };

// This seed is in this file because the records are loaded in the memory.
async function runSeed(dataSource: DataSource) {
  // there are dependencies in this database.
  const mysql = await prepareDatabaseMysql();

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

export default async (): Promise<LiveDataSource> => {
  const dataSource = await new LiveDataSource(dataSourceSchema);
  await dataSource.syncCollections();
  await runSeed(dataSource);

  return dataSource;
};
