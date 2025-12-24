import type { DataSource } from '@forestadmin/datasource-toolkit';

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import PublicationDataSourceDecorator from '../../../src/decorators/publication/datasource';

describe('PublicationDataSourceDecorator', () => {
  let dataSource: DataSource;
  let decoratedDataSource: PublicationDataSourceDecorator;
  const logger = jest.fn();

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'libraries',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myBooks: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignCollection: 'books',
              foreignKey: 'bookId',
              foreignKeyTarget: 'id',
              originKey: 'libraryId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
      factories.collection.build({
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
      }),
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myLibraries: factories.manyToManySchema.build({
              throughCollection: 'librariesBooks',
              foreignCollection: 'libraries',
              foreignKey: 'libraryId',
              foreignKeyTarget: 'id',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
    ]);

    decoratedDataSource = new PublicationDataSourceDecorator(dataSource, logger);
  });

  test('should return all collections when no parameter is provided', () => {
    expect(decoratedDataSource.getCollection('libraries').schema).toStrictEqual(
      dataSource.getCollection('libraries').schema,
    );
    expect(decoratedDataSource.getCollection('librariesBooks').schema).toStrictEqual(
      dataSource.getCollection('librariesBooks').schema,
    );
    expect(decoratedDataSource.getCollection('books').schema).toStrictEqual(
      dataSource.getCollection('books').schema,
    );
  });

  describe('keepCollectionsMatching', () => {
    it('should throw an error if a name is unknown', () => {
      expect(() => decoratedDataSource.keepCollectionsMatching(['unknown'])).toThrow(
        `dsmock: "unknown" does not exist`,
      );

      expect(() => decoratedDataSource.keepCollectionsMatching(undefined, ['unknown'])).toThrow(
        `dsmock: "unknown" does not exist`,
      );
    });

    it('should be able to remove "librariesBooks" collection', () => {
      decoratedDataSource.keepCollectionsMatching(['libraries', 'books']);

      expect(() => decoratedDataSource.getCollection('librariesBooks')).toThrow();
      expect(decoratedDataSource.getCollection('libraries').schema.fields).not.toHaveProperty(
        'myBooks',
      );
      expect(decoratedDataSource.getCollection('books').schema.fields).not.toHaveProperty(
        'myLibraries',
      );
    });

    it('should be able to remove "books" collection', () => {
      decoratedDataSource.keepCollectionsMatching(undefined, ['books']);

      expect(() => decoratedDataSource.getCollection('books')).toThrow();
      expect(decoratedDataSource.getCollection('librariesBooks').schema.fields).not.toHaveProperty(
        'myBook',
      );
      expect(decoratedDataSource.getCollection('libraries').schema.fields).not.toHaveProperty(
        'myBooks',
      );
    });

    describe('Using Mongoose datasource', () => {
      it('should warn that some virtual collections might be removed', () => {
        // @ts-expect-error for mocking
        dataSource.constructor = { name: 'MongooseDatasource' };
        decoratedDataSource.keepCollectionsMatching(['books']);

        expect(logger).toHaveBeenCalledOnce();
        expect(logger).toHaveBeenCalledWith(
          'Warn',
          "Using include whitelist for MongooseDatasource may omit virtual collections that define relationships between included collections. See https://docs.forestadmin.com/developer-guide-agents-nodejs/data-sources/provided-data-sources/mongoose#understanding-flattenmode. Removed collections: 'libraries', 'librariesBooks', kept collections: 'books'",
        );
      });
    });
  });
});
