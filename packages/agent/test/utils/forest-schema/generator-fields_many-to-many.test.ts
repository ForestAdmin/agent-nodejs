import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import SchemaGeneratorFields from '../../../dist/utils/forest-schema/generator-fields';
import * as factories from '../../__factories__';

describe('SchemaGeneratorFields > Many to Many', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
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
          bookId: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
          personId: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
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
