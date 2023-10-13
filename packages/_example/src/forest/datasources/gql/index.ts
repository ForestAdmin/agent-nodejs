import { ReplicaDataSourceOptions, createReplicaDataSource } from '@forestadmin/datasource-replica';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { IntrospectionQuery, buildClientSchema, getIntrospectionQuery } from 'graphql';
import { GraphQLClient } from 'graphql-request';

import createRecord from './handlers/create';
import pullDelta from './handlers/pullDelta';
import getSchema from './schema';

type GQLOptions = {
  /**
   * URL of the cache database (default to in-memory sqlite)
   */
  cacheInto?: ReplicaDataSourceOptions['cacheInto'];
  gqlServerApiUrl: string;
};

export default function createGQLDataSource(options: GQLOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const client = new GraphQLClient(options.gqlServerApiUrl, {});

    const introspectionSchemaResponse: IntrospectionQuery = await client.request(
      getIntrospectionQuery(),
    );

    const gqlSchema = buildClientSchema(introspectionSchemaResponse);

    const mut = gqlSchema.getMutationType();
    console.log(mut.getFields().createUser.args[0]);

    const schema = await getSchema(gqlSchema);

    const factory = createReplicaDataSource({
      cacheNamespace: 'GQL',
      schema,
      pullDeltaHandler: request => pullDelta(client, schema, request),
      pullDeltaOnBeforeAccess: true,
      pullDeltaOnBeforeAccessDelay: 50,
      cacheInto: options.cacheInto,
      createRecordHandler: (collectionName, record) =>
        createRecord(client, schema, collectionName, record),
    });

    return factory(logger);
  };
}
