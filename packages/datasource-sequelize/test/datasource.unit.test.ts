import { Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '../src';

describe('SequelizeDataSource', () => {
  it('should fail to instanciate without a Sequelize instance', () => {
    expect(() => new SequelizeDataSource(null)).toThrow('Invalid (null) Sequelize instance.');
  });

  it('should have no predefined collection', () => {
    expect(
      new SequelizeDataSource({ models: {} } as unknown as Sequelize).collections,
    ).toBeArrayOfSize(0);
  });

  it('should create collection based on models', () => {
    const sequelize = new Sequelize({ dialect: 'postgres' });
    sequelize.define('cars', {});

    const datasource = new SequelizeDataSource(sequelize);

    expect(datasource.getCollection('cars')).toBeInstanceOf(SequelizeCollection);
  });
});
