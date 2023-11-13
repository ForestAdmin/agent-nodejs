import { Client } from '@elastic/elasticsearch';

import ModelElasticsearch from '../model-builder/model';

export type ElasticsearchCollectionFromIndexOptions = {
  /**
   * Give the name of the collection
   */
  name: string;

  /**
   * An index template is a way to tell Elasticsearch how to configure an index when it is
   * created. For data streams, the index template configures the stream’s backing indices
   * as they are created. Templates are configured prior to index creation. When an index
   * is created - either manually or through indexing a document - the template settings
   * are used as a basis for creating the index.
   */
  indexName: string;
};

export type ElasticsearchCollectionFromTemplateOptions = {
  /**
   * Give the name of the collection
   */
  name: string;

  /**
   * Give the name of the collection
   */
  templateName: string;

  /**
   * Allow to properly generate index name for records creation
   */
  generateIndexName: string | ((record?: unknown) => string);
};

export type ConfigurationOptions = (
  configurator: ElasticsearchDatasourceOptionsBuilder,
) => ElasticsearchDatasourceOptionsBuilder;

export interface ElasticsearchDatasourceOptionsBuilder {
  /**
   * Add a collection from an index
   */
  addCollectionFromIndex({ name, indexName }: ElasticsearchCollectionFromIndexOptions): this;

  /**
   * Add a collection from a template
   */
  addCollectionFromTemplate({
    name,
    templateName,
    generateIndexName,
  }: ElasticsearchCollectionFromTemplateOptions): this;
}

export class ElasticsearchDatasourceBuilder implements ElasticsearchDatasourceOptionsBuilder {
  private readonly elasticsearchClient: Client;

  protected collectionsPromises: Array<Promise<ModelElasticsearch>> = [];

  constructor(elasticsearchClient: Client) {
    this.elasticsearchClient = elasticsearchClient;
  }

  public addCollectionFromIndex({
    name,
    indexName,
  }: ElasticsearchCollectionFromIndexOptions): this {
    this.collectionsPromises.push(
      (async () => {
        const template = await this.elasticsearchClient.indices.getMapping({
          index: indexName,
        });

        return new ModelElasticsearch(
          this.elasticsearchClient,
          name,
          [indexName],
          template.body[indexName].aliases, // aliases
          template.body[indexName].mappings,
          () => indexName,
        );
      })(),
    );

    return this;
  }

  public addCollectionFromTemplate({
    name,
    templateName,
    generateIndexName,
  }: ElasticsearchCollectionFromTemplateOptions): this {
    this.collectionsPromises.push(
      (async () => {
        const template = await this.elasticsearchClient.indices.getTemplate({
          name: templateName,
        });

        const templateInformation = template.body[templateName];

        const indexPatterns = templateInformation.index_patterns;
        const aliases = Object.keys(templateInformation.aliases);
        const { mappings } = templateInformation;

        return new ModelElasticsearch(
          this.elasticsearchClient,
          name,
          indexPatterns,
          aliases,
          mappings,
          typeof generateIndexName === 'string' ? () => generateIndexName : generateIndexName,
        );
      })(),
    );

    return this;
  }

  public async createCollectionsFromConfiguration() {
    return Promise.all(this.collectionsPromises);
  }
}
