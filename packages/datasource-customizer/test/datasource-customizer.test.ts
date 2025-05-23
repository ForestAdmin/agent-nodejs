import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import CollectionCustomizer from '../src/collection-customizer';
import DataSourceCustomizer from '../src/datasource-customizer';

const mockReadFile = jest.fn().mockResolvedValue(null);
const mockWriteFile = jest.fn().mockResolvedValue(null);

jest.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

beforeEach(() => {
  // we should actually reset all mocks, but only those are used multiple times
  mockReadFile.mockReset();
  mockWriteFile.mockReset();
});

describe('DataSourceCustomizer', () => {
  const logger = () => {};

  it('schema should proxy the call to the datasource', async () => {
    const customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () =>
      factories.dataSource.build({ schema: { charts: ['foo'] } }),
    );

    await customizer.getDataSource(logger);
    expect(customizer.schema).toStrictEqual({ charts: ['foo'] });
  });

  it('collections should return an array of collection customizers', async () => {
    const customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () =>
      factories.dataSource.buildWithCollection(factories.collection.build({ name: 'foo' })),
    );

    await customizer.getDataSource(logger);
    expect(customizer.collections).toHaveLength(1);
    expect(customizer.collections[0]).toBeInstanceOf(CollectionCustomizer);
  });

  describe('getFactory', () => {
    it('should return a factory with customization applied', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () =>
        factories.dataSource.buildWithCollection(factories.collection.build({ name: 'foo' })),
      );

      const factory = customizer.getFactory();
      expect(factory).toBeInstanceOf(Function);

      const dataSource = await factory(logger, jest.fn());
      expect(dataSource.schema).toStrictEqual({ charts: [] });
      expect(dataSource.collections).toHaveLength(1);
      expect(dataSource.collections[0].name).toBe('foo');
    });
  });

  describe('addChart', () => {
    it('should add the chart to the schema', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = await customizer
        .addChart('myChart', (context, resultBuilder) => resultBuilder.value(12332, 3224))
        .getDataSource(logger);

      // Check that the chart was added to the datasource
      expect(dataSource.schema.charts).toContain('myChart');
      await expect(
        dataSource.renderChart(factories.caller.build(), 'myChart'),
      ).resolves.toStrictEqual({
        countCurrent: 12332,
        countPrevious: 3224,
      });
    });
  });

  describe('customizeCollection', () => {
    it('should throw an error when designed collection is unknown', async () => {
      const customizer = new DataSourceCustomizer();

      await expect(
        customizer
          .customizeCollection('unknown', collection => {
            collection.disableCount();
          })
          .getDataSource(logger),
      ).rejects.toThrow("Collection 'unknown' not found");
    });

    it('should provide collection customizer otherwise', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );

      const handle = jest.fn();

      await customizer
        .addDataSource(async () => dataSource)
        .customizeCollection('collection', handle)
        .getDataSource(logger);

      expect(handle).toHaveBeenCalledTimes(1);
      expect(handle).toHaveBeenCalledWith(expect.objectContaining({ name: 'collection' }));
    });
  });

  describe('removeCollection', () => {
    it('should work', async () => {
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );

      const customized = await new DataSourceCustomizer()
        .addDataSource(async () => dataSource)
        .removeCollection('collection')
        .getDataSource(logger);

      expect(customized.collections).toHaveLength(0);
    });
  });

  describe('addDataSource', () => {
    it('should throw when renaming an unknown collection', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource1 = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      const dataSource2 = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      customizer.addDataSource(async () => dataSource1);
      customizer.addDataSource(async () => dataSource2, { rename: { missing: 'updatedName' } });

      await expect(customizer.getDataSource(logger)).rejects.toThrow(
        'dsmock: "missing" does not exist',
      );
    });

    it('should throw when renaming to an existing collection', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({ name: 'collection' }),
        factories.collection.build({ name: 'otherCollection' }),
      ]);
      customizer.addDataSource(async () => dataSource, {
        rename: { otherCollection: 'collection' },
      });

      await expect(customizer.getDataSource(logger)).rejects.toThrow(
        'The given new collection name "collection" is already defined',
      );
    });

    it('should rename a collection without errors', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource1 = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      const dataSource2 = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      customizer.addDataSource(async () => dataSource1);
      customizer.addDataSource(async () => dataSource2, { rename: { collection: 'updatedName' } });

      await expect(customizer.getDataSource(logger)).resolves.not.toThrow();
    });

    it('should hide collections', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({ name: 'collection1' }),
        factories.collection.build({ name: 'collection2' }),
      ]);

      customizer.addDataSource(async () => dataSource, { exclude: ['collection1'] });

      const result = await customizer.getDataSource(logger);
      expect(result.collections).toHaveLength(1);
    });

    it('should not throw an error when rename option is null', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      customizer.addDataSource(async () => dataSource, { rename: null as unknown as undefined });

      await expect(customizer.getDataSource(logger)).resolves.not.toThrow();
    });
  });

  describe('use', () => {
    it('should add a plugin', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () =>
        factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        ),
      );

      const plugin = jest.fn();
      customizer.use(plugin, { myOptions: 1 });
      await customizer.getDataSource(logger);

      expect(plugin).toHaveBeenCalledTimes(1);
      expect(plugin).toHaveBeenCalledWith(customizer, null, { myOptions: 1 });
    });
  });

  describe('getDataSource', () => {
    it('should call customizations in the right order', async () => {
      // Note that is is also a problem for importField etc...
      // By default customizations are pushed to the end of the queue, which does not work when
      // the customization depends on another customization.
      const array: number[] = [];

      const customizer = new DataSourceCustomizer();
      customizer.use(async () => {
        array.push(1);
        customizer.use(async () => {
          array.push(2);

          customizer.use(async () => {
            array.push(3);
          });
        });
      });
      customizer.use(async () => {
        array.push(4);
        customizer.use(async () => {
          array.push(5);
        });
      });

      await customizer.getDataSource(logger);
      expect(array).toEqual([1, 2, 3, 4, 5]);
    });

    describe('when there is some errors in the customizations', () => {
      it('should throw on the first time applied', async () => {
        const customizer = new DataSourceCustomizer();
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );

        customizer
          .addDataSource(async () => dataSource)
          .customizeCollection('collection', collection =>
            collection.addField('error', {
              columnType: 'String',
              dependencies: [],
              getValues: () => [],
            }),
          );

        await expect(customizer.getDataSource(logger)).rejects.toThrow(
          "Computed field 'collection.error' must have at least one dependency.",
        );
      });

      it('should log error and keep the old datasource on the reload', async () => {
        const customizer = new DataSourceCustomizer();
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );

        customizer.addDataSource(async () => dataSource);

        const ds = await customizer.getDataSource(logger);

        customizer.customizeCollection('collection', collection =>
          collection.addField('error', {
            columnType: 'String',
            dependencies: [],
            getValues: () => [],
          }),
        );

        const spy = jest.fn();

        expect(await customizer.getDataSource(spy)).toStrictEqual(ds);
        expect(spy).toHaveBeenCalledWith(
          'Error',
          "Agent failed to restart with the new configuration. Retaining the previous one.\n  Error: Computed field 'collection.error' must have at least one dependency.",
        );
      });
    });
  });

  describe('findCollection', () => {
    it('should return the collection if found', async () => {
      const customizer = new DataSourceCustomizer();
      jest
        .spyOn(customizer, 'collections', 'get')
        .mockReturnValue([
          { name: 'test' },
          { name: 'otherCollection' },
        ] as Array<CollectionCustomizer>);
      jest
        .spyOn(customizer, 'getCollection')
        .mockReturnValue({ name: 'test' } as CollectionCustomizer);

      const collection = await customizer.findCollection('test');
      expect(collection).toMatchObject({ name: 'test' });
      expect(customizer.getCollection).toHaveBeenCalledWith('test');
    });

    it('should return undefined if the collection is not found', async () => {
      const customizer = new DataSourceCustomizer();
      jest
        .spyOn(customizer, 'collections', 'get')
        .mockReturnValue([
          { name: 'test' },
          { name: 'otherCollection' },
        ] as Array<CollectionCustomizer>);
      jest.spyOn(customizer, 'getCollection');

      const collection = await customizer.findCollection('somethingElse');
      expect(collection).toBeUndefined();
      expect(customizer.getCollection).not.toHaveBeenCalled();
    });
  });
});
