import { Sequelize } from 'sequelize';

import { SequelizeDataSource } from '../src';

describe('SequelizeDataSource', () => {
  it('should fail to instanciate without a Sequelize instance', () => {
    expect(() => new SequelizeDataSource(null)).toThrow('Invalid (null) Sequelize instance.');
  });

  it('should have no predefined collection', () => {
    expect(
      new SequelizeDataSource(Symbol('sequelize') as unknown as Sequelize).collections,
    ).toBeArrayOfSize(0);
  });
});
