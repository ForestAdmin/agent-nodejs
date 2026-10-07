import SchemaGeneratorFields from '../../../src/utils/forest-schema/generator-fields';
import * as factories from '../../__factories__';

describe('SchemaGeneratorFields > One to One', () => {
  const setupWithOneToOneRelation = () => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            bookPk: factories.columnSchema.numericPrimaryKey().build(),
            authorId: factories.columnSchema.build({
              columnType: 'String',
              isReadOnly: true,
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
      isFilterable: true,
      isPrimaryKey: false,
      isReadOnly: true,
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
      isReadOnly: true,
      isRequired: false,
      isVirtual: false,
      validations: [],
    });
  });

  describe('when the relations are not filterable', () => {
    const setupWithUnfilterableRelations = () =>
      factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              bookPk: factories.columnSchema.numericPrimaryKey().build(),
              authorId: factories.columnSchema.build({
                columnType: 'String',
                filterOperators: new Set(['Equal']),
              }),
              author: factories.manyToOneSchema.build({
                foreignCollection: 'persons',
                foreignKey: 'authorId',
                foreignKeyTarget: 'personsPk',
                isFilterable: false,
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
                filterOperators: new Set(['Equal']),
              }),
              book: factories.oneToOneSchema.build({
                foreignCollection: 'books',
                originKey: 'authorId',
                originKeyTarget: 'personsPk',
                isFilterable: false,
              }),
            },
          }),
        }),
      ]);

    test('should mark the one to one as not filterable', () => {
      const schema = SchemaGeneratorFields.buildSchema(
        setupWithUnfilterableRelations().getCollection('persons'),
        'book',
      );

      expect(schema.isFilterable).toBe(false);
    });

    test('should mark the many to one as not filterable', () => {
      const schema = SchemaGeneratorFields.buildSchema(
        setupWithUnfilterableRelations().getCollection('books'),
        'author',
      );

      expect(schema.isFilterable).toBe(false);
    });
  });
});
