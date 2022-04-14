import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../../src/agent/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > One to Many', () => {
  const setupWithOneToManyRelation = () => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            author: factories.manyToOneSchema.build({
              foreignCollection: 'persons',
              foreignKey: 'authorId',
            }),
            authorId: factories.columnSchema.build({
              columnType: 'Uuid',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            writtenBooks: factories.oneToManySchema.build({
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
      setupWithOneToManyRelation().getCollection('books'),
      'author',
    );

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
      setupWithOneToManyRelation().getCollection('persons'),
      'writtenBooks',
    );

    expect(schema).toStrictEqual({
      field: 'writtenBooks',
      inverseOf: 'author',
      reference: 'books.id',
      relationship: 'HasMany',
      type: ['Uuid'],

      defaultValue: null,
      enums: null,
      integration: null,
      isFilterable: false,
      isPrimaryKey: false,
      isReadOnly: false,
      isRequired: false,
      isSortable: false,
      isVirtual: false,
      validations: [],
    });
  });
});
