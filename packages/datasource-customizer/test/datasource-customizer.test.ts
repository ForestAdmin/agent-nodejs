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
      const builder = new DataSourceCustomizer();
      const dataSource = await builder
        .addChart('myChart', (context, resultBuilder) => resultBuilder.value(12332, 3224))
        .getDataSource(() => {});

      // Check that the chart was added to the datasource
      expect(dataSource.schema.charts).toContain('myChart');
      await expect(dataSource.renderChart(null, 'myChart')).resolves.toStrictEqual({
        countCurrent: 12332,
        countPrevious: 3224,
      });
    });
  });

  describe('customizeCollection', () => {
    it('should throw an error when designed collection is unknown', async () => {
      const builder = new DataSourceCustomizer();

      await expect(
        builder.customizeCollection('unknown', () => {}).getDataSource(() => {}),
      ).rejects.toThrowError("Collection 'unknown' not found");
    });

    it('should provide collection builder otherwise', async () => {
      const builder = new DataSourceCustomizer();

      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection' }),
      );

      const handle = jest.fn();

      await builder
        .addDataSource(async () => dataSource)
        .customizeCollection('collection', handle)
        .getDataSource(() => {});

      expect(handle).toHaveBeenCalledTimes(1);
      expect(handle).toHaveBeenCalledWith(
        new CollectionCustomizer(expect.any(DecoratorsStack), 'collection'),
      );
    });
  });

  describe('rename option', () => {
    describe('when there is a naming conflict with two collection names', () => {
      it('should throw an error when the given collection name does not exist', async () => {
        const builder = new DataSourceCustomizer();
        const dataSource1 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        const dataSource2 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        builder.addDataSource(async () => dataSource1);
        builder.addDataSource(async () => dataSource2, {
          rename: {
            collectionDoesNotExist: 'updatedName',
          },
        });

        await expect(builder.getDataSource(() => {})).rejects.toThrowError(
          'The given collection name "collectionDoesNotExist" does not exist',
        );
      });

      it('should throw an error when the new name is also in conflict', async () => {
        const builder = new DataSourceCustomizer();
        const dataSource1 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        const dataSource2 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        builder.addDataSource(async () => dataSource1);
        builder.addDataSource(async () => dataSource2, {
          rename: {
            collection: 'collection',
          },
        });

        await expect(builder.getDataSource(() => {})).rejects.toThrowError(
          'The given new collection name "collection" is already defined in the dataSource',
        );
      });

      it('should rename the collection name without error', async () => {
        const builder = new DataSourceCustomizer();
        const dataSource1 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        const dataSource2 = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        builder.addDataSource(async () => dataSource1);
        builder.addDataSource(async () => dataSource2, {
          rename: {
            collection: 'updatedName',
          },
        });

        await expect(builder.getDataSource(() => {})).resolves.not.toThrowError();
      });

      it('should not throw an error when rename option is null', async () => {
        const builder = new DataSourceCustomizer();
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({ name: 'collection' }),
        );
        builder.addDataSource(async () => dataSource, {
          rename: null,
        });

        await expect(builder.getDataSource(() => {})).resolves.not.toThrowError();
      });
    });
  });
});
