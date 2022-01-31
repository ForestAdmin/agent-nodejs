import {
  Aggregation,
  AggregationOperation,
  Page,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import BookCollection from '../../dist/collections/books';
import DummyDataSource from '../../dist/datasource';

const instanciateCollection = () => new BookCollection(new DummyDataSource());

describe('DummyDataSource > Collections > Books', () => {
  it('should instanciate properly', () => {
    expect(instanciateCollection()).toBeDefined();
  });

  describe('dataSource', () => {
    it('should return the dataSource', () => {
      const dataSource = new DummyDataSource();
      const bookCollection = new BookCollection(dataSource);

      expect(bookCollection.dataSource).toEqual(dataSource);
    });
  });

  describe('name', () => {
    it('should return the collection name', () => {
      const bookCollection = instanciateCollection();

      expect(bookCollection.name).toEqual('books');
    });
  });

  describe('schema', () => {
    it('should return the schema', () => {
      const bookCollection = instanciateCollection();

      expect(bookCollection.schema).toBeDefined();
    });
  });

  describe('getById', () => {
    it('should return a record with a proper ID and projection', async () => {
      const bookCollection = instanciateCollection();

      expect(await bookCollection.getById([42], new Projection('id', 'title'))).toEqual(
        expect.objectContaining({
          id: expect.toBeNumber(),
          title: expect.toBeString(),
        }),
      );
    });

    describe('with an invalid projection', () => {
      it('should throw an error with an unknown field', async () => {
        const bookCollection = instanciateCollection();
        const unknownField = '__no_such_field__';

        await expect(() =>
          bookCollection.getById([42], new Projection(unknownField)),
        ).rejects.toThrow(`No such field "${unknownField}" in schema`);
      });
    });
  });

  describe('create', () => {
    it('should return the record data', async () => {
      const bookCollection = instanciateCollection();
      const data = [{ name: Symbol('name') }];

      expect(await bookCollection.create(data)).toMatchObject(data);
    });
  });

  describe('list', () => {
    it('should return a default 10 record list', async () => {
      const bookCollection = instanciateCollection();
      const paginatedFilter = new PaginatedFilter({});
      const projection = new Projection();

      expect(await bookCollection.list(paginatedFilter, projection)).toBeArrayOfSize(10);
    });

    it('should return a record list of size matching the paginated filter', async () => {
      const bookCollection = instanciateCollection();
      const expectedPageLimit = 42;
      const paginatedFilter = new PaginatedFilter({ page: new Page(0, expectedPageLimit) });
      const projection = new Projection();

      expect(await bookCollection.list(paginatedFilter, projection)).toBeArrayOfSize(
        expectedPageLimit,
      );
    });
  });

  describe('update', () => {
    it('should do nothing', async () => {
      const bookCollection = instanciateCollection();

      expect(await bookCollection.update(null, {})).toBe(undefined);
    });
  });

  describe('delete', () => {
    it('should do nothing', async () => {
      const bookCollection = instanciateCollection();

      expect(await bookCollection.delete(null)).toBe(undefined);
    });
  });

  describe('aggregate', () => {
    it('should return rows matching the paginated filter', async () => {
      const bookCollection = instanciateCollection();
      const expectedPageLimit = 42;
      const paginatedFilter = new PaginatedFilter({ page: new Page(0, expectedPageLimit) });
      const aggregation = new Aggregation({
        operation: AggregationOperation.Count,
        groups: [{ field: 'title' }, { field: 'authorId' }],
      });

      expect(await bookCollection.aggregate(paginatedFilter, aggregation)).toBeArrayOfSize(
        expectedPageLimit,
      );
    });

    it('should return rows matching the aggregation groups', async () => {
      const bookCollection = instanciateCollection();
      const aggregation = new Aggregation({
        operation: AggregationOperation.Count,
        groups: [{ field: 'title' }, { field: 'authorId' }],
      });

      const rows = await bookCollection.aggregate(null, aggregation);
      rows.map(row => expect(Object.keys(row.group)).toBeArrayOfSize(aggregation.groups.length));
    });
  });
});
