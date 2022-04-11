import Agent, { AgentOptions } from '@forestadmin/agent';
import createLiveDataSource from '@forestadmin/datasource-live';
import createSequelizeDataSource from '@forestadmin/datasource-sequelize';
import createSqlDataSource from '@forestadmin/datasource-sql';
import customizeAddress from './customizations/address';
import customizeCustomer from './customizations/customer';
import customizeDvd from './customizations/dvd';
import customizeOwner from './customizations/owner';
import customizeRental from './customizations/rental';
import customizeStore from './customizations/store';
import liveDatasourceSchema from './datasources/live/schema';
import prepareDvdRentalsInMssql from './datasources/sequelize/mssql';
import prepareOwnerInPostgres from './datasources/sequelize/postgres';
import prepareStoreInMysql from './datasources/sequelize/mysql';
import seedLiveDatasource from './datasources/live/seed';

export default async function makeAgent(options: AgentOptions) {
  return new Agent(options)
    .addDatasource(createSequelizeDataSource({ connection: prepareOwnerInPostgres() }))
    .addDatasource(
      createLiveDataSource({
        dataSourceSchema: liveDatasourceSchema,
        seeder: seedLiveDatasource,
      }),
    )
    .addDatasource(createSequelizeDataSource({ connection: prepareStoreInMysql() }))
    .addDatasource(createSequelizeDataSource({ connection: await prepareDvdRentalsInMssql() }))
    .addDatasource(
      createSqlDataSource({
        connectionUri: 'mariadb://example:password@localhost:3808/example',
      }),
    )

    .customizeCollection('owner', customizeOwner)
    .customizeCollection('address', customizeAddress)
    .customizeCollection('store', customizeStore)
    .customizeCollection('rental', customizeRental)
    .customizeCollection('dvd', customizeDvd)
    .customizeCollection('customer', customizeCustomer);
}
