import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Aggregation, Page, PaginatedFilter, Projection } from '@forestadmin/datasource-toolkit';
import BookCollection from '../../src/collections/books';
import DummyDataSource from '../../src/datasource';

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

  describe('create', () => {
    it('should return the record data', async () => {
      const bookCollection = instanciateCollection();
      const [newRecord] = await bookCollection.create(factories.recipient.build(), [
        { id: undefined, title: 'Dune' },
      ]);

      expect(newRecord).toMatchObject({ id: 7, title: 'Dune' });
    });
  });

  describe('list', () => {
    it('should return all records', async () => {
      const bookCollection = instanciateCollection();
      const paginatedFilter = new PaginatedFilter({});
      const projection = new Projection();

      expect(
        await bookCollection.list(factories.recipient.build(), paginatedFilter, projection),
      ).toBeArrayOfSize(6);
    });

    it('should return a record list of size matching the paginated filter', async () => {
      const bookCollection = instanciateCollection();
      const expectedPageLimit = 3;
      const paginatedFilter = new PaginatedFilter({ page: new Page(0, expectedPageLimit) });
      const projection = new Projection();

      expect(
        await bookCollection.list(factories.recipient.build(), paginatedFilter, projection),
      ).toBeArrayOfSize(expectedPageLimit);
    });
  });

  describe('update', () => {
    it('should update books', async () => {
      const bookCollection = instanciateCollection();
      await bookCollection.update(null, null, { title: 'newTitle' });

      const paginatedFilter = new PaginatedFilter({});
      const projection = new Projection('title');
      const records = await bookCollection.list(
        factories.recipient.build(),
        paginatedFilter,
        projection,
      );

      expect(records[0].title).toEqual('newTitle');
    });
  });

  describe('delete', () => {
    it('should delete books', async () => {
      const bookCollection = instanciateCollection();
      await bookCollection.delete(null, null);

      const paginatedFilter = new PaginatedFilter({});
      const projection = new Projection();
      expect(
        await bookCollection.list(factories.recipient.build(), paginatedFilter, projection),
      ).toBeArrayOfSize(0);
    });
  });

  describe('aggregate', () => {
    it('should return rows matching the paginated filter', async () => {
      const bookCollection = instanciateCollection();
      const expectedPageLimit = 3;
      const paginatedFilter = new PaginatedFilter({ page: new Page(0, expectedPageLimit) });
      const aggregation = new Aggregation({
        operation: 'Count',
        groups: [{ field: 'title' }, { field: 'authorId' }],
      });

      expect(
        await bookCollection.aggregate(factories.recipient.build(), paginatedFilter, aggregation),
      ).toBeArrayOfSize(expectedPageLimit);
    });

    it('should return rows matching the aggregation groups', async () => {
      const bookCollection = instanciateCollection();
      const aggregation = new Aggregation({
        operation: 'Count',
        groups: [{ field: 'title' }, { field: 'authorId' }],
      });

      const rows = await bookCollection.aggregate(
        factories.recipient.build(),
        new PaginatedFilter({}),
        aggregation,
      );
      rows.map(row => expect(Object.keys(row.group)).toBeArrayOfSize(aggregation.groups.length));
    });
  });

  it('should resolve with a SuccessResponse', async () => {
    const bookCollection = instanciateCollection();

    await expect(bookCollection.execute()).resolves.toMatchObject({
      type: 'Success',
      message: 'Record set as active',
      format: 'text',
    });
  });
});
