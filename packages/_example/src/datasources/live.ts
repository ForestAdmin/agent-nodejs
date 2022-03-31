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

async function loadLiveDataSource(dataSource: DataSource) {
  const mysql = await prepareDatabaseMysql();
  const storeRecords = await mysql.model('store').findAll({ attributes: ['id'] });
  const addressRecords = storeRecords.map((storeRecord, index) => ({
    id: index,
    zipCode: faker.address.zipCode(),
    address: faker.address.streetAddress(),
    storeId: storeRecord.get('id'),
  }));
  await dataSource.getCollection('address').create(addressRecords);
}

export default async (): Promise<LiveDataSource> => {
  const dataSource = await new LiveDataSource(dataSourceSchema);
  await dataSource.syncCollections();
  await loadLiveDataSource(dataSource);

  return dataSource;
};
