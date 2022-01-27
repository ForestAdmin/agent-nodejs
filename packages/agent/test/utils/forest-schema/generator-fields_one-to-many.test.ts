import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import SchemaGeneratorFields from '../../../dist/utils/forest-schema/generator-fields';
import * as factories from '../../__factories__';

describe('SchemaGeneratorFields > One to Many', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
          author: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
          authorId: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
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
          writtenBooks: factories.oneToManySchema.build({
            foreignCollection: 'books',
            foreignKey: 'authorId',
          }),
        },
      }),
    }),
  ]);

  test('should generate relation', () => {
    const schema = SchemaGeneratorFields.buildSchema(dataSource.getCollection('books'), 'author');

    expect(schema).toMatchObject({
      field: 'author',
      inverseOf: 'writtenBooks',
      reference: 'persons.id',
      relationship: 'BelongsTo',
      type: 'Uuid',
    });
  });

  test('should generate inverse relation', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      dataSource.getCollection('persons'),
      'writtenBooks',
    );

    expect(schema).toMatchObject({
      field: 'writtenBooks',
      inverseOf: 'author',
      reference: 'books.id',
      relationship: 'HasMany',
      type: ['Uuid'],
    });
  });
});
