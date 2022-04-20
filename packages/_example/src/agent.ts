import Agent, { AgentOptions } from '@forestadmin/agent';
import makeLiveDataSource from '@forestadmin/datasource-live';
import makeSequelizeDataSource from '@forestadmin/datasource-sequelize';
import makeSqlDataSource from '@forestadmin/datasource-sql';

import { liveSchema, seedLiveDataSource } from './datasources/live';
import createMsSqlSequelize from './datasources/sequelize/mssql';
import createMySqlSequelize from './datasources/sequelize/mysql';
import createPostgresSequelize from './datasources/sequelize/postgres';
import customizeAddress from './customizations/address';
import customizeCustomer from './customizations/customer';
import customizeDvd from './customizations/dvd';
import customizeOwner from './customizations/owner';
import customizeRental from './customizations/rental';
import customizeStore from './customizations/store';

export default async function makeAgent(options: AgentOptions) {
  return new Agent(options)
    .addDatasource(await makeSqlDataSource('mariadb://example:password@localhost:3808/example'))
    .addDatasource(await makeLiveDataSource(liveSchema, seedLiveDataSource))
    .addDatasource(await makeSequelizeDataSource(await createPostgresSequelize()))
    .addDatasource(await makeSequelizeDataSource(await createMySqlSequelize()))
    .addDatasource(await makeSequelizeDataSource(await createMsSqlSequelize()))

    .customizeCollection('owner', customizeOwner)
    .customizeCollection('address', customizeAddress)
    .customizeCollection('store', customizeStore)
    .customizeCollection('rental', customizeRental)
    .customizeCollection('dvd', customizeDvd)
    .customizeCollection('customer', customizeCustomer);
}
