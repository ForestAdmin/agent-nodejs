import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../../src/agent/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > One to One', () => {
  const setupWithOneToOneRelation = () => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            bookPk: factories.columnSchema.build({
              columnType: 'Number',
              isPrimaryKey: true,
            }),
            authorId: factories.columnSchema.build({
              columnType: 'String',
              isSortable: true,
            }),
            author: factories.manyToOneSchema.build({
              foreignCollection: 'persons',
              foreignKey: 'authorId',
              foreignKeyTarget: 'personsPk',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            personsPk: factories.columnSchema.build({
              columnType: 'String',
              isPrimaryKey: true,
            }),
            book: factories.oneToOneSchema.build({
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
      setupWithOneToOneRelation().getCollection('persons'),
      'book',
    );

    expect(schema).toStrictEqual({
      field: 'book',
      inverseOf: 'author',

      // This is super strange, but that is what forest-express is sending.
      reference: 'books.personsPk',
      relationship: 'HasOne',
      type: 'String',

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

  test('should generate inverse relation', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      setupWithOneToOneRelation().getCollection('books'),
      'author',
    );

    expect(schema).toStrictEqual({
      field: 'author',
      inverseOf: 'book',
      reference: 'persons.personsPk',
      relationship: 'BelongsTo',
      type: 'String',
      isSortable: true,

      defaultValue: null,
      enums: null,
      integration: null,
      isFilterable: false,
      isPrimaryKey: false,
      isReadOnly: false,
      isRequired: false,
      isVirtual: false,
      validations: [],
    });
  });
});
