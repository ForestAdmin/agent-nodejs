import { Collection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import CompositeDataSource from '../../src/decorators/composite-datasource';

describe('CompositeDataSource', () => {
  it('should instantiate properly when extended', () => {
    expect(new CompositeDataSource<Collection>()).toBeDefined();
  });

  describe('addDataSource', () => {
    it('should add all the collections from all the data sources', () => {
      const aDataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection1' }),
      );
      const anotherDataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection2' }),
      );

      const compositeDataSource = new CompositeDataSource<Collection>();
      compositeDataSource.addDataSource(aDataSource);
      compositeDataSource.addDataSource(anotherDataSource);

      expect(compositeDataSource.collections.map(c => c.name)).toEqual([
        'collection1',
        'collection2',
      ]);
    });

    it('should add all the charts from all the data sources', () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      const aDataSource = factories.dataSource.buildWithCharts(['chart1', 'chart2']);
      const otherDataSource = factories.dataSource.buildWithCharts(['chart3', 'chart4']);

      compositeDataSource.addDataSource(aDataSource);
      compositeDataSource.addDataSource(otherDataSource);

      expect(compositeDataSource.schema.charts).toEqual(['chart1', 'chart2', 'chart3', 'chart4']);
    });

    it('should throw with collectio name conflict', () => {
      const aDataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection1' }),
      );
      const anotherDataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection1' }),
      );

      const compositeDataSource = new CompositeDataSource<Collection>();
      compositeDataSource.addDataSource(aDataSource);

      expect(() => compositeDataSource.addDataSource(anotherDataSource)).toThrow(
        "Collection 'collection1' already exists",
      );
    });

    it('should throw an error if a chart name is already registered', () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      const aDataSource = factories.dataSource.buildWithCharts(['chart1']);
      const otherDataSource = factories.dataSource.buildWithCharts(['chart1']);
      compositeDataSource.addDataSource(aDataSource);

      expect(() => compositeDataSource.addDataSource(otherDataSource)).toThrow(
        "Chart 'chart1' is already defined in datasource.",
      );
    });
  });

  describe('getCollection', () => {
    it('should throw an error when the collection does not exist', () => {
      const compositeDataSource = new CompositeDataSource<Collection>();

      expect(() => compositeDataSource.getCollection('missing')).toThrow(
        "Collection 'missing' not found. List of available collections: ",
      );
    });
  });

  describe('renderChart', () => {
    it('should not throw error when the chart exists', async () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      const aDataSource = factories.dataSource.buildWithCharts(['chart1']);

      compositeDataSource.addDataSource(aDataSource);

      await expect(
        compositeDataSource.renderChart(factories.caller.build(), 'chart1'),
      ).resolves.not.toThrow();
    });

    it('should throw an error when the chart does not exist', async () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      const aDataSource = factories.dataSource.buildWithCharts([]);

      compositeDataSource.addDataSource(aDataSource);

      await expect(
        compositeDataSource.renderChart(factories.caller.build(), 'chart1'),
      ).rejects.toThrow("Chart 'chart1' is not defined in the dataSource.");
    });
  });
});
