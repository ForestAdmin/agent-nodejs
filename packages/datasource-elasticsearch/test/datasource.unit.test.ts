import { Client } from '@elastic/elasticsearch';

import { ElasticsearchCollection, ElasticsearchDataSource } from '../src';
import ModelElasticsearch from '../src/model-builder/model';

describe('ElasticsearchDataSource', () => {
  it('should fail to instantiate without a Sequelize instance', () => {
    expect(() => new ElasticsearchDataSource(undefined as unknown as Client, [])).toThrow(
      'Invalid (null) Elasticsearch instance.',
    );
  });

  it('should have no predefined collection', () => {
    expect(
      new ElasticsearchDataSource({ models: {} } as unknown as Client, []).collections,
    ).toBeArrayOfSize(0);
  });

  it('should create collection based on models', () => {
    const elasticsearchClient = new Client({ node: 'http://localhost:9200' });

    const datasource = new ElasticsearchDataSource(elasticsearchClient, [
      new ModelElasticsearch(elasticsearchClient, 'cars', ['indexPatterns'], ['aliases'], {
        properties: {},
      }),
    ]);

    expect(datasource.getCollection('cars')).toBeInstanceOf(ElasticsearchCollection);
  });
});
