import * as factories from '../../__factories__';
import SchemaGeneratorSegments from '../../../src/utils/forest-schema/generator-segments';

describe('SchemaGeneratorSegments', () => {
  const collection = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      segments: ['Active', 'Inactive'],
    }),
  });

  test('should serialize segments', () => {
    const schema = SchemaGeneratorSegments.buildSchema(collection, 'Active');

    expect(schema).toStrictEqual({ id: 'books.Active', name: 'Active' });
  });
});
