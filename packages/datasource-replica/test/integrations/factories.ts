import { DataSource, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { ReplicaDataSourceOptions, createReplicaDataSource } from '../../src';

const makeLogger = () => jest.fn();

export const makeSchemaWithId = (collectionName: string): ReplicaDataSourceOptions['schema'] => {
  return [{ name: collectionName, fields: { id: { type: 'Number', isPrimaryKey: true } } }];
};

export const getAllRecords = async (datasource: DataSource, collectionName: string) => {
  return datasource
    .getCollection(collectionName)
    .list(factories.caller.build(), factories.filter.idPresent(), new Projection('id'));
};

export const makeReplicaDataSource = async (
  options: ReplicaDataSourceOptions,
): Promise<DataSource> => {
  const replicaFactory = createReplicaDataSource(options);

  return replicaFactory(makeLogger());
};
