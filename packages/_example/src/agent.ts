import { Agent, AgentOptions } from '@forestadmin/agent';
import { createLiveDataSource } from '@forestadmin/datasource-live';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import createTypicode from './datasources/typicode';
import customizeAddress from './customizations/address';
import customizeComment from './customizations/comment';
import customizeCustomer from './customizations/customer';
import customizeDvd from './customizations/dvd';
import customizeOwner from './customizations/owner';
import customizePost from './customizations/post';
import customizeRental from './customizations/rental';
import customizeStore from './customizations/store';
import liveDataSourceSchema from './datasources/live/schema';
import prepareDvdRentalsInMssql from './datasources/sequelize/mssql';
import prepareOwnerInPostgres from './datasources/sequelize/postgres';
import prepareStoreInMysql from './datasources/sequelize/mysql';
import seedLiveDataSource from './datasources/live/seed';

export default async function makeAgent(options: AgentOptions) {
  return new Agent(options)
    .addDataSource(createSequelizeDataSource(prepareOwnerInPostgres()))
    .addDataSource(createLiveDataSource(liveDataSourceSchema, { seeder: seedLiveDataSource }))
    .addDataSource(createSequelizeDataSource(prepareStoreInMysql()))
    .addDataSource(createSequelizeDataSource(await prepareDvdRentalsInMssql()))
    .addDataSource(createSqlDataSource('mariadb://example:password@localhost:3808/example'))
    .addDataSource(createTypicode())

    .customizeCollection('owner', customizeOwner)
    .customizeCollection('address', customizeAddress)
    .customizeCollection('store', customizeStore)
    .customizeCollection('rental', customizeRental)
    .customizeCollection('dvd', customizeDvd)
    .customizeCollection('customer', customizeCustomer)
    .customizeCollection('post', customizePost)
    .customizeCollection('comment', customizeComment);
}
