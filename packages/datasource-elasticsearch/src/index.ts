import { Client, ClientOptions } from '@elastic/elasticsearch';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import ElasticsearchDataSource from './datasource';
import { ConfigurationOptions, ElasticsearchDatasourceBuilder } from './introspection/builder';
import Introspector from './introspection/introspector';

export { default as ElasticsearchCollection } from './collection';
export { default as ElasticsearchDataSource } from './datasource';
export { default as TypeConverter } from './utils/type-converter';

/**
 * Allow to interact with elasticsearch datasource
 * @param connection the connection to the elasticsearch instance
 * @param handle a function that provide a
 *   datasource configurations on the given datasource
 * @example
 * .createElasticsearchDataSourceWithExistingClient(existingClient, configurator =>
 *   configurator.addCollectionFromIndex(
 *    { name: 'Flights',indexPatterns: 'kibana_sample_data_flights' },
 *   ),
 * )
 */
export function createElasticsearchDataSourceWithExistingClient(client: Client): DataSourceFactory {
  return async (logger: Logger, options?: ConfigurationOptions) => {
    const collectionModels = options
      ? await (
          options(new ElasticsearchDatasourceBuilder(client)) as ElasticsearchDatasourceBuilder
        ).createCollectionsFromConfiguration()
      : await Introspector.introspect(client, logger);

    return new ElasticsearchDataSource(client, collectionModels, logger);
  };
}

/**
 * Allow to interact with elasticsearch datasource
 * @param connection the connection to the elasticsearch instance
 * @param handle a function that provide a
 *   datasource configurations on the given datasource
 * @example
 * .createElasticsearchDataSource('http://localhost:9200', configurator =>
 *   configurator.addCollectionFromIndex(
 *    { name: 'Flights',indexPatterns: 'kibana_sample_data_flights' },
 *   ),
 * )
 */
export function createElasticsearchDataSource(
  connection: ClientOptions['node'],
  options?: ConfigurationOptions,
): DataSourceFactory {
  return async (logger: Logger) => {
    const client = new Client({ node: connection });

    const collectionModels = options
      ? await (
          options(new ElasticsearchDatasourceBuilder(client)) as ElasticsearchDatasourceBuilder
        ).createCollectionsFromConfiguration()
      : await Introspector.introspect(client, logger);

    return new ElasticsearchDataSource(client, collectionModels, logger);
  };
}
