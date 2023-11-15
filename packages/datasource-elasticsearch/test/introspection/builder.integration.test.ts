import { ElasticsearchDatasourceBuilder } from '../../src/introspection/builder';
import {
  createElasticsearchIndex,
  deleteElasticsearchIndex,
} from '../helpers/elastic-search-index-manager';

const dataset = [
  {
    id: 1,
    text: "If I fall, don't bring me back.",
    user: 'jon',
    date: new Date(),
    nestedField: { type: 'ruby' },
  },
  {
    id: 2,
    text: 'Winter is coming',
    user: 'ned',
    date: new Date(),
    nestedField: { type: 'laravel' },
  },
  {
    id: 3,
    text: 'A Lannister always pays his debts.',
    user: 'tyrion',
    date: new Date(),
    nestedField: { type: 'php' },
  },
  {
    id: 4,
    text: 'I am the blood of the dragon.',
    user: 'daenerys',
    date: new Date(),
    nestedField: { type: 'python' },
  },
  {
    id: 5,
    text: "A girl is Arya Stark of Winterfell. And I'm going home.",
    user: 'arya',
    date: new Date(),
    nestedField: { type: 'javascript' },
  },
];

describe('introspection > builder', () => {
  describe('addCollectionFromIndex', () => {
    it('should get the attributes with their types and constraints', async () => {
      const client = await createElasticsearchIndex('test-index', dataset);
      const elasticsearchDatasourceBuilder = new ElasticsearchDatasourceBuilder(client);
      await elasticsearchDatasourceBuilder.addCollectionFromIndex({
        name: 'quotes',
        indexName: 'test-index',
      });
      const quotes = (await elasticsearchDatasourceBuilder.createCollectionsFromConfiguration())[0];
      expect(quotes.name).toStrictEqual('quotes');
      expect(quotes.getAttributes()).toStrictEqual({
        date: {
          type: 'date',
        },
        id: {
          type: 'long',
        },
        nestedField: {
          properties: {
            type: {
              fields: {
                keyword: {
                  ignore_above: 256,
                  type: 'keyword',
                },
              },
              type: 'text',
            },
          },
        },
        text: {
          type: 'text',
          fields: {
            keyword: {
              type: 'keyword',
              ignore_above: 256,
            },
          },
        },
        user: {
          type: 'text',
          fields: {
            keyword: {
              type: 'keyword',
              ignore_above: 256,
            },
          },
        },
      });
      await deleteElasticsearchIndex('test-index');
    });
  });
});
