import { Factory } from 'fishery';

import factoryCollection from './collection';
import { Collection, DataSource } from '../../src/interfaces/collection';

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

  buildWithNativeQueryConnections(nativeQueryConnections: Record<string, unknown>): DataSource {
    const factory = this.afterBuild(dataSource => {
      jest.replaceProperty(dataSource, 'nativeQueryConnections', nativeQueryConnections);
    });

    return factory.build();
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
      getCollection.mockImplementation(name => {
        const collection = dataSource.collections.find(c => c.name === name);
        if (!collection) throw new Error(`dsmock: "${name}" does not exist`);

        return collection;
      });
    });

    return factory.build();
  }
}

export default DataSourceFactory.define(() => ({
  schema: { charts: [] },
  collections: [],
  nativeQueryConnections: {},
  getCollection: jest.fn(),
  addCollection: jest.fn(),
  renderChart: jest.fn().mockResolvedValue({}),
  executeNativeQuery: jest.fn().mockResolvedValue({}),
}));
