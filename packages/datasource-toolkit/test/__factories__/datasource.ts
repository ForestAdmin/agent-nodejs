import { Factory } from 'fishery';

import { Collection, DataSource } from '../../src/interfaces/collection';
import factoryCollection from './collection';

export class DataSourceFactory extends Factory<DataSource> {
  buildWithCharts(charts: Array<string>): DataSource {
    const factory = this.afterBuild(dataSource => {
      dataSource.schema.charts = charts;
    });

    return factory.build();
  }

  buildWithCollection(partialCollection: Partial<Collection>): DataSource {
    return this.buildWithCollections([partialCollection]);
  }

  buildWithCollections(partialCollections: Array<Partial<Collection>>): DataSource {
    const factory = this.afterBuild(dataSource => {
      // Add collections
      partialCollections.forEach(partialCollection => {
        const collection = factoryCollection.build({ ...partialCollection, dataSource });
        dataSource.collections.push(collection);
      });

      // Implement the getCollection method
      const getCollection = dataSource.getCollection as jest.Mock<Collection, [string]>;
      getCollection.mockImplementation(name =>
        dataSource.collections.find(dataSourceCollection => dataSourceCollection.name === name),
      );
    });

    return factory.build();
  }
}

export default DataSourceFactory.define(() => ({
  schema: { charts: [] },
  collections: [],
  getCollection: jest.fn(),
  addCollection: jest.fn(),
  renderChart: jest.fn(),
}));
