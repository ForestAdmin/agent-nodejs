import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import RenameCollectionDataSourceDecorator from '../../../src/decorators/rename-collection/datasource';

describe('RenameCollectionDecorator', () => {
  const setupWithOneToOneRelation = () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'book',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            owner: factories.oneToOneSchema.build({
              foreignCollection: 'owner',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'owner',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            bookId: factories.columnSchema.build(),
            book: factories.manyToOneSchema.build({
              foreignCollection: 'book',
              foreignKey: 'bookId',
            }),
          },
        }),
      }),
    ]);

    return new RenameCollectionDataSourceDecorator(dataSource);
  };

  const setupWithManyToManyRelation = () => {
    const libraries = factories.collection.build({
      name: 'libraries',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          manyToManyRelationField: factories.manyToManySchema.build({
            throughCollection: 'librariesBooks',
            foreignCollection: 'books',
            foreignKey: 'bookId',
            foreignKeyTarget: 'id',
            originKey: 'libraryId',
            originKeyTarget: 'id',
          }),
        },
      }),
    });

    const librariesBooks = factories.collection.build({
      name: 'librariesBooks',
      schema: factories.collectionSchema.build({
        fields: {
          bookId: factories.columnSchema.uuidPrimaryKey().build(),
          libraryId: factories.columnSchema.uuidPrimaryKey().build(),
          myBook: factories.manyToOneSchema.build({
            foreignCollection: 'books',
            foreignKey: 'bookId',
            foreignKeyTarget: 'id',
          }),
          myLibrary: factories.manyToOneSchema.build({
            foreignCollection: 'libraries',
            foreignKey: 'libraryId',
            foreignKeyTarget: 'id',
          }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          manyToManyRelationField: factories.manyToManySchema.build({
            throughCollection: 'librariesBooks',
            foreignCollection: 'libraries',
            foreignKey: 'libraryId',
            foreignKeyTarget: 'id',
            originKey: 'bookId',
            originKeyTarget: 'id',
          }),
        },
      }),
    });

    const dataSource = new RenameCollectionDataSourceDecorator(
      factories.dataSource.buildWithCollections([librariesBooks, books, libraries]),
    );

    // hydrate cache to ensure invalidation is working
    void dataSource.getCollection('librariesBooks').schema;
    void dataSource.getCollection('books').schema;
    void dataSource.getCollection('libraries').schema;

    return dataSource;
  };

  const setupWithManyToOneAndOneToManyRelations = () => {
    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
          myBooks: factories.manyToOneSchema.build({
            foreignCollection: 'books',
            foreignKey: 'id',
          }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          personId: factories.columnSchema.build({ columnType: 'Uuid' }),
          myPersons: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
          }),
        },
      }),
    });

    const dataSource = new RenameCollectionDataSourceDecorator(
      factories.dataSource.buildWithCollections([persons, books]),
    );

    // hydrate cache to ensure invalidation is working
    void dataSource.getCollection('persons').schema;
    void dataSource.getCollection('books').schema;

    return dataSource;
  };

  test('should return the real name when it is not renamed', () => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({ name: 'name 1' }),
    );
    const decoratedDataSource = new RenameCollectionDataSourceDecorator(dataSource);
    const collection = decoratedDataSource.getCollection('name 1');

    expect(collection.name).toEqual('name 1');
  });

  describe('renameCollection', () => {
    it('should throw an error if the given new name is already used', () => {
      const dataSource = setupWithManyToManyRelation();

      expect(() => dataSource.renameCollection('librariesBooks', 'books')).toThrow(
        'The given new collection name "books" is already defined in the dataSource',
      );
    });

    it('should throw an error if the given old name does not exist', () => {
      const dataSource = setupWithManyToManyRelation();

      expect(() => dataSource.renameCollection('doesNotExist', 'books')).toThrow(
        'The given collection name "doesNotExist" does not exist',
      );
    });

    test('should return the new name when it is renamed', () => {
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'name 1' }),
      );
      const decoratedDataSource = new RenameCollectionDataSourceDecorator(dataSource);
      decoratedDataSource.renameCollection('name 1', 'name 2');

      expect(decoratedDataSource.getCollection('name 2')).toMatchObject({ name: 'name 2' });
      expect(() => decoratedDataSource.getCollection('name 1')).toThrow(
        `Collection 'name 1' not found.`,
      );
    });

    test('should change the foreign collection when it is a many to one', () => {
      const dataSource = setupWithManyToOneAndOneToManyRelations();
      dataSource.renameCollection('persons', 'renamedPersons');

      const collection = dataSource.getCollection('books');

      expect(collection.schema.fields.myPersons).toEqual({
        foreignCollection: 'renamedPersons',
        foreignKey: 'personId',
        foreignKeyTarget: 'id',
        type: 'ManyToOne',
      });
    });

    test('should change the foreign collection when it is a one to many', () => {
      const dataSource = setupWithManyToOneAndOneToManyRelations();

      dataSource.renameCollection('books', 'renamedBooks');

      const collection = dataSource.getCollection('persons');

      expect(collection.schema.fields.myBooks).toEqual({
        foreignCollection: 'renamedBooks',
        foreignKey: 'id',
        foreignKeyTarget: 'id',
        type: 'ManyToOne',
      });
    });

    test('should change the foreign collection when it is a one to one', () => {
      const dataSource = setupWithOneToOneRelation();

      dataSource.renameCollection('owner', 'renamedOwner');

      const collection = dataSource.getCollection('book');

      expect(collection.schema.fields.owner).toEqual({
        foreignCollection: 'renamedOwner',
        originKey: 'bookId',
        originKeyTarget: 'id',
        type: 'OneToOne',
      });
    });

    test('should change the foreign collection when it is a many to many', () => {
      const dataSource = setupWithManyToManyRelation();

      dataSource.renameCollection('librariesBooks', 'renamedLibrariesBooks');
      dataSource.renameCollection('books', 'renamedBooks');

      const collection = dataSource.getCollection('libraries');

      expect(collection.schema.fields.manyToManyRelationField).toEqual({
        foreignCollection: 'renamedBooks',
        foreignKey: 'bookId',
        foreignKeyTarget: 'id',
        originKey: 'libraryId',
        originKeyTarget: 'id',
        throughCollection: 'renamedLibrariesBooks',
        type: 'ManyToMany',
      });
    });
  });

  describe('renameCollections', () => {
    it('should work with undefined', () => {
      const dataSource = setupWithManyToManyRelation();

      dataSource.renameCollections();

      const collectionNames = dataSource.collections.map(c => c.name);
      expect(collectionNames).toContain('librariesBooks');
    });

    it('should work when using plain object', () => {
      const dataSource = setupWithManyToManyRelation();

      dataSource.renameCollections({ librariesBooks: 'lib' });

      const collectionNames = dataSource.collections.map(c => c.name);
      expect(collectionNames).toContain('lib');
      expect(collectionNames).not.toContain('librariesBooks');
    });

    it('should rename collection using a function', () => {
      const dataSource = setupWithManyToManyRelation();

      dataSource.renameCollections(name => (name === 'librariesBooks' ? 'lib' : name));

      const collectionNames = dataSource.collections.map(c => c.name);
      expect(collectionNames).toContain('lib');
      expect(collectionNames).not.toContain('librariesBooks');
    });

    it('should rename collection using a function returning null', () => {
      const dataSource = setupWithManyToManyRelation();
      dataSource.renameCollections(name => (name === 'librariesBooks' ? 'lib' : null));

      const collectionNames = dataSource.collections.map(c => c.name);
      expect(collectionNames).toContain('lib');
      expect(collectionNames).not.toContain('librariesBooks');
    });
  });
});
