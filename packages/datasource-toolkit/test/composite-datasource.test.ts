import * as factories from './__factories__';
import { Collection } from '../src/interfaces/collection';
import CompositeDataSource from '../src/composite-datasource';

describe('CompositeDataSource', () => {
  it('should instantiate properly when extended', () => {
    expect(new CompositeDataSource<Collection>()).toBeDefined();
  });

  describe('addDataSource', () => {
    it('should add all the collections from all the data sources', () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      compositeDataSource.addCollection(factories.collection.build({ name: 'collection1' }));
      const newDataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection2' }),
      );

      compositeDataSource.addDataSource(newDataSource);

      expect(compositeDataSource.collections.map(c => c.name)).toEqual([
        'collection1',
        'collection2',
      ]);
    });

    it('should add all the charts from all the data sources', () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      const aDataSource = factories.dataSource.buildWithCharts(['chart1', 'chart2']);
      const otherDataSource = factories.dataSource.buildWithCharts(['chart3', 'chart4']);

      compositeDataSource.addDataSource(aDataSource).addDataSource(otherDataSource);

      expect(compositeDataSource.schema.charts).toEqual(['chart1', 'chart2', 'chart3', 'chart4']);
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

    it('should rename a collection when the rename option is given', () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      compositeDataSource.addCollection(factories.collection.build({ name: 'collection1' }));
      const newDataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection1' }),
      );

      compositeDataSource.addDataSource(newDataSource, { collection1: 'collection2' });

      expect(compositeDataSource.collections.map(c => c.name)).toEqual([
        'collection1',
        'collection2',
      ]);
    });

    it('should throw an error if there are two identical collection name', () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      compositeDataSource.addCollection(factories.collection.build({ name: 'collection1' }));
      const newDataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({ name: 'collection1' }),
      );

      expect(() => compositeDataSource.addDataSource(newDataSource)).toThrow(
        "Collection 'collection1' already defined in datasource",
      );
    });
  });

  describe('renderChart', () => {
    it('should not throw error when the chart exists', async () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      const aDataSource = factories.dataSource.buildWithCharts(['chart1']);

      compositeDataSource.addDataSource(aDataSource);

      await expect(() =>
        compositeDataSource.renderChart(factories.caller.build(), 'chart1'),
      ).not.toThrow();
    });

    it('should throw an error when the chart does not exist', async () => {
      const compositeDataSource = new CompositeDataSource<Collection>();
      const aDataSource = factories.dataSource.buildWithCharts([]);

      compositeDataSource.addDataSource(aDataSource);

      await expect(() =>
        compositeDataSource.renderChart(factories.caller.build(), 'chart1'),
      ).toThrow("Chart 'chart1' is not defined in datasource.");
    });
  });
});
