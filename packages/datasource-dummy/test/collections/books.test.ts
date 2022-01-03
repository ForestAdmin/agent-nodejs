import { AggregationOperation, ColumnSchema } from '@forestadmin/datasource-toolkit';
import MarkAsLiveAction from '../../src/actions/mark-as-live';
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

      expect(bookCollection.name).toEqual('book');
    });
  });

  describe('schema', () => {
    it('should return the schema', () => {
      const bookCollection = instanciateCollection();

      expect(bookCollection.schema).toBeDefined();
    });
  });

  describe('getAction', () => {
    it('should return a known action', () => {
      const bookCollection = instanciateCollection();

      expect(bookCollection.getAction('Mark as Live')).toBeInstanceOf(MarkAsLiveAction);
    });

    it('should thrown with an unknown action name', () => {
      const bookCollection = instanciateCollection();

      expect(() => bookCollection.getAction('__no_such_action__')).toThrow('Action not found.');
    });
  });

  describe('getById', () => {
    it('should return a record with a proper ID and projection', async () => {
      const bookCollection = instanciateCollection();

      expect(await bookCollection.getById([42], ['id', 'title'])).toEqual(
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

        await expect(() => bookCollection.getById([42], [unknownField])).rejects.toThrow(
          `No such field "${unknownField}" in schema`,
        );
      });

      it('should throw an error with an unsupported primitive type', async () => {
        const bookCollection = instanciateCollection();
        const unsupportedField = 'publication';

        const expectedUnsupportedFieldColumnType = (
          bookCollection.schema.fields[unsupportedField] as ColumnSchema
        ).columnType;

        // Date type not supported by `BookCollection.makeRecord`.
        await expect(() => bookCollection.getById([42], [unsupportedField])).rejects.toThrow(
          `Unsupported primitive: ${expectedUnsupportedFieldColumnType}`,
        );
      });

      it('should throw an error with an unsupported field type', async () => {
        const bookCollection = instanciateCollection();
        const unsupportedField = 'publisher';

        const expectedUnsupportedFieldColumnType = (
          bookCollection.schema.fields[unsupportedField] as ColumnSchema
        ).type;

        // ManyToOne relationship not supported by `BookCollection.makeRecord`.
        await expect(() => bookCollection.getById([42], [unsupportedField])).rejects.toThrow(
          `Unsupported field type: ${expectedUnsupportedFieldColumnType}`,
        );
      });
    });
  });

  describe('create', () => {
    it('should return the record data', async () => {
      const bookCollection = instanciateCollection();
      const data = [{ name: Symbol('name') }];

      expect(await bookCollection.create(data)).toBe(data);
    });
  });

  describe('list', () => {
    it('should return a default 10 record list', async () => {
      const bookCollection = instanciateCollection();
      const paginatedFilter = {};
      const projection = [];

      expect(await bookCollection.list(paginatedFilter, projection)).toBeArrayOfSize(10);
    });

    it('should return a record list of size matching the paginated filter', async () => {
      const bookCollection = instanciateCollection();
      const expectedPageLimit = 42;
      const paginatedFilter = { page: { limit: expectedPageLimit } };
      const projection = [];

      expect(await bookCollection.list(paginatedFilter, projection)).toBeArrayOfSize(
        expectedPageLimit,
      );
    });
  });

  describe('update', () => {
    it('should do nothing', async () => {
      const bookCollection = instanciateCollection();

      expect(await bookCollection.update({}, {})).toBe(undefined);
    });
  });

  describe('delete', () => {
    it('should do nothing', async () => {
      const bookCollection = instanciateCollection();

      expect(await bookCollection.delete({})).toBe(undefined);
    });
  });

  describe('aggregate', () => {
    it('should return rows matching the paginated filter', async () => {
      const bookCollection = instanciateCollection();
      const expectedPageLimit = 42;
      const paginatedFilter = { page: { limit: expectedPageLimit } };
      const aggregation = {
        operation: AggregationOperation.Count,
        groups: [{ field: 'title' }, { field: 'authorId' }],
      };

      expect(await bookCollection.aggregate(paginatedFilter, aggregation)).toBeArrayOfSize(
        expectedPageLimit,
      );
    });

    it('should return rows matching the aggregation groups', async () => {
      const bookCollection = instanciateCollection();
      const aggregation = {
        operation: AggregationOperation.Count,
        groups: [{ field: 'title' }, { field: 'authorId' }],
      };

      const rows = await bookCollection.aggregate({}, aggregation);
      rows.map(row => expect(Object.keys(row.group)).toBeArrayOfSize(aggregation.groups.length));
    });
  });
});
