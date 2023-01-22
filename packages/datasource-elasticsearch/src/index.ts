import { Client, ClientOptions } from '@elastic/elasticsearch';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import ElasticsearchDataSource from './datasource';
import Introspector from './introspection/introspector';

export { default as ElasticsearchCollection } from './collection';
export { default as ElasticsearchDataSource } from './datasource';
export { default as TypeConverter } from './utils/type-converter';

export function createElasticsearchDataSourceWithExistingClient(client: Client): DataSourceFactory {
  return async (logger: Logger) => {
    const collectionModels = await Introspector.introspect(client, logger);

    return new ElasticsearchDataSource(client, collectionModels, logger);
  };
}

export function createElasticsearchDataSource(
  connection: ClientOptions['node'],
): DataSourceFactory {
  return async (logger: Logger) => {
    const client = new Client({ node: connection });

    const collectionModels = await Introspector.introspect(client, logger);

    return new ElasticsearchDataSource(client, collectionModels, logger);
  };
}

/**
 * Rethink the whole introspection
 *
 * - Maybe add option to only look for indices
 * - Add option to create the right index naming in case of collection from index template
 *
 */
