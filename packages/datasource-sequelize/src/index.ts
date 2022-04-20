import { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import SequelizeCollection from './collection';
import SequelizeDataSource from './datasource';

export default async function makeSequelizeDataSource(
  sequelize: Sequelize,
): Promise<DataSourceFactory> {
  return () => new SequelizeDataSource(sequelize);
}

export { SequelizeDataSource };
export { SequelizeCollection };
