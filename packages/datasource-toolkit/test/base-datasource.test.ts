// eslint-disable-next-line max-classes-per-file
import BaseDataSource from '../src/base-datasource';
import { Collection, CollectionSchema } from '../src';

class ConcreteDatasource extends BaseDataSource<Collection> {}

describe('BaseDatasource', () => {
  it('should instanciate properly when extended', () => {
    expect(new ConcreteDatasource()).toBeDefined();
  });

  describe('collections (getter)', () => {
    const expectedCollection = { name: '__collection__' } as Collection;

    class DataSourceWithCollection extends BaseDataSource<Collection> {
      constructor() {
        super();

        this.addCollection(expectedCollection.name, expectedCollection);
      }
    }

    it('should expose collections from datasource as an array', () => {
      const dataSource = new DataSourceWithCollection();
      expect(dataSource.collections).toBeArrayOfSize(1);
      expect(dataSource.collections[0]).toBe(expectedCollection);
    });
  });

  describe('getCollection', () => {
    const expectedCollection = { name: '__collection__' } as Collection;

    class DataSourceWithCollection extends BaseDataSource<Collection> {
      constructor() {
        super();

        this.addCollection(expectedCollection.name, expectedCollection);
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
    const expectedCollection: Collection = {} as Collection;
    class DataSourceWithCollection extends ConcreteDatasource {
      constructor() {
        super();

        this.addCollection('__collection__', expectedCollection);
      }
    }

    class DuplicatedCollectionErrorDataSource extends ConcreteDatasource {
      constructor() {
        super();

        this.addCollection('__duplicated__', null);
        this.addCollection('__duplicated__', null);
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
