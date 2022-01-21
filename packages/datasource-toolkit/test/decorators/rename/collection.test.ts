import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import RenameCollectionDecorator from '../../../src/decorators/rename/collection';
import { Collection, DataSource } from '../../../src/interfaces/collection';
import { AggregationOperation } from '../../../src/interfaces/query/aggregation';
import {
  Aggregator,
  Filter,
  Operator,
  PaginatedFilter,
} from '../../../src/interfaces/query/selection';
import { FieldTypes, PrimitiveTypes } from '../../../src/interfaces/schema';
import * as factories from '../../__factories__';

describe('RenameCollectionDecorator', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<RenameCollectionDecorator>;

  // Convenience: Direct access to collections before and after decoration
  let persons: Collection;
  let bookPersons: Collection;
  let books: Collection;

  let newPersons: RenameCollectionDecorator;
  let newBookPersons: RenameCollectionDecorator;
  let newBooks: RenameCollectionDecorator;

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
          id: factories.columnSchema.build({ isPrimaryKey: true }),
          myBookPerson: factories.oneToOneSchema.build({
            foreignCollection: 'bookPersons',
            foreignKey: 'personId',
          }),
        },
      }),
    });

    bookPersons = factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          bookId: factories.columnSchema.build({ isPrimaryKey: true }),
          personId: factories.columnSchema.build({ isPrimaryKey: true }),
          myBook: factories.manyToOneSchema.build({
            foreignCollection: 'books',
            foreignKey: 'bookId',
          }),
          myPerson: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
          }),
          date: factories.columnSchema.build({ columnType: PrimitiveTypes.Date }),
        },
      }),
    });

    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ isPrimaryKey: true }),
          myPersons: factories.manyToManySchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
            otherField: 'bookId',
            throughCollection: 'bookPersons',
          }),
          myBookPersons: factories.oneToManySchema.build({
            foreignCollection: 'bookPersons',
            foreignKey: 'bookId',
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
    decoratedDataSource = new DataSourceDecorator(dataSource, RenameCollectionDecorator);

    newBooks = decoratedDataSource.getCollection('books');
    newBookPersons = decoratedDataSource.getCollection('bookPersons');
    newPersons = decoratedDataSource.getCollection('persons');
  });

  // Build filters for un-decorated persons
  beforeAll(() => {
    personsFilter = {
      conditionTree: {
        aggregator: Aggregator.And,
        conditions: [
          { field: 'id', operator: Operator.NotEqual, value: 0 },
          { field: 'myBookPerson:date', operator: Operator.NotEqual, value: 0 },
        ],
      },
    };

    personsPaginatedFilter = {
      ...personsFilter,
      sort: [
        { field: 'id', ascending: false },
        { field: 'myBookPerson:date', ascending: true },
      ],
    };
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

      const records = await newPersons.create([{ id: '1' }]);
      expect(persons.create).toHaveBeenCalledWith([{ id: '1' }]);
      expect(records).toStrictEqual([{ id: '1' }]);
    });

    test('list should act as a pass-through', async () => {
      const records = [{ id: '1', myBookPerson: { date: 'something' } }];
      personsList.mockResolvedValue(records);

      const result = await newPersons.list(personsPaginatedFilter, ['id', 'myBookPerson:date']);
      expect(personsList).toHaveBeenCalledWith(personsPaginatedFilter, ['id', 'myBookPerson:date']);
      expect(result).toStrictEqual(records);
    });

    test('update should act as a pass-through', async () => {
      await newPersons.update(personsFilter, { id: '55' });
      expect(personsUpdate).toHaveBeenCalledWith(personsFilter, { id: '55' });
    });

    test('delete should act as a pass-through', async () => {
      await newPersons.delete(personsFilter);
      expect(personsDelete).toHaveBeenCalledWith(personsFilter);
    });

    test('aggregate should act as a pass-through', async () => {
      const result = [{ value: 34, group: { 'myBookPerson:date': 'abc' } }];
      const aggregate = { operation: AggregationOperation.Count };

      personsAggregate.mockResolvedValue(result);

      const rows = await newPersons.aggregate(personsPaginatedFilter, aggregate);
      expect(persons.aggregate).toHaveBeenCalledWith(personsPaginatedFilter, aggregate);
      expect(rows).toStrictEqual(result);
    });
  });

  describe('when renaming columns and relations', () => {
    // Convenience: equivalent filters for the collection after renaming stuff
    let newPersonsFilter: Filter;
    let newPersonsPaginatedFilter: PaginatedFilter;

    // Rename stuff
    beforeEach(() => {
      newPersons.renameField('id', 'primaryKey');
      newPersons.renameField('myBookPerson', 'myNovelAuthor');
      newBookPersons.renameField('date', 'createdAt');
    });

    // Build filters for decorated persons
    beforeAll(() => {
      newPersonsFilter = {
        conditionTree: {
          aggregator: Aggregator.And,
          conditions: [
            { field: 'primaryKey', operator: Operator.NotEqual, value: 0 },
            { field: 'myNovelAuthor:createdAt', operator: Operator.NotEqual, value: 0 },
          ],
        },
      };

      newPersonsPaginatedFilter = {
        ...newPersonsFilter,
        sort: [
          { field: 'primaryKey', ascending: false },
          { field: 'myNovelAuthor:createdAt', ascending: true },
        ],
      };
    });

    test('the schemas should be updated', () => {
      const { fields } = newPersons.schema;

      expect(fields.primaryKey).toMatchObject({ isPrimaryKey: true });
      expect(fields.id).toBeUndefined();

      expect(fields.myNovelAuthor).toMatchObject({ type: FieldTypes.OneToOne });
      expect(fields.myBookPerson).toBeUndefined();
    });

    test('create should rewrite the records', async () => {
      personsCreate.mockResolvedValue([{ id: '1' }]);

      const records = await newPersons.create([{ primaryKey: '1' }]);
      expect(persons.create).toHaveBeenCalledWith([{ id: '1' }]);
      expect(records).toStrictEqual([{ primaryKey: '1' }]);
    });

    test('list should rewrite the filter, projection and record', async () => {
      const projection = ['primaryKey', 'myNovelAuthor:createdAt'];
      const expectedProjection = ['id', 'myBookPerson:date'];

      personsList.mockResolvedValue([{ id: '1', myBookPerson: { date: 'something' } }]);

      const records = await newPersons.list(newPersonsPaginatedFilter, projection);
      expect(personsList).toHaveBeenCalledWith(personsPaginatedFilter, expectedProjection);
      expect(records).toStrictEqual([
        { primaryKey: '1', myNovelAuthor: { createdAt: 'something' } },
      ]);
    });

    test('list should rewrite the record with null relations', async () => {
      personsList.mockResolvedValue([{ id: '1', myBookPerson: null }]);

      const records = await newPersons.list({}, ['primaryKey', 'myNovelAuthor:createdAt']);
      expect(records).toStrictEqual([{ primaryKey: '1', myNovelAuthor: null }]);
    });

    test('update should rewrite the filter and patch', async () => {
      await newPersons.update(newPersonsFilter, { primaryKey: '55' });
      expect(personsUpdate).toHaveBeenCalledWith(personsFilter, { id: '55' });
    });

    test('delete should rewrite the filter', async () => {
      await newPersons.delete(newPersonsFilter);
      expect(personsDelete).toHaveBeenCalledWith(personsFilter);
    });

    test('aggregate should rewrite the filter and the result', async () => {
      personsAggregate.mockResolvedValue([{ value: 34, group: { 'myBookPerson:date': 'abc' } }]);

      const result = await newPersons.aggregate(newPersonsPaginatedFilter, {
        operation: AggregationOperation.Sum,
        field: 'primaryKey',
        groups: [{ field: 'myNovelAuthor:createdAt' }],
      });

      expect(persons.aggregate).toHaveBeenCalledWith(personsPaginatedFilter, {
        operation: AggregationOperation.Sum,
        field: 'id',
        groups: [{ field: 'myBookPerson:date' }],
      });
      expect(result).toStrictEqual([{ value: 34, group: { 'myNovelAuthor:createdAt': 'abc' } }]);
    });
  });

  describe('when renaming foreign keys', () => {
    beforeEach(() => {
      newBookPersons.renameField('bookId', 'novelId');
      newBookPersons.renameField('personId', 'authorId');
    });

    test('the columns should be renamed in the schema', () => {
      const { fields } = newBookPersons.schema;

      expect(fields.authorId).toMatchObject({ type: FieldTypes.Column });
      expect(fields.novelId).toMatchObject({ type: FieldTypes.Column });
      expect(fields.personId).toBeUndefined();
      expect(fields.bookId).toBeUndefined();
    });

    test('the relations should be updated in all collections', () => {
      const bookFields = newBooks.schema.fields;
      const bookPersonFields = newBookPersons.schema.fields;
      const personFields = newPersons.schema.fields;

      expect(bookFields.myPersons).toMatchObject({ foreignKey: 'authorId', otherField: 'novelId' });
      expect(bookFields.myBookPersons).toMatchObject({ foreignKey: 'novelId' });
      expect(bookPersonFields.myBook).toMatchObject({ foreignKey: 'novelId' });
      expect(bookPersonFields.myPerson).toMatchObject({ foreignKey: 'authorId' });
      expect(personFields.myBookPerson).toMatchObject({ foreignKey: 'authorId' });
    });
  });
});
