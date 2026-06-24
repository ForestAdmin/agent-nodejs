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
    const schemaGeneratorCollection = new SchemaGeneratorCollection(
      factories.forestAdminHttpDriverOptions.build(),
    );
    const schema = await schemaGeneratorCollection.buildSchema(dataSource.getCollection('books'));

    // readonly
    expect(schema).toHaveProperty('isReadOnly', false);

    // fks are skipped
    expect(schema.fields).toHaveLength(2);
    expect(schema.fields[0]).toHaveProperty('field', 'author');
    expect(schema.fields[1]).toHaveProperty('field', 'id');
  });

  test('persons should be readonly (because all fields are readonly)', async () => {
    const schemaGeneratorCollection = new SchemaGeneratorCollection(
      factories.forestAdminHttpDriverOptions.build(),
    );
    const schema = await schemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema).toHaveProperty('isReadOnly', true);
  });

  test('persons should have actions and segments', async () => {
    const schemaGeneratorCollection = new SchemaGeneratorCollection(
      factories.forestAdminHttpDriverOptions.build(),
    );
    const schema = await schemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema.actions).toHaveLength(2);
    expect(schema.actions[0]).toHaveProperty('name', 'Add person');
    expect(schema.actions[1]).toHaveProperty('name', 'Make as Live');
    expect(schema.segments).toHaveLength(2);
    expect(schema.segments[0]).toHaveProperty('name', 'Dead');
    expect(schema.segments[1]).toHaveProperty('name', 'Live');
  });

  test('persons should have an id, regardless of the fact that it is also a fk', async () => {
    const schemaGeneratorCollection = new SchemaGeneratorCollection(
      factories.forestAdminHttpDriverOptions.build(),
    );
    const schema = await schemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema.fields[0]).toMatchObject({ field: 'id', isPrimaryKey: true });
  });

  test('persons should have a one-to-one relationship', async () => {
    const schemaGeneratorCollection = new SchemaGeneratorCollection(
      factories.forestAdminHttpDriverOptions.build(),
    );
    const schema = await schemaGeneratorCollection.buildSchema(dataSource.getCollection('persons'));

    expect(schema.fields[1]).toMatchObject({
      field: 'mySelf',
      isPrimaryKey: false, // Otherwise the UI will try to use it as a column
      isReadOnly: true, // because the foreignKey that is being used is readonly
      reference: 'persons.id',
      relationship: 'HasOne',
    });
  });

  const buildCollection = (name: string, actions: Record<string, { scope: 'Single' }>) =>
    factories.collection.build({
      name,
      schema: factories.collectionSchema.build({
        actions,
        fields: { id: factories.columnSchema.uuidPrimaryKey().build() },
      }),
      getForm: jest.fn().mockResolvedValue(null),
    });

  describe('when useUnsafeActionEndpoint is true', () => {
    const generator = new SchemaGeneratorCollection(
      factories.forestAdminHttpDriverOptions.build({ useUnsafeActionEndpoint: true }),
    );

    const buildSchemaFor = (actions: Record<string, { scope: 'Single' }>) =>
      generator.buildSchema(
        factories.dataSource
          .buildWithCollections([buildCollection('cards', actions)])
          .getCollection('cards'),
      );

    test('throws when two actions resolve to the same route slug', async () => {
      await expect(
        buildSchemaFor({ 'Send email': { scope: 'Single' }, 'SEND EMAIL': { scope: 'Single' } }),
      ).rejects.toThrow(
        'Actions "SEND EMAIL" and "Send email" on collection "cards" resolve to the same ' +
          'endpoint slug "send-email". Rename one of them or disable useUnsafeActionEndpoint.',
      );
    });

    test('throws naming the first two colliding actions when three collide', async () => {
      await expect(
        buildSchemaFor({
          'Send email': { scope: 'Single' },
          'SEND EMAIL': { scope: 'Single' },
          'send-email': { scope: 'Single' },
        }),
      ).rejects.toThrow(
        'Actions "SEND EMAIL" and "Send email" on collection "cards" resolve to the same ' +
          'endpoint slug "send-email". Rename one of them or disable useUnsafeActionEndpoint.',
      );
    });

    test('builds index-free endpoints when slugs are distinct', async () => {
      const schema = await buildSchemaFor({
        'Send email': { scope: 'Single' },
        'Archive card': { scope: 'Single' },
      });

      expect(schema.actions.map(action => action.endpoint)).toEqual([
        '/forest/_actions/cards/archive-card',
        '/forest/_actions/cards/send-email',
      ]);
    });

    test('does not throw when the same slug is used across different collections', async () => {
      const twoCollections = factories.dataSource.buildWithCollections([
        buildCollection('cards', { 'Send email': { scope: 'Single' } }),
        buildCollection('users', { 'SEND EMAIL': { scope: 'Single' } }),
      ]);

      await expect(
        generator.buildSchema(twoCollections.getCollection('cards')),
      ).resolves.toBeDefined();
      await expect(
        generator.buildSchema(twoCollections.getCollection('users')),
      ).resolves.toBeDefined();
    });
  });

  test('keeps colliding slugs disambiguated by index when useUnsafeActionEndpoint is false', async () => {
    const collection = factories.dataSource
      .buildWithCollections([
        buildCollection('cards', {
          'Send email': { scope: 'Single' },
          'SEND EMAIL': { scope: 'Single' },
        }),
      ])
      .getCollection('cards');
    const generator = new SchemaGeneratorCollection(factories.forestAdminHttpDriverOptions.build());

    const schema = await generator.buildSchema(collection);

    expect(schema.actions.map(action => action.endpoint)).toEqual([
      '/forest/_actions/cards/1/send-email',
      '/forest/_actions/cards/0/send-email',
    ]);
  });
});
