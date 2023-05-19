import { Client } from '@elastic/elasticsearch';
import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';

import ElasticsearchCollection from './collection';
import ModelElasticsearch from './model-builder/model';

export default class ElasticsearchDataSource extends BaseDataSource<ElasticsearchCollection> {
  /**
   * We can't directly use the Elasticsearch version we install in the package.json
   * as the customer's version may be different.
   * To ensure compatibility, we need to only import types from Elasticsearch,
   *    and use the customer elasticsearch version to deal with the data manipulation.
   */
  protected elasticsearchClient: Client = null;

  constructor(
    elasticsearchClient: Client,
    collectionModels: ModelElasticsearch[],
    logger?: Logger,
  ) {
    super();

    if (!elasticsearchClient) throw new Error('Invalid (null) Elasticsearch instance.');
    this.elasticsearchClient = elasticsearchClient;

    // Creating collections
    this.createCollections(collectionModels, logger);

    logger?.('Info', 'ElasticsearchDataSource - Built');
  }

  protected async createCollections(collectionModels: ModelElasticsearch[], logger?: Logger) {
    collectionModels
      // avoid schema reordering
      .sort((modelA, modelB) => (modelA.name > modelB.name ? 1 : -1))
      .forEach(model => {
        const collection = new ElasticsearchCollection(this, model, logger);
        this.addCollection(collection);
      });
  }
}
