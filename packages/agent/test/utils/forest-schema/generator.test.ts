import SchemaGenerator from '../../../src/utils/forest-schema/generator';
import * as factories from '../../__factories__';

describe('SchemaGenerator', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({ name: 'books' }),
  ]);

  test('should serialize collections', async () => {
    const schema = await SchemaGenerator.buildSchema(dataSource);

    expect(schema).toStrictEqual({
      collections: [expect.objectContaining({ name: 'books' })],
      metadata: {
        liana: 'forest-nodejs-agent',
        liana_version: expect.any(String),
        stack: {
          engine: 'nodejs',
          engine_version: expect.any(String),
        },
      },
    });
  });
});
