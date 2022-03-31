import Agent, { AgentOptions } from '@forestadmin/agent';
import customizeAddress from './customizations/address';
import customizeDvd from './customizations/dvd';
import customizeOwner from './customizations/owner';
import customizeStore from './customizations/store';
import prepareAddressInLive from './datasources/live';
import prepareDvdRentalsInMssql from './datasources/sequelize/mssql';
import prepareOwnerInPostgres from './datasources/sequelize/postgres';
import prepareStoreInMysql from './datasources/sequelize/mysql';

export default async function makeAgent(options: AgentOptions) {
  return new Agent(options)
    .addDatasource(await prepareOwnerInPostgres())
    .addDatasource(await prepareAddressInLive())
    .addDatasource(await prepareStoreInMysql())
    .addDatasource(await prepareDvdRentalsInMssql())

    .customizeCollection('owner', customizeOwner)
    .customizeCollection('address', customizeAddress)
    .customizeCollection('store', customizeStore)
    .customizeCollection('dvd', customizeDvd);
}
