import { Client } from '@elastic/elasticsearch';

import ELASTICSEARCH_URL from './helpers/connection-details';
import { ElasticsearchCollection, ElasticsearchDataSource } from '../src';
import ModelElasticsearch from '../src/model-builder/model';

describe('ElasticsearchDataSource', () => {
  it('should fail to instantiate without a Elasticsearch instance', () => {
    expect(
      () => new ElasticsearchDataSource(undefined as unknown as Client, [], jest.fn()),
    ).toThrow('Invalid (null) Elasticsearch instance.');
  });

  it('should have no predefined collection', () => {
    expect(
      new ElasticsearchDataSource({ models: {} } as unknown as Client, [], jest.fn()).collections,
    ).toStrictEqual([]);
  });

  it('should create collection based on models', () => {
    const elasticsearchClient = new Client({ node: ELASTICSEARCH_URL });

    const datasource = new ElasticsearchDataSource(
      elasticsearchClient,
      [
        new ModelElasticsearch(elasticsearchClient, 'cars', ['indexPatterns'], ['aliases'], {
          properties: {},
        }),
      ],
      jest.fn(),
    );

    expect(datasource.getCollection('cars')).toBeInstanceOf(ElasticsearchCollection);
  });
});
