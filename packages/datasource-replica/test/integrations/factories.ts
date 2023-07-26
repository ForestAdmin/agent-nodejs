import { ConditionTreeLeaf, DataSource, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { ReplicaDataSourceOptions, createReplicaDataSource } from '../../src';

const makeLogger = () => jest.fn();

export const makeSchemaWithId = (collectionName: string) => {
  return [
    { name: collectionName, fields: { id: { type: 'Number', isPrimaryKey: true } } },
  ] as ReplicaDataSourceOptions['schema'];
};

// eslint-disable-next-line import/prefer-default-export
export const getAllRecords = async (datasource: DataSource, collectionName: string) => {
  const allRecordsFilter = new Filter({
    conditionTree: new ConditionTreeLeaf('id', 'Present'),
  });

  return datasource
    .getCollection(collectionName)
    .list(factories.caller.build(), allRecordsFilter, new Projection('id'));
};

export const makeReplicateDataSource = async (options: ReplicaDataSourceOptions) => {
  const replicaFactory = createReplicaDataSource(options);

  return replicaFactory(makeLogger());
};
