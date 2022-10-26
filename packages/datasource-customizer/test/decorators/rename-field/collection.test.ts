import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import {
  Aggregation,
  Collection,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import RenameFieldCollectionDecorator from '../../../src/decorators/rename-field/collection';

describe('RenameFieldCollectionDecorator', () => {
  const caller = factories.caller.build();

  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<RenameFieldCollectionDecorator>;

  // Convenience: Direct access to collections before and after decoration
  let persons: Collection;
  let bookPersons: Collection;
  let books: Collection;

  let newPersons: RenameFieldCollectionDecorator;
  let newBookPersons: RenameFieldCollectionDecorator;
  let newBooks: RenameFieldCollectionDecorator;

  // Convenience: Direct access to persons mocks
  let personsList: jest.Mock;
  let personsCreate: jest.Mock;
  let personsUpdate: jest.Mock;
  let personsDelete: jest.Mock;
  let personsAggregate: jest.Mock;

  // Convenience: Valid filters for the un-decorated persons collection
  let personsFilter: Filter;
  let personsPaginatedFilter: PaginatedFilter;

  // Build datasource
  beforeEach(() => {
    persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          myBookPerson: factories.oneToOneSchema.build({
            foreignCollection: 'bookPersons',
            originKey: 'personId',
          }),
        },
      }),
    });

    bookPersons = factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          bookId: factories.columnSchema.uuidPrimaryKey().build(),
          personId: factories.columnSchema.uuidPrimaryKey().build(),
          myBook: factories.manyToOneSchema.build({
            foreignCollection: 'books',
            foreignKey: 'bookId',
          }),
          myPerson: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
          }),
          date: factories.columnSchema.build({ columnType: 'Date' }),
        },
      }),
    });

    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          myPersons: factories.manyToManySchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
            originKey: 'bookId',
            throughCollection: 'bookPersons',
          }),
          myBookPersons: factories.oneToManySchema.build({
            foreignCollection: 'bookPersons',
            originKey: 'bookId',
          }),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([persons, bookPersons, books]);
    personsList = persons.list as jest.Mock;
    personsCreate = persons.create as jest.Mock;
    personsUpdate = persons.update as jest.Mock;
    personsDelete = persons.delete as jest.Mock;
    personsAggregate = persons.aggregate as jest.Mock;
  });

  // Build decorator
  beforeEach(() => {
    decoratedDataSource = new DataSourceDecorator(dataSource, RenameFieldCollectionDecorator);

    newBooks = decoratedDataSource.getCollection('books');
    newBookPersons = decoratedDataSource.getCollection('bookPersons');
    newPersons = decoratedDataSource.getCollection('persons');
  });

  // Build filters for un-decorated persons
  beforeAll(() => {
    personsFilter = new Filter({
      conditionTree: new ConditionTreeBranch('And', [
        new ConditionTreeLeaf('id', 'NotEqual', 0),
        new ConditionTreeLeaf('myBookPerson:date', 'NotEqual', 0),
      ]),
    });

    personsPaginatedFilter = new PaginatedFilter({
      ...personsFilter,
      sort: new Sort(
        { field: 'id', ascending: false },
        { field: 'myBookPerson:date', ascending: true },
      ),
    });
  });

  test('should throw when renaming a field which does not exists', () => {
    expect(() => newPersons.renameField('unknown', 'somethingnew')).toThrow(
      `No such field 'unknown'`,
    );
  });

  test('should throw when renaming a field using an older name', () => {
    newPersons.renameField('id', 'key');
    expect(() => newPersons.renameField('id', 'primaryKey')).toThrow(`No such field 'id'`);
  });

  test('should allow renaming multiple times the same field', () => {
    newPersons.renameField('id', 'key');
    newPersons.renameField('key', 'primaryKey');
    newPersons.renameField('primaryKey', 'primaryId');
    newPersons.renameField('primaryId', 'id');

    // The schema should be the same than the original
    expect(newPersons.schema).toStrictEqual(persons.schema);
  });

  describe('when not renaming anything', () => {
    test('the schemas should be the same', () => {
      expect(newPersons.schema).toStrictEqual(persons.schema);
      expect(newBookPersons.schema).toStrictEqual(bookPersons.schema);
      expect(newBooks.schema).toStrictEqual(books.schema);
    });

    test('create should act as a pass-through', async () => {
      personsCreate.mockResolvedValue([{ id: '1' }]);

      const records = await newPersons.create(caller, [{ id: '1' }]);
      expect(persons.create).toHaveBeenCalledWith(caller, [{ id: '1' }]);
      expect(records).toStrictEqual([{ id: '1' }]);
    });

    test('list should act as a pass-through', async () => {
      const records = [{ id: '1', myBookPerson: { date: 'something' } }];
      const projection = new Projection('id', 'myBookPerson:date');

      personsList.mockResolvedValue(records);

      const result = await newPersons.list(caller, personsPaginatedFilter, projection);
      expect(personsList).toHaveBeenCalledWith(caller, personsPaginatedFilter, projection);
      expect(result).toStrictEqual(records);
    });

    test('update should act as a pass-through', async () => {
      await newPersons.update(caller, personsFilter, { id: '55' });
      expect(personsUpdate).toHaveBeenCalledWith(caller, personsFilter, {
        id: '55',
      });
    });

    test('delete should act as a pass-through', async () => {
      await newPersons.delete(caller, personsFilter);
      expect(personsDelete).toHaveBeenCalledWith(caller, personsFilter);
    });

    test('aggregate should act as a pass-through', async () => {
      const result = [{ value: 34, group: { 'myBookPerson:date': 'abc' } }];
      const aggregate = new Aggregation({ operation: 'Count' });

      personsAggregate.mockResolvedValue(result);

      const rows = await newPersons.aggregate(caller, personsPaginatedFilter, aggregate, null);
      expect(persons.aggregate).toHaveBeenCalledWith(
        caller,
        personsPaginatedFilter,
        aggregate,
        null,
      );
      expect(rows).toStrictEqual(result);
    });
  });

  describe('when renaming columns and relations', () => {
    // Convenience: equivalent filters for the collection after renaming stuff
    let newPersonsFilter: Filter;
    let newPersonsPaginatedFilter: PaginatedFilter;

    // Rename stuff
    beforeEach(() => {
      // Cache the schemas to ensure they refresh property
      void newBooks.schema;
      void newBookPersons.schema;
      void newPersons.schema;

      // Rename stuff
      newPersons.renameField('id', 'primaryKey');
      newPersons.renameField('myBookPerson', 'myNovelAuthor');
      newBookPersons.renameField('date', 'createdAt');
    });

    // Build filters for decorated persons
    beforeAll(() => {
      newPersonsFilter = new Filter({
        conditionTree: new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('primaryKey', 'NotEqual', 0),
          new ConditionTreeLeaf('myNovelAuthor:createdAt', 'NotEqual', 0),
        ]),
      });

      newPersonsPaginatedFilter = new PaginatedFilter({
        ...newPersonsFilter,
        sort: new Sort(
          { field: 'primaryKey', ascending: false },
          { field: 'myNovelAuthor:createdAt', ascending: true },
        ),
      });
    });

    test('the schemas should be updated', () => {
      const { fields } = newPersons.schema;

      expect(fields.primaryKey).toMatchObject({ isPrimaryKey: true });
      expect(fields.id).toBeUndefined();

      expect(fields.myNovelAuthor).toMatchObject({ type: 'OneToOne' });
      expect(fields.myBookPerson).toBeUndefined();
    });

    test('create should rewrite the records', async () => {
      personsCreate.mockResolvedValue([{ id: '1' }]);

      const records = await newPersons.create(caller, [{ primaryKey: '1' }]);
      expect(persons.create).toHaveBeenCalledWith(caller, [{ id: '1' }]);
      expect(records).toStrictEqual([{ primaryKey: '1' }]);
    });

    test('list should rewrite the filter, projection and record', async () => {
      const projection = new Projection('primaryKey', 'myNovelAuthor:createdAt');
      const expectedProjection = new Projection('id', 'myBookPerson:date');

      personsList.mockResolvedValue([{ id: '1', myBookPerson: { date: 'something' } }]);

      const records = await newPersons.list(caller, newPersonsPaginatedFilter, projection);
      expect(personsList).toHaveBeenCalledWith(caller, personsPaginatedFilter, expectedProjection);
      expect(records).toStrictEqual([
        { primaryKey: '1', myNovelAuthor: { createdAt: 'something' } },
      ]);
    });

    test('list should rewrite the record with null relations', async () => {
      personsList.mockResolvedValue([{ id: '1', myBookPerson: null }]);

      const records = await newPersons.list(
        caller,
        null,
        new Projection('primaryKey', 'myNovelAuthor:createdAt'),
      );
      expect(records).toStrictEqual([{ primaryKey: '1', myNovelAuthor: null }]);
    });

    test('update should rewrite the filter and patch', async () => {
      await newPersons.update(caller, newPersonsFilter, { primaryKey: '55' });
      expect(personsUpdate).toHaveBeenCalledWith(caller, personsFilter, {
        id: '55',
      });
    });

    test('delete should rewrite the filter', async () => {
      await newPersons.delete(caller, newPersonsFilter);
      expect(personsDelete).toHaveBeenCalledWith(caller, personsFilter);
    });

    test('aggregate should rewrite the filter and the result', async () => {
      personsAggregate.mockResolvedValue([{ value: 34, group: { 'myBookPerson:date': 'abc' } }]);

      const result = await newPersons.aggregate(
        caller,

        newPersonsPaginatedFilter,
        new Aggregation({
          operation: 'Sum',
          field: 'primaryKey',
          groups: [{ field: 'myNovelAuthor:createdAt' }],
        }),
        null,
      );

      expect(persons.aggregate).toHaveBeenCalledWith(
        caller,
        personsPaginatedFilter,
        {
          operation: 'Sum',
          field: 'id',
          groups: [{ field: 'myBookPerson:date' }],
        },
        null,
      );
      expect(result).toStrictEqual([{ value: 34, group: { 'myNovelAuthor:createdAt': 'abc' } }]);
    });
  });

  describe('when renaming foreign keys', () => {
    beforeEach(() => {
      // Cache the schemas to ensure they refresh property
      void newBooks.schema;
      void newBookPersons.schema;
      void newPersons.schema;

      // Rename stuff
      newBookPersons.renameField('bookId', 'novelId');
      newBookPersons.renameField('personId', 'authorId');
    });

    test('the columns should be renamed in the schema', () => {
      const { fields } = newBookPersons.schema;

      expect(fields.authorId).toMatchObject({ type: 'Column' });
      expect(fields.novelId).toMatchObject({ type: 'Column' });
      expect(fields.personId).toBeUndefined();
      expect(fields.bookId).toBeUndefined();
    });

    test('the relations should be updated in all collections', () => {
      const bookFields = newBooks.schema.fields;
      const bookPersonFields = newBookPersons.schema.fields;
      const personFields = newPersons.schema.fields;

      expect(bookFields.myPersons).toMatchObject({ foreignKey: 'authorId', originKey: 'novelId' });
      expect(bookFields.myBookPersons).toMatchObject({ originKey: 'novelId' });
      expect(bookPersonFields.myBook).toMatchObject({ foreignKey: 'novelId' });
      expect(bookPersonFields.myPerson).toMatchObject({ foreignKey: 'authorId' });
      expect(personFields.myBookPerson).toMatchObject({ originKey: 'authorId' });
    });
  });
});
