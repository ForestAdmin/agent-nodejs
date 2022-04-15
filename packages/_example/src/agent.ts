import Agent, { AgentOptions } from '@forestadmin/agent';
import customizeAddress from './customizations/address';
import customizeCustomer from './customizations/customer';
import customizeDvd from './customizations/dvd';
import customizeOwner from './customizations/owner';
import customizeRental from './customizations/rental';
import customizeStore from './customizations/store';
import prepareAddressInLive from './datasources/live';
import prepareDvdRentalsInMssql from './datasources/sequelize/mssql';
import prepareOwnerInPostgres from './datasources/sequelize/postgres';
import prepareSqlDataSourceInMariadb from './datasources/sql-mariadb';
import prepareStoreInMysql from './datasources/sequelize/mysql';

export default async function makeAgent(options: AgentOptions) {
  return new Agent(options)
    .addDatasource(await prepareOwnerInPostgres())
    .addDatasource(await prepareAddressInLive())
    .addDatasource(await prepareStoreInMysql())
    .addDatasource(await prepareDvdRentalsInMssql())
    .addDatasource(await prepareSqlDataSourceInMariadb())

    .customizeCollection('owner', customizeOwner)
    .customizeCollection('address', customizeAddress)
    .customizeCollection('store', customizeStore)
    .customizeCollection('rental', customizeRental)
    .customizeCollection('dvd', customizeDvd)
    .customizeCollection('customer', customizeCustomer);
}
