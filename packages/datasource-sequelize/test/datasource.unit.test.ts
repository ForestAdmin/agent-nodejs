import { SequelizeCollection } from '../src';
import SequelizeDataSource from '../src/datasource';

class ConcreteSequelizeDataSource extends SequelizeDataSource {}

describe('SequelizeDataSource', () => {
  it('should instanciate properly when extended', () => {
    expect(new ConcreteSequelizeDataSource([], Symbol('sequelize'))).toBeDefined();
  });

  it('should fail to instanciate without a Sequelize instance', () => {
    expect(() => new ConcreteSequelizeDataSource([], null)).toThrow(
      'Invalid (null) Sequelize instance.',
    );
  });

  it('should have no predefined collection', () => {
    expect(new ConcreteSequelizeDataSource([], Symbol('sequelize')).collections).toBeArrayOfSize(0);
  });

  describe('getCollection', () => {
    it('should return null for unknown collection name', () => {
      const sequelizeDataSource = new ConcreteSequelizeDataSource([], Symbol('sequelize'));

      expect(() => sequelizeDataSource.getCollection('__no_such_collection__')).toThrow(
        'Collection "__no_such_collection__" not found.',
      );
    });

    it('should return known collection when given its name', () => {
      const collections = [{ name: 'dummy' }] as SequelizeCollection[];
      const sequelizeDataSource = new ConcreteSequelizeDataSource(collections, Symbol('sequelize'));

      expect(sequelizeDataSource.getCollection(collections[0].name)).toBeDefined();
    });
  });
});
