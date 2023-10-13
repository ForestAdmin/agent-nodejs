import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-replica';
import { GraphQLClient } from 'graphql-request';

import GQLCollectionSchema from '../collections';

function formatCollectionRecords(collection: GQLCollectionSchema, records: unknown[]) {
  return records
    .map(record => {
      const newRecord = collection.queryFields.reduce((r, queryField) => {
        r[queryField] = record[queryField];

        return r;
      }, {});

      const relationRecords = Object.entries(collection.queryRelations)
        .map(([relationName, relationCollection]) => {
          const relationIdentifier = collection.getRelationIdentifier(relationName);
          const relationField = collection.relationFields[relationIdentifier];

          const relationRecord = record[relationName];

          newRecord[relationIdentifier] = relationRecord[relationField.reference.targetField];

          return formatCollectionRecords(relationCollection, [relationRecord]);
        })
        .flat();

      return relationRecords.concat([{ collection: collection.name, record: newRecord }]);
    })
    .flat();
}

export default async function pullDelta(
  client: GraphQLClient,
  schema: GQLCollectionSchema[],
  request: PullDeltaRequest,
): Promise<PullDeltaResponse> {
  const affectedGQLCollections = request.affectedCollections.map(collectionName =>
    schema.find(({ name }) => name === collectionName),
  );

  // TODO: get with filter on date
  // TODO: paginate delta

  const res = await client.request(
    `query getRessource { ${affectedGQLCollections.map(({ query }) => query)} }`,
  );

  const newOrUpdatedEntries = affectedGQLCollections
    .map(collection => formatCollectionRecords(collection, res[collection.queryName]))
    .flat();

  return { deletedEntries: [], more: false, newOrUpdatedEntries, nextDeltaState: {} };
}
