import type {
  AggregateResult,
  Collection,
  CollectionSchema,
  FieldSchema,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  CollectionDecorator,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  DataSourceDecorator,
  Filter,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import BinaryCollectionDecorator from '../../../src/decorators/binary/collection';

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
            { operator: 'Match', value: /^([0-9a-f]{2})+$/i },
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
          validation: [{ operator: 'Match', value: /^([0-9a-f]{2})+$/i }],
        }),
      );
    });
  });

  describe('with a nested enum sibling of a binary field', () => {
    let items: Collection;
    let decoratedItems: BinaryCollectionDecorator;

    beforeEach(() => {
      items = factories.collection.build({
        name: 'items',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            data: factories.columnSchema.build({
              columnType: { pic: 'Binary', kind: { type: 'Enum', enumValues: ['a', 'b'] } },
            }),
          },
        }),
      });

      const dataSource = factories.dataSource.buildWithCollections([items]);
      decoratedItems = new DataSourceDecorator(dataSource, BinaryCollectionDecorator).getCollection(
        'items',
      );
    });

    test('schema should rewrite the binary but leave the nested enum untouched', () => {
      expect(decoratedItems.schema.fields.data).toEqual(
        expect.objectContaining({
          columnType: { pic: 'String', kind: { type: 'Enum', enumValues: ['a', 'b'] } },
        }),
      );
    });

    test('list should preserve the enum value while converting the binary', async () => {
      (items.list as jest.Mock).mockResolvedValue([
        { id: 1, data: { pic: Buffer.from('0000', 'ascii'), kind: 'a' } },
      ]);

      const records = await decoratedItems.list(
        factories.caller.build(),
        new PaginatedFilter({}),
        new Projection('id', 'data:pic', 'data:kind'),
      );

      expect(records).toEqual([
        { id: 1, data: { pic: 'data:application/octet-stream;base64,MDAwMA==', kind: 'a' } },
      ]);
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

  describe('list filtering a binary column with a malformed value', () => {
    it.each([
      ['cover', 'Anthony', /must be a data uri/],
      ['cover', 'data:text/plain,hello', /must be a data uri/],
      ['id', 'Anthony', /hex string of full bytes/],
      ['id', '303', /hex string of full bytes/],
    ])(
      'should reject %s = %p instead of querying the collection',
      async (field, value, message) => {
        const caller = factories.caller.build();
        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf(field, 'Equal', value),
        });

        await expect(decoratedBook.list(caller, filter, new Projection('id'))).rejects.toThrow(
          message,
        );
        expect(books.list).not.toHaveBeenCalled();
      },
    );

    it('should truncate a long value in the error message', async () => {
      const caller = factories.caller.build();
      const filter = new PaginatedFilter({
        conditionTree: new ConditionTreeLeaf('id', 'Equal', 'z'.repeat(5000)),
      });

      await expect(decoratedBook.list(caller, filter, new Projection('id'))).rejects.toThrow(
        `Expected a hex string of full bytes for a binary field, got "${'z'.repeat(32)}"`,
      );
      expect(books.list).not.toHaveBeenCalled();
    });
  });

  describe('writing a non-string value into a binary column', () => {
    it('should reject it with a validation error rather than an opaque TypeError', async () => {
      const caller = factories.caller.build();

      await expect(decoratedBook.create(caller, [{ cover: 42 }])).rejects.toThrow(
        'Expected a string for a binary field, got number: 42',
      );
      expect(books.create).not.toHaveBeenCalled();
    });

    it('should let a buffer through, as it needs no conversion', async () => {
      const caller = factories.caller.build();
      const id = Buffer.from('0000', 'ascii');
      (books.create as jest.Mock).mockResolvedValue([{ id }]);

      await decoratedBook.create(caller, [{ id }]);

      expect(books.create).toHaveBeenCalledWith(caller, [{ id }]);
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

  describe('list with a projection reaching no binary field', () => {
    test('should return the records of the child collection untouched', async () => {
      const childRecords = [{ id: 1, book: { title: 'Foundation' } }];
      (favorites.list as jest.Mock).mockResolvedValue(childRecords);

      const records = await decoratedFavorites.list(
        factories.caller.build(),
        new PaginatedFilter({}),
        new Projection('id', 'book:title'),
      );

      expect(records).toBe(childRecords);
    });
  });

  describe('list after switching a binary column to hex', () => {
    test('should convert the column with the new mode', async () => {
      const caller = factories.caller.build();
      const projection = new Projection('cover');
      (books.list as jest.Mock).mockResolvedValue([{ cover: Buffer.from('0000', 'ascii') }]);

      await decoratedBook.list(caller, new PaginatedFilter({}), projection);
      decoratedBook.setBinaryMode('cover', 'hex');
      const records = await decoratedBook.list(caller, new PaginatedFilter({}), projection);

      expect(records).toEqual([{ cover: '30303030' }]);
    });
  });

  describe('list with a column projected without its record key', () => {
    test('should not add the missing key to the record', async () => {
      (books.list as jest.Mock).mockResolvedValue([{ title: 'Foundation' }]);

      const records = await decoratedBook.list(
        factories.caller.build(),
        new PaginatedFilter({}),
        new Projection('title', 'cover'),
      );

      expect(records).toEqual([{ title: 'Foundation' }]);
    });
  });

  describe('with an array of binaries', () => {
    test('list should convert every item of the array', async () => {
      const files = factories.collection.build({
        name: 'files',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            chunks: factories.columnSchema.build({ columnType: ['Binary'] }),
          },
        }),
      });
      const decoratedFiles = new DataSourceDecorator(
        factories.dataSource.buildWithCollections([files]),
        BinaryCollectionDecorator,
      ).getCollection('files');
      (files.list as jest.Mock).mockResolvedValue([
        { id: 1, chunks: [Buffer.from('0000', 'ascii'), null] },
      ]);

      const records = await decoratedFiles.list(
        factories.caller.build(),
        new PaginatedFilter({}),
        new Projection('id', 'chunks'),
      );

      expect(records).toEqual([
        { id: 1, chunks: ['data:application/octet-stream;base64,MDAwMA==', null] },
      ]);
    });
  });

  describe('aggregation with binary and non binary groups', () => {
    test('should only convert the binary groups', async () => {
      (favorites.aggregate as jest.Mock).mockResolvedValue([
        { value: 1, group: { 'book:title': 'Foundation', 'book:id': Buffer.from('00', 'ascii') } },
      ]);

      const result = await decoratedFavorites.aggregate(
        factories.caller.build(),
        new Filter({}),
        new Aggregation({
          operation: 'Count',
          groups: [{ field: 'book:title' }, { field: 'book:id' }],
        }),
      );

      expect(result).toEqual([
        { value: 1, group: { 'book:title': 'Foundation', 'book:id': '3030' } },
      ]);
    });

    test('should return the rows untouched when no group is binary', async () => {
      const rows = [{ value: 1, group: { 'book:title': 'Foundation' } }];
      (favorites.aggregate as jest.Mock).mockResolvedValue(rows);

      const result = await decoratedFavorites.aggregate(
        factories.caller.build(),
        new Filter({}),
        new Aggregation({ operation: 'Count', groups: [{ field: 'book:title' }] }),
      );

      expect(result).toBe(rows);
    });
  });

  describe('filter reaching no binary field', () => {
    test('should pass the filter to the child collection untouched', async () => {
      const filter = new PaginatedFilter({
        conditionTree: new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('id', 'Equal', 1),
          new ConditionTreeLeaf('book:title', 'Equal', 'Foundation'),
          new ConditionTreeLeaf('book:cover', 'Present'),
        ]),
      });

      await decoratedFavorites.list(factories.caller.build(), filter, new Projection('id'));

      expect((favorites.list as jest.Mock).mock.calls[0][1]).toBe(filter);
    });

    test('should pass an unknown field through to the child collection', async () => {
      const filter = new PaginatedFilter({
        conditionTree: new ConditionTreeLeaf('unknown', 'Equal', 'value'),
      });

      await decoratedBook.list(factories.caller.build(), filter, new Projection('title'));

      expect((books.list as jest.Mock).mock.calls[0][1]).toBe(filter);
    });
  });

  describe('composite sub-path of a binary column', () => {
    test('filter should convert the value with the sub-type', async () => {
      const caller = factories.caller.build();
      const filter = new PaginatedFilter({
        conditionTree: new ConditionTreeLeaf(
          'book:author:picture',
          'Equal',
          'data:application/octet-stream;base64,MDAwMA==',
        ),
      });

      await decoratedFavorites.list(caller, filter, new Projection('id'));

      expect(favorites.list).toHaveBeenCalledWith(
        caller,
        expect.objectContaining({
          conditionTree: new ConditionTreeLeaf(
            'book:author:picture',
            'Equal',
            Buffer.from('0000', 'ascii'),
          ),
        }),
        new Projection('id'),
      );
    });

    test('aggregate should convert the group with the sub-type', async () => {
      (books.aggregate as jest.Mock).mockResolvedValue([
        { value: 1, group: { 'author:picture': Buffer.from('0000', 'ascii') } },
      ]);

      const result = await decoratedBook.aggregate(
        factories.caller.build(),
        new Filter({}),
        new Aggregation({ operation: 'Count', groups: [{ field: 'author:picture' }] }),
      );

      expect(result).toEqual([
        {
          value: 1,
          group: { 'author:picture': 'data:application/octet-stream;base64,MDAwMA==' },
        },
      ]);
    });

    test('aggregate should leave a non binary sub-path untouched', async () => {
      const rows = [{ value: 1, group: { 'author:name': 'John Doe' } }];
      (books.aggregate as jest.Mock).mockResolvedValue(rows);

      const result = await decoratedBook.aggregate(
        factories.caller.build(),
        new Filter({}),
        new Aggregation({ operation: 'Count', groups: [{ field: 'author:name' }] }),
      );

      expect(result).toBe(rows);
    });
  });

  describe('aggregation through two relations', () => {
    test('should convert the binary group with the mode of the last collection', async () => {
      const reviews = factories.collection.build({
        name: 'reviews',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            favorite: factories.manyToOneSchema.build({ foreignCollection: 'favorites' }),
          },
        }),
      });
      const decoratedReviews = new DataSourceDecorator(
        factories.dataSource.buildWithCollections([reviews, favorites, books]),
        BinaryCollectionDecorator,
      ).getCollection('reviews');
      (reviews.aggregate as jest.Mock).mockResolvedValue([
        {
          value: 1,
          group: {
            'favorite:book:id': Buffer.from('0000', 'ascii'),
            'favorite:book:cover': Buffer.from('0000', 'ascii'),
          },
        },
      ]);

      const result = await decoratedReviews.aggregate(
        factories.caller.build(),
        new Filter({}),
        new Aggregation({
          operation: 'Count',
          groups: [{ field: 'favorite:book:id' }, { field: 'favorite:book:cover' }],
        }),
      );

      expect(result).toEqual([
        {
          value: 1,
          group: {
            'favorite:book:id': '30303030',
            'favorite:book:cover': 'data:application/octet-stream;base64,MDAwMA==',
          },
        },
      ]);
    });
  });

  describe('writing an unknown key', () => {
    test('create should pass it through to the child collection', async () => {
      const caller = factories.caller.build();
      (books.create as jest.Mock).mockResolvedValue([{ unknown: 'value' }]);

      const records = await decoratedBook.create(caller, [
        { unknown: 'value', cover: 'data:application/octet-stream;base64,MDAwMA==' },
      ]);

      expect(books.create).toHaveBeenCalledWith(caller, [
        { unknown: 'value', cover: Buffer.from('0000', 'ascii') },
      ]);
      expect(records).toEqual([{ unknown: 'value' }]);
    });

    test('update should pass it through to the child collection', async () => {
      const caller = factories.caller.build();
      const filter = new Filter({});

      await decoratedBook.update(caller, filter, { unknown: 'value' });

      expect(books.update).toHaveBeenCalledWith(caller, filter, { unknown: 'value' });
    });
  });

  describe('when a lower decorator changes its schema after a first read', () => {
    class FieldAddingCollectionDecorator extends CollectionDecorator {
      private addedFields: Record<string, FieldSchema> = {};

      addField(name: string, schema: FieldSchema): void {
        this.addedFields[name] = schema;
        this.markSchemaAsDirty();
      }

      protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
        return { ...subSchema, fields: { ...subSchema.fields, ...this.addedFields } };
      }
    }

    test('should use hex for a binary column that became a foreign key', async () => {
      const owners = factories.collection.build({
        name: 'owners',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({ isPrimaryKey: true, columnType: 'Binary' }),
          },
        }),
      });
      const pets = factories.collection.build({
        name: 'pets',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            ownerId: factories.columnSchema.build({ columnType: 'Binary' }),
          },
        }),
      });
      const lowerDataSource = new DataSourceDecorator(
        factories.dataSource.buildWithCollections([pets, owners]),
        FieldAddingCollectionDecorator,
      );
      const decoratedPets = new DataSourceDecorator(
        lowerDataSource,
        BinaryCollectionDecorator,
      ).getCollection('pets');
      const caller = factories.caller.build();
      const projection = new Projection('ownerId');
      (pets.list as jest.Mock).mockResolvedValue([{ ownerId: Buffer.from('0000', 'ascii') }]);

      const before = await decoratedPets.list(caller, new PaginatedFilter({}), projection);
      lowerDataSource
        .getCollection('pets')
        .addField(
          'owner',
          factories.manyToOneSchema.build({ foreignCollection: 'owners', foreignKey: 'ownerId' }),
        );
      const after = await decoratedPets.list(caller, new PaginatedFilter({}), projection);

      expect(before).toEqual([{ ownerId: 'data:application/octet-stream;base64,MDAwMA==' }]);
      expect(after).toEqual([{ ownerId: '30303030' }]);
    });
  });

  describe('on a wide collection', () => {
    const range = (count: number) => Array.from({ length: count }, (_, i) => i);

    const buildWideCollection = (columnCount: number, binaryColumn = false) => {
      const cardFields: Record<string, FieldSchema> = {
        id: factories.columnSchema.numericPrimaryKey().build(),
      };
      const wideFields: Record<string, FieldSchema> = {
        id: factories.columnSchema.numericPrimaryKey().build(),
        card_id: factories.columnSchema.build({ columnType: 'Number' }),
        card: factories.manyToOneSchema.build({
          foreignCollection: 'cards',
          foreignKey: 'card_id',
        }),
      };

      range(columnCount).forEach(i => {
        cardFields[`column${i}`] = factories.columnSchema.build({ columnType: 'String' });
        wideFields[`column${i}`] = factories.columnSchema.build({ columnType: 'String' });
      });

      if (binaryColumn) wideFields.file = factories.columnSchema.build({ columnType: 'Binary' });

      const cards = factories.collection.build({
        name: 'cards',
        schema: factories.collectionSchema.build({ fields: cardFields }),
      });
      const child = factories.collection.build({
        name: 'wide',
        schema: factories.collectionSchema.build({ fields: wideFields }),
      });
      const decorated = new DataSourceDecorator(
        factories.dataSource.buildWithCollections([child, cards]),
        BinaryCollectionDecorator,
      ).getCollection('wide');

      return { child, decorated };
    };

    const buildRecords = (columnCount: number, binaryColumn = false) =>
      range(10).map(id => {
        const record: RecordData = { id, card_id: id, card: { id } };
        range(columnCount).forEach(i => {
          record[`column${i}`] = 'value';
          record.card[`column${i}`] = 'value';
        });
        if (binaryColumn) record.file = Buffer.from('00', 'ascii');

        return record;
      });

    const buildProjection = (columnCount: number, binaryColumn = false) =>
      new Projection(
        'id',
        'card_id',
        'card:id',
        ...range(columnCount).flatMap(i => [`column${i}`, `card:column${i}`]),
        ...(binaryColumn ? ['file'] : []),
      );

    test('list without binary columns should return the child records untouched', async () => {
      const { child, decorated } = buildWideCollection(100);
      const childRecords = buildRecords(100);
      (child.list as jest.Mock).mockResolvedValue(childRecords);

      const records = await decorated.list(
        factories.caller.build(),
        new PaginatedFilter({}),
        buildProjection(100),
      );

      expect(records).toBe(childRecords);
    });

    describe('list with a binary column', () => {
      let childRecords: RecordData[];
      let records: RecordData[];

      beforeEach(async () => {
        const { child, decorated } = buildWideCollection(2, true);
        childRecords = buildRecords(2, true);
        (child.list as jest.Mock).mockResolvedValue(childRecords);

        records = await decorated.list(
          factories.caller.build(),
          new PaginatedFilter({}),
          buildProjection(2, true),
        );
      });

      test('should only convert the binary column', () => {
        expect(records[0]).toEqual({
          id: 0,
          card_id: 0,
          card: { id: 0, column0: 'value', column1: 'value' },
          column0: 'value',
          column1: 'value',
          file: 'data:application/octet-stream;base64,MDA=',
        });
      });

      test('should return the relations reaching no binary field untouched', () => {
        expect(records[0].card).toBe(childRecords[0].card);
      });
    });
  });
});
