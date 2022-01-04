import { Factory } from 'fishery';
import { Collection, DataSource } from '@forestadmin/datasource-toolkit';
import factoryCollection from './collection';

export class DataSourceFactory extends Factory<DataSource> {
  withOneCollection(partialCollection: Partial<Collection>) {
    return this.params({
      collections: [],
      getCollection: jest.fn(),
    }).afterBuild(dataSource => {
      const collection = factoryCollection.build({ ...partialCollection, dataSource });
      dataSource.collections.push(collection);
      dataSource.getCollection = jest.fn().mockResolvedValue(collection);
    });
  }

  withSeveralCollections(partialCollections: Array<Partial<Collection>>) {
    return this.params({
      collections: [],
      getCollection: jest.fn(),
    }).afterBuild(dataSource => {
      partialCollections.forEach(partialCollection => {
        const collection = factoryCollection.build({ ...partialCollection, dataSource });
        dataSource.collections.push(collection);
        dataSource.getCollection = jest
          .fn()
          .mockImplementation(name =>
            dataSource.collections.find(dataSourceCollection => dataSourceCollection.name === name),
          );
      });
    });
  }
}

export default DataSourceFactory.define(() => ({
  collections: [],
  getCollection: jest.fn(),
}));
