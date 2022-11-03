import SchemaGeneratorCollection from '../../../src/utils/forest-schema/generator-collection';
import * as factories from '../../__factories__';

describe('SchemaGeneratorCollection', () => {
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          authorId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
        actions: {
          'Make as Live': { scope: 'Single' },
          'Add person': { scope: 'Global' },
        },
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build({ isReadOnly: true }),
          // self-referency relation using a one-to-one relationship
          // (useless in real-life but we want to check that the schema is generated correctly)
          mySelf: factories.oneToOneSchema.build({
            originKey: 'id',
            originKeyTarget: 'id',
            foreignCollection: 'persons',
          }),
        },
        segments: ['Live', 'Dead'],
      }),
      getForm: jest.fn().mockReturnValue(Promise.resolve(null)),
    }),
  ]);

  test('books should not be readonly and skip foreign keys', async () => {
    // because not all fields are readonly
    const schema = await SchemaGeneratorCollection.buildSchema(dataSource.getCollection('books'));

    // readonly
    expect(schema).toHaveProperty('isReadOnly', false);

    // fks are skipped
    expect(schema.fields).toHaveLength(2);
    expect(schema.fields[0]).toHaveProperty('field', 'author');
    expect(schema.fields[1]).toHaveProperty('field', 'id');
  });

  test('persons should be readonly (because all fields are readonly)', async () => {
    const schema = await SchemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema).toHaveProperty('isReadOnly', true);
  });

  test('persons should have actions and segments', async () => {
    const schema = await SchemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema.actions).toHaveLength(2);
    expect(schema.actions[0]).toHaveProperty('name', 'Add person');
    expect(schema.actions[1]).toHaveProperty('name', 'Make as Live');
    expect(schema.segments).toHaveLength(2);
    expect(schema.segments[0]).toHaveProperty('name', 'Dead');
    expect(schema.segments[1]).toHaveProperty('name', 'Live');
  });

  test('persons should have an id, regardless of the fact that it is also a fk', async () => {
    const schema = await SchemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema.fields[0]).toMatchObject({ field: 'id', isPrimaryKey: true });
  });

  test('persons should have a one-to-one relationship', async () => {
    const schema = await SchemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema.fields[1]).toMatchObject({
      field: 'mySelf',
      isPrimaryKey: false, // Otherwise the UI will try to use it as a column
      isReadOnly: true, // because the foreignKey that is being used is readonly
      reference: 'persons.id',
      relationship: 'HasOne',
    });
  });
});
