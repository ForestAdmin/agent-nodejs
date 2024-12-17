import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { DataSource, MissingColumnError, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import flattenColumn from '../src/flatten-column';

const logger = () => {};

// Working around a bug from a decorator which rewrites search in filters
const filter = factories.filter.build({
  search: null as unknown as undefined,
  segment: null as unknown as undefined,
  liveQuerySegment: null as unknown as undefined,
});
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
            meta: factories.columnSchema.build({ columnType: 'Json' }),
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

  it('should throw when target is not provided', async () => {
    const options = {} as { columnName: string };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow('options.columnName is required.');
  });

  it('should throw when target does not exists', async () => {
    const options = { columnName: 'doctor who?' };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow(MissingColumnError);
  });

  it('should throw when target is a primitive', async () => {
    const options = { columnName: 'title' };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow("'book.title' cannot be flattened (primitive type 'String' not supported).");
  });

  it('should throw when target is an array', async () => {
    const options = { columnName: 'tags' };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow("'book.tags' cannot be flattened (array not supported).");
  });

  it('should throw when target is a relation', async () => {
    const options = { columnName: 'myself' };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow(MissingColumnError);
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
    ).rejects.toThrow("'book.author' cannot be flattened (no fields match level/include/exclude).");
  });

  it('should throw when include has invalid column', async () => {
    const options = { columnName: 'author', include: ['missing'] };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow("Cannot add field 'author@@@missing' (dependency not found).");
  });

  it('should throw when using wrong flattener plugin', async () => {
    const options = { columnName: 'meta' };
    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow(
      "'book.meta' cannot be flattened using flattenColumn please use flattenJsonColumn.",
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
          liveQuerySegment: null,
        },
        { author: { name: 'Tolkien', address: { city: 'New York' } } },
      );
      expect(baseUpdate).toHaveBeenCalledWith(
        caller,
        {
          conditionTree: { field: 'id', operator: 'In', value: ['2', '3'] },
          search: null,
          segment: null,
          liveQuerySegment: null,
        },
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
