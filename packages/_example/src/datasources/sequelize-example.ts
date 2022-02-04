import { DataTypes, Sequelize } from 'sequelize';

import { SequelizeCollection, SequelizeDataSource } from '@forestadmin/datasource-sequelize';

const prepareDataSource = (): SequelizeDataSource => {
  const sequelize = new Sequelize('postgres://example:password@localhost:54r2/example');

  sequelize.define('example', {
    name: {
      type: DataTypes.STRING,
    },
    value: {
      type: DataTypes.INTEGER,
    },
  });

  // FIXME: Eith allow add collection later or make datasource set collection `this.dataSource`.
  const exampleCollection = new SequelizeCollection('example', null, sequelize);
  const dataSource = new SequelizeDataSource([exampleCollection], sequelize);

  return dataSource;
};

const dataSource = prepareDataSource();

export default dataSource;
