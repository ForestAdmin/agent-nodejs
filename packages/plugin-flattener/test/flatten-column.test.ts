import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { DataSource, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import flattenColumn from '../src/flatten-column';

const logger = () => {};

// Working around a bug from a decorator which rewrites search in filters
const filter = factories.filter.build({ search: null as unknown as undefined });
const caller = factories.caller.build();

describe('flattenColumn', () => {
  let dataSource: DataSource;
  let customizer: DataSourceCustomizer;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'book',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myself: factories.manyToOneSchema.build({
              foreignCollection: 'book',
              foreignKey: 'id',
              foreignKeyTarget: 'id',
            }),
            title: factories.columnSchema.build(),
            tags: factories.columnSchema.build({ columnType: ['String'] }),
            author: factories.columnSchema.build({
              columnType: {
                name: 'String',
                address: { city: 'String' },
              },
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
    const options = { columnName: 'myColumn' };

    await expect(customizer.use(flattenColumn, options).getDataSource(logger)).rejects.toThrow(
      'This plugin can only be called when customizing collections.',
    );
  });

  it('should throw when option is not provided', async () => {
    await expect(
      customizer.customizeCollection('book', book => book.use(flattenColumn)).getDataSource(logger),
    ).rejects.toThrow('options.columnName is required.');
  });

  it('should throw when target is missing', async () => {
    const options = {} as { columnName: string };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow('options.columnName is required.');
  });

  it('should throw when target is a primitive', async () => {
    const options = { columnName: 'title' };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow("'book.title' cannot be flattened' (primitive).");
  });

  it('should throw when target is an array', async () => {
    const options = { columnName: 'tags' };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow("'book.tags' cannot be flattened' (array).");
  });

  it('should throw when target is a relation', async () => {
    const options = { columnName: 'myself' };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow("'book.myself' cannot be flattened' (not a column).");
  });

  it('should throw level is invalid', async () => {
    const options = { columnName: 'author', level: -1 };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow('options.level must be greater than 0.');
  });

  it('should throw when no subcolumn match the provided rules', async () => {
    const options = { columnName: 'author', level: 2, exclude: ['name', 'address:city'] };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow(
      "'book.author' cannot be flattened' (no fields match level/include/exclude).",
    );
  });

  describe('when flattening a single level', () => {
    let decorated: DataSource;

    beforeEach(async () => {
      const options = { columnName: 'author' };
      decorated = await customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
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
          title: 'The Lord of the Rings',
          author: { name: 'J.R.R. Tolkien', address: { city: 'New York' } },
        },
      ]);

      const projection = new Projection('id', 'title', 'author@@@name', 'author@@@address');
      const records = await decorated.getCollection('book').list(caller, filter, projection);

      expect(records).toEqual([
        {
          id: '1',
          title: 'The Lord of the Rings',
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
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      const baseUpdate = dataSource.getCollection('book').update as jest.Mock;

      await decorated.getCollection('book').update(caller, filter, { title: 'new title' });

      expect(baseList).not.toHaveBeenCalled();
      expect(baseUpdate).toHaveBeenCalledTimes(1);
      expect(baseUpdate).toHaveBeenCalledWith(caller, filter, { title: 'new title' });
    });

    it('should call update as many times as needed when unflattening', async () => {
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      const baseUpdate = dataSource.getCollection('book').update as jest.Mock;

      baseList.mockResolvedValue([
        {
          id: '1',
          title: 'The Lord of the Rings',
          author: { name: 'J.R.R. Tolkien', address: { city: 'New York' } },
        },
        { id: '2', title: 'The two towers', author: null },
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
        { conditionTree: { field: 'id', operator: 'Equal', value: '1' }, search: null },
        { author: { name: 'Tolkien', address: { city: 'New York' } } },
      );
      expect(baseUpdate).toHaveBeenCalledWith(
        caller,
        { conditionTree: { field: 'id', operator: 'Equal', value: '2' }, search: null },
        { author: { name: 'Tolkien' } },
      );
    });

    it('should group updates when possible when updating', async () => {
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      const baseUpdate = dataSource.getCollection('book').update as jest.Mock;

      baseList.mockResolvedValue([
        { id: '1', title: 'The Lord of the Rings', author: { name: 'J.R.R. Tolkien' } },
        { id: '2', title: 'The two towers', author: null },
      ]);

      await decorated.getCollection('book').update(caller, filter, { 'author@@@name': 'Tolkien' });

      expect(baseList).toHaveBeenCalledTimes(1);
      expect(baseList).toHaveBeenCalledWith(caller, filter, new Projection('id', 'author'));

      expect(baseUpdate).toHaveBeenCalledTimes(1);
      expect(baseUpdate).toHaveBeenCalledWith(
        caller,
        { conditionTree: { field: 'id', operator: 'In', value: ['1', '2'] }, search: null },
        { author: { name: 'Tolkien' } },
      );
    });
  });

  describe('when flattening recursively', () => {
    it('flatten two levels when no include/exclude is provided', async () => {
      const options = { columnName: 'author', level: 2 };
      const decoratedDataSource = await customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger);

      const { fields } = decoratedDataSource.getCollection('book').schema;
      expect(fields).toHaveProperty('author@@@name');
      expect(fields).toHaveProperty('author@@@address@@@city');
    });

    it('flatten two levels when include is provided', async () => {
      const options = { columnName: 'author', include: ['name', 'address:city'] };
      const decoratedDataSource = await customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger);

      const { fields } = decoratedDataSource.getCollection('book').schema;
      expect(fields).toHaveProperty('author@@@name');
      expect(fields).toHaveProperty('author@@@address@@@city');
    });

    it('flatten fields specified by include/exclude rules', async () => {
      const options = {
        columnName: 'author',
        include: ['name', 'address:city'],
        exclude: ['name'],
      };

      const decoratedDataSource = await customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger);

      const { fields } = decoratedDataSource.getCollection('book').schema;
      expect(fields).not.toHaveProperty('author@@@name');
      expect(fields).toHaveProperty('author@@@address@@@city');
    });
  });
});
