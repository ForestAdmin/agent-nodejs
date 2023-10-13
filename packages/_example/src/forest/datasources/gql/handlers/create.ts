import { RecordData } from '@forestadmin/datasource-toolkit';
import { GraphQLClient } from 'graphql-request';

import GQLCollectionSchema from '../collections';

export default async function createRecord(
  client: GraphQLClient,
  schema: GQLCollectionSchema[],
  collectionName: string,
  record: RecordData,
): Promise<RecordData> {
  console.log(`mutation createRessource { create${collectionName}(${JSON.stringify(record)}) }`);
  // client.request(`mutation createRessource { create${collectionName}(${record}) }`);

  return {};
}
