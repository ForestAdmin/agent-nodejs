import { FieldTypes, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import SchemaGeneratorFields from '../../../src/utils/forest-schema/generator-fields';
import factories from '../../__factories__';

describe('SchemaGeneratorFields > Many to Many', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: {
            type: FieldTypes.Column,
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          },
          reviewers: {
            type: FieldTypes.ManyToMany,
            foreignCollection: 'persons',
            foreignKey: 'personId',
            otherField: 'bookId',
            throughCollection: 'bookPersons',
          },
        },
      }),
    }),
    factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          bookId: {
            type: FieldTypes.Column,
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          },
          personId: {
            type: FieldTypes.Column,
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          },
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: {
            type: FieldTypes.Column,
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          },
          books: {
            type: FieldTypes.ManyToMany,
            foreignCollection: 'books',
            foreignKey: 'bookId',
            otherField: 'personId',
            throughCollection: 'bookPersons',
          },
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
