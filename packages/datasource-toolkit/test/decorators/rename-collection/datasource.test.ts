import * as factories from '../../__factories__';
import RenameCollectionDataSourceDecorator from '../../../src/decorators/rename-collection/datasource';

describe('RenameCollectionDecorator', () => {
  const setupWithOneToOneRelation = () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'book',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
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
            id: factories.columnSchema.isPrimaryKey().build(),
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
          id: factories.columnSchema.isPrimaryKey().build(),
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
          bookId: factories.columnSchema.isPrimaryKey().build(),
          libraryId: factories.columnSchema.isPrimaryKey().build(),
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
          id: factories.columnSchema.isPrimaryKey().build(),
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
          id: factories.columnSchema.isPrimaryKey().build(),
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
          id: factories.columnSchema.isPrimaryKey().build(),
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
