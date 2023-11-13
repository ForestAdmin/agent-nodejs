import { Client } from '@elastic/elasticsearch';
import { MappingTypeMapping } from '@elastic/elasticsearch/api/types';
import { RecordData } from '@forestadmin/datasource-toolkit';

import Serializer from '../utils/serializer';

export default class ModelElasticsearch {
  public name: string;

  /**
   * An index template is a way to tell Elasticsearch how to configure an index when it is
   * created. For data streams, the index template configures the stream’s backing indices
   * as they are created. Templates are configured prior to index creation. When an index
   * is created - either manually or through indexing a document - the template settings
   * are used as a basis for creating the index.
   */
  private indexPatterns: string[];

  /**
   * An alias is a secondary name for a group of data streams or indices.
   * Most Elasticsearch APIs accept an alias in place of a data stream or index name.
   */
  private aliases: string[];

  /**
   * Mapping is the process of defining how a document, and the fields it contains, are
   * stored and indexed.
   *
   * https://www.elastic.co/guide/en/elasticsearch/reference/master/mapping-types.html
   */
  private mapping: MappingTypeMapping;

  private generateIndexName: (record?: unknown) => string;

  private elasticsearchClient: Client;

  constructor(
    elasticsearchClient: Client,
    name: string,
    indexPatterns: string[],
    aliases: string[],
    mapping: MappingTypeMapping,
    generateIndexName?: (record?: unknown) => string,
  ) {
    this.name = name;
    this.indexPatterns = indexPatterns;
    this.aliases = aliases;
    this.mapping = mapping;
    this.generateIndexName = generateIndexName;

    this.elasticsearchClient = elasticsearchClient;
  }

  public async bulkCreate(data: RecordData[]): Promise<RecordData[]> {
    if (!this.generateIndexName)
      throw new Error('You need to define generateIndexName in order to create a record');

    // How to handle this the proper way ?
    if (this.mapping.properties.createdAt) {
      data.forEach(newRecord => {
        newRecord.createdAt = new Date();
      });
    }

    const recordsCreationPromises = data.map(newRecord =>
      this.elasticsearchClient.index<{
        _index: string;
        _id: string;
      }>({
        op_type: 'create',
        index: this.generateIndexName(newRecord),
        body: newRecord,
      }),
    );
    const recordsResponse = await Promise.all(recordsCreationPromises);

    // It makes all operations performed on an index since the last refresh available for search
    await this.elasticsearchClient.indices.refresh({ index: this.indexPatterns[0] });

    return recordsResponse.map((response, index) =>
      Serializer.serialize({
        // eslint-disable-next-line no-underscore-dangle
        _id: response.body._id,
        ...data[index],
      }),
    );
  }

  public async search(
    searchBody: Record<string, unknown>,
    offset: number,
    limit: number,
  ): Promise<RecordData[]> {
    const response = await this.elasticsearchClient.search<{
      hits: {
        hits: RecordData[];
      };
    }>({
      index: this.indexPatterns[0],
      body: searchBody,
      from: offset,
      size: limit,
    });

    return response.body.hits.hits.map(hit => {
      return Serializer.serialize({
        // eslint-disable-next-line no-underscore-dangle
        _id: hit._id,
        // eslint-disable-next-line no-underscore-dangle
        ...hit._source,
      });
    });
  }

  public async aggregateSearch(
    searchBody: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await this.elasticsearchClient.search<{
      aggregations: Record<string, unknown>;
    }>({
      size: 0,
      index: this.indexPatterns[0],
      body: searchBody,
    });

    return response.body.aggregations;
  }

  public async update(ids: string[], patch: RecordData): Promise<void> {
    // await this.elasticsearchClient.update<{
    //   aggregations: Record<string, unknown>;
    // }>({
    //   id,
    //   index: this.indexPatterns[0],
    //   body: {
    //     doc: {
    //       ...patch,
    //     },
    //   },
    // });

    // www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html#bulk-update

    const body = ids.reduce((acc, id) => {
      acc.push({
        update: {
          _index: this.indexPatterns[0],
          _id: id,
        },
      });
      acc.push({
        doc: { ...patch },
      });

      return acc;
    }, []);

    await this.elasticsearchClient.bulk({
      body,
      refresh: true,
    });
  }

  public async delete(ids: string[]): Promise<void> {
    // https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-bulk.html#docs-bulk

    const body = ids.map(id => {
      return {
        delete: {
          _index: this.indexPatterns[0],
          _id: id,
        },
      };
    });

    await this.elasticsearchClient.bulk({
      body,
      refresh: true,
    });
  }

  // INTERNAL USAGES

  /**
   * Return all fields
   */
  public getAttributes() {
    return this.mapping.properties;
  }
}
