import { FieldTypes, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import SchemaGeneratorFields from '../../../src/utils/forest-schema/generator-fields';
import factories from '../../__factories__';

describe('SchemaGeneratorFields > One to One', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
          author: {
            type: FieldTypes.ManyToOne,
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          },
          authorId: {
            type: FieldTypes.Column,
            columnType: PrimitiveTypes.Uuid,
          },
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: { type: FieldTypes.Column, columnType: PrimitiveTypes.Uuid, isPrimaryKey: true },
          book: {
            type: FieldTypes.OneToOne,
            foreignCollection: 'books',
            foreignKey: 'authorId',
          },
        },
      }),
    }),
  ]);

  test('should generate relation', () => {
    const schema = SchemaGeneratorFields.buildSchema(dataSource.getCollection('persons'), 'book');

    expect(schema).toMatchObject({
      field: 'book',
      inverseOf: 'author',
      reference: 'books.id',
      relationship: 'HasOne',
      type: 'Uuid',
    });
  });

  test('should generate inverse relation', () => {
    const schema = SchemaGeneratorFields.buildSchema(dataSource.getCollection('books'), 'author');

    expect(schema).toMatchObject({
      field: 'author',
      inverseOf: 'book',
      reference: 'persons.id',
      relationship: 'BelongsTo',
      type: 'Uuid',
    });
  });
});
