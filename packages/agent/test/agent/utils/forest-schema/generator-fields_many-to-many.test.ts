import * as factories from '../../__factories__';
import SchemaGeneratorFields from '../../../../src/agent/utils/forest-schema/generator-fields';

describe('SchemaGeneratorFields > Many to Many', () => {
  const setupWithManyToManyRelation = () => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            reviewers: factories.manyToManySchema.build({
              foreignCollection: 'persons',
              foreignKey: 'personId',
              originKey: 'bookId',
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
              .build({ validation: [{ operator: 'Present' }] }),
            book: factories.manyToOneSchema.build({
              foreignCollection: 'books',
              foreignKey: 'bookId',
              foreignKeyTarget: 'id',
            }),
            personId: factories.columnSchema
              .isPrimaryKey()
              .build({ validation: [{ operator: 'Present' }] }),
            person: factories.manyToOneSchema.build({
              foreignCollection: 'person',
              foreignKey: 'personId',
              foreignKeyTarget: 'id',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            books: factories.manyToManySchema.build({
              foreignCollection: 'books',
              foreignKey: 'bookId',
              originKey: 'personId',
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
      reference: 'persons.id',
      relationship: 'BelongsToMany',
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

  test('should generate relation as primary key', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      setupWithManyToManyRelation().getCollection('bookPersons'),
      'book',
    );

    expect(schema).toStrictEqual({
      field: 'book',
      inverseOf: null,
      reference: 'books.id',
      relationship: 'BelongsTo',
      type: 'Uuid',
      isRequired: true,
      validations: [{ message: null, type: 'is present', value: undefined }],
      isFilterable: true,
      isPrimaryKey: true,

      defaultValue: null,
      enums: null,
      integration: null,
      isReadOnly: false,
      isSortable: false,
      isVirtual: false,
    });
  });

  test('should sort schema property', () => {
    const schema = SchemaGeneratorFields.buildSchema(
      setupWithManyToManyRelation().getCollection('bookPersons'),
      'book',
    );

    const schemaProperties = Object.keys(schema);
    const sortedSchemaProperties = [...schemaProperties].sort();

    expect(schemaProperties).toStrictEqual(sortedSchemaProperties);
  });
});
