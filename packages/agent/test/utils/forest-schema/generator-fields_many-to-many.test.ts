import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../src/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > Many to Many', () => {
  const setupWithManyToManyRelation = () => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            booksPk: factories.columnSchema.isPrimaryKey().build(),
            reviewers: factories.manyToManySchema.build({
              foreignCollection: 'persons',
              foreignKey: 'personId',
              foreignKeyTarget: 'personsPk',
              originKey: 'bookId',
              originKeyTarget: 'booksPk',
              throughCollection: 'bookPersons',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'bookPersons',
        schema: factories.collectionSchema.build({
          fields: {
            bookId: factories.columnSchema
              .isPrimaryKey()
              .build({ isReadOnly: true, validation: [{ operator: 'Present' }] }),
            book: factories.manyToOneSchema.build({
              foreignCollection: 'books',
              foreignKey: 'bookId',
              foreignKeyTarget: 'booksPk',
            }),
            personId: factories.columnSchema
              .isPrimaryKey()
              .build({ isReadOnly: true, validation: [{ operator: 'Present' }] }),
            person: factories.manyToOneSchema.build({
              foreignCollection: 'person',
              foreignKey: 'personId',
              foreignKeyTarget: 'personsPk',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            personsPk: factories.columnSchema.isPrimaryKey().build(),
            books: factories.manyToManySchema.build({
              foreignCollection: 'books',
              foreignKey: 'bookId',
              foreignKeyTarget: 'booksPk',
              originKey: 'personId',
              originKeyTarget: 'personsPk',
              throughCollection: 'bookPersons',
            }),
          },
        }),
      }),
    ]);
  };

  test('should generate relation when inverse is defined', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      setupWithManyToManyRelation().getCollection('books'),
      'reviewers',
    );

    expect(schema).toStrictEqual({
      field: 'reviewers',
      inverseOf: 'books',
      reference: 'persons.personsPk',
      relationship: 'BelongsToMany',
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

  describe('when the field reference is the primary key', () => {
    test('the many to one relation should not be a primary key', () => {
      const schema = SchemaGeneratorFields.buildSchema(
        setupWithManyToManyRelation().getCollection('bookPersons'),
        'book',
      );

      expect(schema).toEqual({
        field: 'book',
        inverseOf: null,
        reference: 'books.booksPk',
        relationship: 'BelongsTo',
        type: 'Uuid',
        isRequired: true,
        validations: [{ type: 'is present', message: "Failed validation rule: 'Present'" }],
        isFilterable: true,
        isPrimaryKey: false,
        defaultValue: null,
        enums: null,
        integration: null,
        isReadOnly: true,
        isSortable: false,
        isVirtual: false,
      });
    });
  });

  test('should sort schema property', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      setupWithManyToManyRelation().getCollection('bookPersons'),
      'book',
    );

    const schemaProperties = Object.keys(schema);

    expect(schemaProperties).toStrictEqual([
      'defaultValue',
      'enums',
      'field',
      'integration',
      'inverseOf',
      'isFilterable',
      'isPrimaryKey',
      'isReadOnly',
      'isRequired',
      'isSortable',
      'isVirtual',
      'reference',
      'relationship',
      'type',
      'validations',
    ]);
  });
});
