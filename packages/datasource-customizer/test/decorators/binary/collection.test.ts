import {
  AggregateResult,
  Aggregation,
  Collection,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import BinaryCollectionDecorator from '../../../src/decorators/binary/collection';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';

// Sample records
const bookRecord = {
  id: Buffer.from('0000', 'ascii'),
  cover: Buffer.from(
    // 1x1 transparent png (we use it to test that the datauri can guess mime types)
    'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    'base64',
  ),
  author: {
    name: 'John Doe',
    // Invalid image file (the datauri should not be able to guess the mime type)
    picture: Buffer.from('0000', 'ascii'),
    tags: ['tag1', 'tag2'],
  },
};

const favoriteRecord = { id: 1, book: bookRecord };

describe('BinaryCollectionDecorator', () => {
  let books: Collection;
  let favorites: Collection;
  let decoratedBook: BinaryCollectionDecorator;
  let decoratedFavorites: BinaryCollectionDecorator;

  beforeEach(() => {
    favorites = factories.collection.build({
      name: 'favorites',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.numericPrimaryKey().build(),
          book: factories.manyToOneSchema.build({
            foreignCollection: 'books',
          }),
        },
      }),
    });

    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            isPrimaryKey: true,
            columnType: 'Binary',
            validation: [
              { operator: 'LongerThan', value: 15 },
              { operator: 'ShorterThan', value: 17 },
              { operator: 'Present' },
              { operator: 'NotEqual', value: Buffer.from('1234', 'ascii') },
            ],
          }),
          title: factories.columnSchema.build({ columnType: 'String' }),
          cover: factories.columnSchema.build({ columnType: 'Binary' }),
          author: factories.columnSchema.build({
            columnType: { name: 'String', picture: 'Binary', tags: ['String'] },
          }),
        },
      }),
    });

    const dataSource = factories.dataSource.buildWithCollections([books, favorites]);
    const decoratedDataSource = new DataSourceDecorator(dataSource, BinaryCollectionDecorator);
    decoratedBook = decoratedDataSource.getCollection('books');
    decoratedFavorites = decoratedDataSource.getCollection('favorites');
  });

  describe('setBinaryMode', () => {
    test('should throw if an invalid mode is provided', () => {
      // @ts-expect-error: invalid mode
      expect(() => decoratedBook.setBinaryMode('cover', 'invalid')).toThrow();
    });

    test('should throw if the field does not exist', () => {
      expect(() => decoratedBook.setBinaryMode('invalid', 'hex')).toThrow();
    });

    test('should throw if the field is not a binary field', () => {
      expect(() => decoratedBook.setBinaryMode('title', 'hex')).toThrow();
    });

    test('should not throw if the field is a binary field', () => {
      expect(() => decoratedBook.setBinaryMode('cover', 'hex')).not.toThrow();
    });
  });

  describe('schema', () => {
    test('favorite schema should not be modified', () => {
      expect(decoratedFavorites.schema).toEqual(favorites.schema);
    });

    test('book primary key should be rewritten as an hex string', () => {
      expect(decoratedBook.schema.fields.id).toEqual(
        expect.objectContaining({
          isPrimaryKey: true,
          columnType: 'String',
          validation: [
            { operator: 'Match', value: /^[0-9a-f]+$/ },
            { operator: 'LongerThan', value: 31 },
            { operator: 'ShorterThan', value: 33 },
            { operator: 'Present' },
          ],
        }),
      );
    });

    test('book cover should be rewritten as a datauri', () => {
      expect(decoratedBook.schema.fields.cover).toEqual(
        expect.objectContaining({
          columnType: 'String',
          validation: [{ operator: 'Match', value: /^data:.*;base64,.*/ }],
        }),
      );
    });

    test('book author picture should be rewritten but validation left alone', () => {
      expect(decoratedBook.schema.fields.author).toEqual(
        expect.objectContaining({
          columnType: { name: 'String', picture: 'String', tags: ['String'] },
        }),
      );
    });

    test('if requested, cover should be rewritten as an hex string', () => {
      decoratedBook.setBinaryMode('cover', 'hex');
      expect(decoratedBook.schema.fields.cover).toEqual(
        expect.objectContaining({
          columnType: 'String',
          validation: [{ operator: 'Match', value: /^[0-9a-f]+$/ }],
        }),
      );
    });
  });

  describe('list with a simple filter', () => {
    // Build params (30303030 is the hex representation of 0000)
    const conditionTree = new ConditionTreeLeaf('id', 'Equal', '30303030');
    const caller = factories.caller.build();
    const filter = new PaginatedFilter({ conditionTree });
    const projection = new Projection('id', 'cover', 'author:picture');

    let records: RecordData[];

    beforeEach(async () => {
      (books.list as jest.Mock).mockResolvedValue([bookRecord]);
      records = await decoratedBook.list(caller, filter, projection);
    });

    test('query should be transformed', () => {
      const expectedConditionTree = new ConditionTreeLeaf(
        'id',
        'Equal',
        Buffer.from('0000', 'ascii'),
      );

      expect(books.list).toHaveBeenCalledWith(
        caller,
        expect.objectContaining({ conditionTree: expectedConditionTree }),
        projection,
      );
    });

    test('records should be transformed', () => {
      expect(records).toEqual([
        {
          id: '30303030',
          cover:
            'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
          author: {
            name: 'John Doe',
            picture: 'data:application/octet-stream;base64,MDAwMA==',
            tags: ['tag1', 'tag2'],
          },
        },
      ]);
    });
  });

  describe('list with a more complex filter', () => {
    // Build condition tree (30303030 is the hex representation of 0000)
    const conditionTree = new ConditionTreeBranch('Or', [
      new ConditionTreeLeaf('id', 'Equal', '30303030'),
      new ConditionTreeLeaf('id', 'In', ['30303030']),
      new ConditionTreeLeaf('title', 'Equal', 'Foundation'),
      new ConditionTreeLeaf('title', 'Like', 'Found%'),
      new ConditionTreeLeaf('cover', 'Equal', 'data:image/gif;base64,123'),
    ]);

    // Build params
    const caller = factories.caller.build();
    const filter = new PaginatedFilter({ conditionTree });
    const projection = new Projection('id', 'cover', 'author:picture');

    beforeEach(async () => {
      (books.list as jest.Mock).mockResolvedValue([bookRecord]);
      await decoratedBook.list(caller, filter, projection);
    });

    test('query should be transformed', () => {
      const expectedConditionTree = new ConditionTreeBranch('Or', [
        new ConditionTreeLeaf('id', 'Equal', Buffer.from('0000', 'ascii')),
        new ConditionTreeLeaf('id', 'In', [Buffer.from('0000', 'ascii')]),
        new ConditionTreeLeaf('title', 'Equal', 'Foundation'),
        new ConditionTreeLeaf('title', 'Like', 'Found%'),
        new ConditionTreeLeaf('cover', 'Equal', Buffer.from('123', 'base64')),
      ]);

      expect(books.list).toHaveBeenCalledWith(
        caller,
        expect.objectContaining({ conditionTree: expectedConditionTree }),
        projection,
      );
    });
  });

  describe('list from relations', () => {
    // Build params (30303030 is the hex representation of 0000)
    const conditionTree = new ConditionTreeLeaf('book:id', 'Equal', '30303030');
    const caller = factories.caller.build();
    const filter = new PaginatedFilter({ conditionTree });
    const projection = new Projection('id', 'book:id', 'book:cover', 'book:author:picture');

    let records: RecordData[];

    beforeEach(async () => {
      (favorites.list as jest.Mock).mockResolvedValue([favoriteRecord, { id: 2, book: null }]);
      records = await decoratedFavorites.list(caller, filter, projection);
    });

    test('query should be transformed', () => {
      const expectedConditionTree = new ConditionTreeLeaf(
        'book:id',
        'Equal',
        Buffer.from('0000', 'ascii'),
      );

      expect(favorites.list).toHaveBeenCalledWith(
        caller,
        expect.objectContaining({ conditionTree: expectedConditionTree }),
        projection,
      );
    });

    test('records should be transformed', () => {
      expect(records).toEqual([
        {
          id: 1,
          book: {
            id: '30303030',
            cover:
              'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
            author: {
              name: 'John Doe',
              picture: 'data:application/octet-stream;base64,MDAwMA==',
              tags: ['tag1', 'tag2'],
            },
          },
        },
        {
          id: 2,
          book: null,
        },
      ]);
    });
  });

  describe('simple creation', () => {
    const caller = factories.caller.build();
    const record = { id: '3030', cover: 'data:application/octet-stream;base64,aGVsbG8=' };

    let createdRecords: RecordData[];

    beforeEach(async () => {
      createdRecords = await decoratedBook.create(caller, [record]);
    });

    test('record should be transformed when going to database', () => {
      expect(books.create).toHaveBeenCalledWith(caller, [
        expect.objectContaining({
          id: Buffer.from('3030', 'hex'),
          cover: Buffer.from('aGVsbG8=', 'base64'),
        }),
      ]);
    });

    test('return value should be transformed back for frontend', () => {
      expect(createdRecords).toEqual([
        { id: '3030', cover: 'data:application/octet-stream;base64,aGVsbG8=' },
      ]);
    });
  });

  describe('simple update', () => {
    const caller = factories.caller.build();
    const filter = new Filter({});
    const patch = { cover: 'data:image/gif;base64,aGVsbG8=' };

    beforeEach(async () => {
      await decoratedBook.update(caller, filter, patch);
    });

    test('patch should be transformed when passed to the db', () => {
      expect(books.update).toHaveBeenCalledWith(
        caller,
        filter,
        expect.objectContaining({ cover: Buffer.from('aGVsbG8=', 'base64') }),
      );
    });
  });

  describe('aggreation with binary groups', () => {
    const caller = factories.caller.build();
    const filter = new Filter({});
    const aggregation = new Aggregation({
      field: 'title',
      operation: 'Count',
      groups: [{ field: 'cover' }],
    });

    let result: AggregateResult[];

    beforeEach(async () => {
      (books.aggregate as jest.Mock).mockResolvedValue([
        { value: 1, group: { cover: Buffer.from('aGVsbG8=', 'base64') } },
      ]);

      result = await decoratedBook.aggregate(caller, filter, aggregation);
    });

    test('groups in result should be transformed', () => {
      expect(result).toEqual([
        {
          value: 1,
          group: { cover: 'data:application/octet-stream;base64,aGVsbG8=' },
        },
      ]);
    });
  });

  describe('aggregation from a relation', () => {
    // This is actually testing that the convertValue function works when provided with paths
    // that go through relations, as we are using the same function for both cases.
    const caller = factories.caller.build();
    const filter = new Filter({});
    const aggregation = new Aggregation({
      field: 'id',
      operation: 'Count',
      groups: [{ field: 'book:cover' }],
    });

    let result: AggregateResult[];

    beforeEach(async () => {
      (favorites.aggregate as jest.Mock).mockResolvedValue([
        { value: 1, group: { 'book:cover': Buffer.from('aGVsbG8=', 'base64') } },
      ]);

      result = await decoratedFavorites.aggregate(caller, filter, aggregation);
    });

    test('groups in result should be transformed', () => {
      expect(result).toEqual([
        { value: 1, group: { 'book:cover': 'data:application/octet-stream;base64,aGVsbG8=' } },
      ]);
    });
  });
});
