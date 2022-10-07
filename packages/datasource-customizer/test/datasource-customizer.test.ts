import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import CollectionCustomizer from '../src/collection-customizer';
import DataSourceCustomizer from '../src/datasource-customizer';
import DecoratorsStack from '../src/decorators/decorators-stack';

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

describe('Builder > Agent', () => {
  describe('addChart', () => {
    it('should add the chart to the schema', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = await customizer
        .addChart('myChart', (context, resultBuilder) => resultBuilder.value(12332, 3224))
        .getDataSource(() => {});

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
        customizer.customizeCollection('unknown', () => {}).getDataSource(() => {}),
      ).rejects.toThrowError("Collection 'unknown' not found");
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
        .getDataSource(() => {});

      expect(handle).toHaveBeenCalledTimes(1);
      expect(handle).toHaveBeenCalledWith(
        new CollectionCustomizer(expect.any(DecoratorsStack), 'collection'),
      );
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

      await expect(customizer.getDataSource(() => {})).rejects.toThrowError(
        'The given collection name "missing" does not exist',
      );
    });

    it('should throw when renaming to an existing collection', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource1 = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      const dataSource2 = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      customizer.addDataSource(async () => dataSource1);
      customizer.addDataSource(async () => dataSource2, { rename: { collection: 'collection' } });

      await expect(customizer.getDataSource(() => {})).rejects.toThrowError(
        'The given new collection name "collection" is already defined in the dataSource',
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

      await expect(customizer.getDataSource(() => {})).resolves.not.toThrowError();
    });

    it('should hide collections', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({ name: 'collection1' }),
        factories.collection.build({ name: 'collection2' }),
      ]);

      customizer.addDataSource(async () => dataSource, { exclude: ['collection1'] });

      const result = await customizer.getDataSource(() => {});
      expect(result.collections).toHaveLength(1);
    });

    it('should not throw an error when rename option is null', async () => {
      const customizer = new DataSourceCustomizer();
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );
      customizer.addDataSource(async () => dataSource, { rename: null as unknown as undefined });

      await expect(customizer.getDataSource(() => {})).resolves.not.toThrowError();
    });
  });
});
