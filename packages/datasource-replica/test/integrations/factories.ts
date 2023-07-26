import { ConditionTreeLeaf, DataSource, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { ReplicaDataSourceOptions, createReplicaDataSource } from '../../src';

const makeLogger = () => jest.fn();

export const makeSchemaWithId = (collectionName: string) => {
  return [
    { name: collectionName, fields: { id: { type: 'Number', isPrimaryKey: true } } },
  ] as ReplicaDataSourceOptions['schema'];
};

export const makeAllRecordsFilter = () => {
  return new Filter({
    conditionTree: new ConditionTreeLeaf('id', 'Present'),
  });
};

export const getAllRecords = async (datasource: DataSource, collectionName: string) => {
  return datasource
    .getCollection(collectionName)
    .list(factories.caller.build(), makeAllRecordsFilter(), new Projection('id'));
};

export const makeReplicateDataSource = async (options: ReplicaDataSourceOptions) => {
  const replicaFactory = createReplicaDataSource(options);

  return replicaFactory(makeLogger());
};
