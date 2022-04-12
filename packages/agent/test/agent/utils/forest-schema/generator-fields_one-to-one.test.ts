import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../../src/agent/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > One to One', () => {
  const setupWithOneToOneRelation = () => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            authorId: factories.columnSchema.build({ columnType: 'Uuid', isSortable: true }),
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
              originKey: 'authorId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
    ]);
  };

  test('should generate relation', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      setupWithOneToOneRelation().getCollection('persons'),
      'book',
    );

    expect(schema).toStrictEqual({
      field: 'book',
      inverseOf: 'author',
      reference: 'books.id',
      relationship: 'HasOne',
      type: 'Uuid',

      defaultValue: null,
      enums: null,
      integration: null,
      isFilterable: true,
      isPrimaryKey: false,
      isReadOnly: false,
      isRequired: false,
      isSortable: false,
      isVirtual: false,
      validations: [],
    });
  });

  test('should generate inverse relation', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      setupWithOneToOneRelation().getCollection('books'),
      'author',
    );

    expect(schema).toStrictEqual({
      field: 'author',
      inverseOf: 'book',
      reference: 'persons.id',
      relationship: 'BelongsTo',
      type: 'Uuid',
      isSortable: true,

      defaultValue: null,
      enums: null,
      integration: null,
      isFilterable: true,
      isPrimaryKey: false,
      isReadOnly: false,
      isRequired: false,
      isVirtual: false,
      validations: [],
    });
  });
});
