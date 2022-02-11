import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../src/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > Many to Many', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          reviewers: factories.manyToManySchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
            otherField: 'bookId',
            throughCollection: 'bookPersons',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          bookId: factories.columnSchema.isPrimaryKey().build(),
          personId: factories.columnSchema.isPrimaryKey().build(),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          books: factories.manyToManySchema.build({
            foreignCollection: 'books',
            foreignKey: 'bookId',
            otherField: 'personId',
            throughCollection: 'bookPersons',
          }),
        },
      }),
    }),
  ]);

  test('should generate relation when inverse is defined', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      dataSource.getCollection('books'),
      'reviewers',
    );

    expect(schema).toMatchObject({
      field: 'reviewers',
      inverseOf: 'books',
      reference: 'persons.id',
      relationship: 'BelongsToMany',
      type: ['Uuid'],
    });
  });
});
