import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { GraphQLSchema } from 'graphql';
import { GraphQLClient } from 'graphql-request';

import GraphQLCollection from './collection';
import SchemaIntrospector from './graphql/schema-intropector';
import { GraphQLOptions } from './types';

export default class GraphQLDatasource extends BaseDataSource<GraphQLCollection> {
  constructor(
    logger: Logger,
    options: GraphQLOptions,
    client: GraphQLClient,
    schema: GraphQLSchema,
  ) {
    super();

    const schemaIntrospector = new SchemaIntrospector(logger, options, schema);
    const models = schemaIntrospector.getModels();

    models.forEach(model => this.addCollection(new GraphQLCollection(this, client, model)));
  }
}
