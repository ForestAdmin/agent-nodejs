import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../../src/agent/utils/forest-schema/generator-fields';

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
            originKey: 'bookId',
            throughCollection: 'bookPersons',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          bookId: factories.columnSchema
            .isPrimaryKey()
            .build({ validation: [{ operator: 'Present' }] }),
          book: factories.manyToOneSchema.build({
            foreignCollection: 'books',
            foreignKey: 'bookId',
            foreignKeyTarget: 'id',
          }),
          personId: factories.columnSchema
            .isPrimaryKey()
            .build({ validation: [{ operator: 'Present' }] }),
          person: factories.manyToOneSchema.build({
            foreignCollection: 'person',
            foreignKey: 'personId',
            foreignKeyTarget: 'id',
          }),
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
            originKey: 'personId',
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

  test('should generate relation as primary key', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      dataSource.getCollection('bookPersons'),
      'book',
    );

    expect(schema).toMatchObject({
      field: 'book',
      inverseOf: null,
      reference: 'books.id',
      relationship: 'BelongsTo',
      type: 'Uuid',
      isPrimaryKey: true,
      isRequired: true,
    });
  });
});
