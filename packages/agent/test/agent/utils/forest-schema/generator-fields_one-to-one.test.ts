import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../../src/agent/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > One to One', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          authorId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
          author: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          book: factories.oneToOneSchema.build({
            foreignCollection: 'books',
            foreignKey: 'authorId',
          }),
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
