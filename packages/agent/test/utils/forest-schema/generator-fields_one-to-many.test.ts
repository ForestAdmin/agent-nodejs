import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../src/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > One to Many', () => {
  const setupWithOneToManyRelation = () => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            booksPk: factories.columnSchema.isPrimaryKey().build(),
            author: factories.manyToOneSchema.build({
              foreignCollection: 'persons',
              foreignKey: 'authorId',
              foreignKeyTarget: 'personsPk',
            }),
            authorId: factories.columnSchema.build({
              columnType: 'Uuid',
              isReadOnly: true,
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            personsPk: factories.columnSchema.isPrimaryKey().build(),
            writtenBooks: factories.oneToManySchema.build({
              foreignCollection: 'books',
              originKey: 'authorId',
              originKeyTarget: 'personsPk',
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
      reference: 'persons.personsPk',
      relationship: 'BelongsTo',
      isReadOnly: true,
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
      reference: 'books.personsPk',
      relationship: 'HasMany',
      type: ['Uuid'],

      defaultValue: null,
      enums: null,
      integration: null,
      isFilterable: false,
      isPrimaryKey: false,
      isReadOnly: true,
      isRequired: false,
      isSortable: false,
      isVirtual: false,
      validations: [],
    });
  });
});
