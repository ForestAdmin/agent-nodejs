import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { ColumnType, DataSource, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import flattenJsonColumn from '../src/flatten-json-column';

const logger = () => {};

// Working around a bug from a decorator which rewrites search in filters
const filter = factories.filter.build({
  search: null as unknown as undefined,
  segment: null as unknown as undefined,
});
const caller = factories.caller.build();

describe('flattenJsonColumn', () => {
  let dataSource: DataSource;
  let customizer: DataSourceCustomizer;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'book',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            title: factories.columnSchema.build(),
            author: factories.columnSchema.build({
              columnType: 'Json',
            }),
          },
        }),
        create: jest.fn().mockImplementation((_, records) => Promise.resolve(records)),
      }),
    );

    customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () => dataSource);
  });

  it('should throw when used on the datasource', async () => {
    await expect(
      customizer
        .use(flattenJsonColumn, { columnName: 'myColumn', columnType: { name: 'String' } })
        .getDataSource(logger),
    ).rejects.toThrow('This plugin can only be called when customizing collections.');
  });

  it('should throw when option is not provided', async () => {
    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenJsonColumn))
        .getDataSource(logger),
    ).rejects.toThrow('options.columnName and options.columnType are required.');
  });

  it('should throw when target is not provided', async () => {
    const options = {} as { columnName: string; columnType: { [key: string]: ColumnType } };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenJsonColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow('options.columnName and options.columnType are required.');
  });

  it('should throw when target is a primitive type Json', async () => {
    const options = { columnName: 'title', columnType: {} } as {
      columnName: string;
      columnType: { [key: string]: ColumnType };
    };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenJsonColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow(
      "'book.title cannot be flattened' (only available on primitive JSON column) " +
        'prefer flattenColumn otherwise.',
    );
  });

  it('should throw when columnType is not an json object', async () => {
    const options = { columnName: 'author', columnType: {} };
    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenJsonColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow(
      'options.columnType must be defined as json object representing a subset of the shape of the data in the json column.',
    );
  });

  describe('when flattening a single level', () => {
    let decorated: DataSource;

    beforeEach(async () => {
      decorated = await customizer
        .customizeCollection('book', book =>
          book.use(flattenJsonColumn, {
            columnName: 'author',
            columnType: {
              name: 'String',
              address: { city: 'String' },
            },
            readonly: false,
            level: 1,
          }),
        )
        .getDataSource(logger);
    });

    it('should update the schema', async () => {
      const { fields } = decorated.getCollection('book').schema;

      expect(fields['author@@@name']).toMatchObject({ columnType: 'String' });
      expect(fields['author@@@address']).toMatchObject({ columnType: { city: 'String' } });
    });

    it('should work when listing data the flattened field is null', async () => {
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      baseList.mockResolvedValue([{ id: '1', title: 'The Lord of the Rings', author: null }]);

      const projection = new Projection('id', 'title', 'author@@@name', 'author@@@address');
      const records = await decorated.getCollection('book').list(caller, filter, projection);

      expect(records).toEqual([
        {
          id: '1',
          title: 'The Lord of the Rings',
          'author@@@name': null,
          'author@@@address': null,
        },
      ]);
    });

    it('should work when listing data if everything is set', async () => {
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      baseList.mockResolvedValue([
        {
          id: '1',
          author: { name: 'J.R.R. Tolkien', address: { city: 'New York' } },
        },
      ]);

      const projection = new Projection('id', 'title', 'author@@@name', 'author@@@address');
      const records = await decorated.getCollection('book').list(caller, filter, projection);

      expect(records).toEqual([
        {
          id: '1',
          'author@@@name': 'J.R.R. Tolkien',
          'author@@@address': { city: 'New York' },
        },
      ]);
    });

    it('should rewrite creation', async () => {
      const baseCreate = dataSource.getCollection('book').create as jest.Mock;

      await decorated.getCollection('book').create(caller, [
        { 'author@@@name': 'Tolkien', 'author@@@address': { city: 'New York' } },
        { 'author@@@name': 'Verne', 'author@@@address': { city: 'Paris' } },
      ]);

      expect(baseCreate).toHaveBeenCalledTimes(1);
      expect(baseCreate).toHaveBeenCalledWith(caller, [
        { author: { name: 'Tolkien', address: { city: 'New York' } } },
        { author: { name: 'Verne', address: { city: 'Paris' } } },
      ]);
    });

    it('should not list and call update only once when there is nothing to unflatten', async () => {
      // Here we test that the hook will delegate the update to the base collection
      // without calling list, and without rewriting the patch
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      const baseUpdate = dataSource.getCollection('book').update as jest.Mock;

      await decorated.getCollection('book').update(caller, filter, { title: 'new title' });

      expect(baseList).not.toHaveBeenCalled();
      expect(baseUpdate).toHaveBeenCalledTimes(1);
      expect(baseUpdate).toHaveBeenCalledWith(caller, filter, { title: 'new title' });
    });

    it('should delegate updates when possible when updating', async () => {
      // Here we test that the hook will delegate the update to the base collection
      // once it has unflattened the patch, calling list, and checked that the patch
      // is the same for all records.
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      const baseUpdate = dataSource.getCollection('book').update as jest.Mock;

      baseList.mockResolvedValue([
        { id: '1', title: 'The Lord of the Rings', author: { name: 'J.R.R. Tolkien' } },
        { id: '2', title: 'The two towers', author: null },
      ]);

      await decorated
        .getCollection('book')
        .update(caller, filter, { title: 'newTitle', 'author@@@name': 'Tolkien' });

      expect(baseList).toHaveBeenCalledTimes(1);
      expect(baseList).toHaveBeenCalledWith(caller, filter, new Projection('id', 'author'));

      expect(baseUpdate).toHaveBeenCalledTimes(1);
      expect(baseUpdate).toHaveBeenCalledWith(caller, filter, {
        title: 'newTitle',
        author: { name: 'Tolkien' },
      });
    });

    it('should call update as many times as needed when unflattening', async () => {
      // Here we test that the hook will NOT delegate the update to the base collection
      // when it sees that the patch is different for some records, but that it will
      // group the updates so that it calls update as few times as possible.
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      const baseUpdate = dataSource.getCollection('book').update as jest.Mock;

      baseList.mockResolvedValue([
        {
          id: '1',
          title: 'The fellowship of the ring',
          author: { name: 'J.R.R. Tolkien', address: { city: 'New York' } },
        },
        { id: '2', title: 'The two towers', author: null },
        { id: '3', title: 'The return of the king', author: null },
      ]);

      await decorated
        .getCollection('book')
        .update(caller, filter, { title: 'new title', 'author@@@name': 'Tolkien' });

      expect(baseList).toHaveBeenCalledTimes(1);
      expect(baseList).toHaveBeenCalledWith(caller, filter, new Projection('id', 'author'));

      expect(baseUpdate).toHaveBeenCalledTimes(3);

      // Normal update
      expect(baseUpdate).toHaveBeenCalledWith(caller, filter, { title: 'new title' });

      // Updates performed by the plugin
      expect(baseUpdate).toHaveBeenCalledWith(
        caller,
        // not sure why I need to specify search == null. It's related to a bug in a decorator.
        {
          conditionTree: { field: 'id', operator: 'Equal', value: '1' },
          search: null,
          segment: null,
        },
        { author: { name: 'Tolkien', address: { city: 'New York' } } },
      );
      expect(baseUpdate).toHaveBeenCalledWith(
        caller,
        {
          conditionTree: { field: 'id', operator: 'In', value: ['2', '3'] },
          search: null,
          segment: null,
        },
        { author: { name: 'Tolkien' } },
      );
    });
  });
});
