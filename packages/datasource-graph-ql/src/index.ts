import { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import { IntrospectionQuery, buildClientSchema, getIntrospectionQuery } from 'graphql';
import { GraphQLClient } from 'graphql-request';

import GraphQLDatasource from './datasource';
import { GraphQLOptions } from './types';

export { default as GraphQLCollection } from './collection';
export { default as GraphQLDatasource } from './datasource';

export function createGraphQLDataSource(options: GraphQLOptions): DataSourceFactory {
  return async logger => {
    const client = new GraphQLClient(options.serverApiUrl, {});

    const introspectionSchemaResponse: IntrospectionQuery = await client.request(
      getIntrospectionQuery(),
    );

    const schema = buildClientSchema(introspectionSchemaResponse);

    return new GraphQLDatasource(logger, options, client, schema);
  };
}
