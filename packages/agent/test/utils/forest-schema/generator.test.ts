import SchemaGenerator from '../../../src/utils/forest-schema/generator';
import * as factories from '../../__factories__';

describe('SchemaGenerator', () => {
  test('should serialize collections', async () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'books' }),
    );
    const schema = await SchemaGenerator.buildSchema(dataSource, []);

    expect(schema).toStrictEqual({
      collections: [expect.objectContaining({ name: 'books' })],
      metadata: {
        liana: 'forest-nodejs-agent',
        liana_version: expect.any(String),
        liana_features: null,
        stack: {
          engine: 'nodejs',
          engine_version: expect.any(String),
        },
      },
    });
  });

  test('should sort the collections by name', async () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({ name: 'B' }),
      factories.collection.build({ name: 'ba' }),
      factories.collection.build({ name: 'b' }),
      factories.collection.build({ name: 'a' }),
    ]);
    const schema = await SchemaGenerator.buildSchema(dataSource, []);

    expect(schema.collections.map(c => c.name)).toStrictEqual(['a', 'b', 'B', 'ba']);
  });

  test('it should serialize features', async () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'books' }),
    );
    const schema = await SchemaGenerator.buildSchema(dataSource, ['webhook-custom-actions']);

    expect(schema).toStrictEqual({
      collections: [expect.objectContaining({ name: 'books' })],
      metadata: {
        liana: 'forest-nodejs-agent',
        liana_version: expect.any(String),
        liana_features: {
          'webhook-custom-actions': '1.0.0',
        },
        stack: {
          engine: 'nodejs',
          engine_version: expect.any(String),
        },
      },
    });
  });
});
