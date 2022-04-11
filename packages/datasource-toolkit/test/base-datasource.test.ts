// eslint-disable-next-line max-classes-per-file
import * as factories from './__factories__';
import { Collection } from '../src/interfaces/collection';
import BaseDataSource from '../src/base-datasource';

class ConcreteDatasource extends BaseDataSource<Collection> {}

describe('BaseDatasource', () => {
  it('should instanciate properly when extended', () => {
    expect(new ConcreteDatasource(() => {})).toBeDefined();
  });

  describe('collections (getter)', () => {
    const expectedCollection = factories.collection.build({ name: '__collection__' });

    class DataSourceWithCollection extends BaseDataSource<Collection> {
      constructor() {
        super(() => {});

        this.addCollection(expectedCollection);
      }
    }

    it('should expose collections from datasource as an array', () => {
      const dataSource = new DataSourceWithCollection();
      expect(dataSource.collections).toBeArrayOfSize(1);
      expect(dataSource.collections[0]).toBe(expectedCollection);
    });
  });

  describe('getCollection', () => {
    const expectedCollection = factories.collection.build({ name: '__collection__' });

    class DataSourceWithCollection extends BaseDataSource<Collection> {
      constructor() {
        super(() => {});

        this.addCollection(expectedCollection);
      }
    }

    it('should get collection from datasource', () => {
      const dataSource = new DataSourceWithCollection();

      expect(dataSource.getCollection(expectedCollection.name)).toBe(expectedCollection);
    });

    it('should fail to get collection if one with the same name is not present', () => {
      const dataSource = new DataSourceWithCollection();

      expect(() => dataSource.getCollection('__no_such_collection__')).toThrow(
        'Collection "__no_such_collection__" not found.',
      );
    });
  });

  describe('addCollection', () => {
    const expectedCollection = factories.collection.build({ name: '__collection__' });

    class DataSourceWithCollection extends ConcreteDatasource {
      constructor() {
        super(() => {});

        this.addCollection(expectedCollection);
      }
    }

    class DuplicatedCollectionErrorDataSource extends ConcreteDatasource {
      constructor() {
        super(() => {});

        this.addCollection(factories.collection.build({ name: '__duplicated__' }));
        this.addCollection(factories.collection.build({ name: '__duplicated__' }));
      }
    }

    it('should prevent instanciation when adding collection with duplicated name', () => {
      expect(() => new DuplicatedCollectionErrorDataSource()).toThrow(
        'Collection "__duplicated__" already defined in datasource',
      );
    });

    it('should add collection with unique name', () => {
      const dataSource = new DataSourceWithCollection();

      expect(dataSource.collections).toBeArrayOfSize(1);
      expect(dataSource.collections[0]).toBe(expectedCollection);
    });
  });
});
