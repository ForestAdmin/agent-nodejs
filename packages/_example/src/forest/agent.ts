import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createLiveDataSource } from '@forestadmin/datasource-live';
// import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import { Schema } from './typings';
import { liveDatasourceSchema, seedLiveDatasource } from './datasources/live';
import createTypicode from './datasources/typicode';
import customizeAddress from './customizations/address';
import customizeComment from './customizations/comment';
import customizeCustomer from './customizations/customer';
import customizeDvd from './customizations/dvd';
import customizeOwner from './customizations/owner';
import customizePost from './customizations/post';
import customizeRental from './customizations/rental';
import customizeReview from './customizations/review';
import customizeStore from './customizations/store';
// import mongoose from '../connections/mongoose';
import sequelizeMsSql from '../connections/sequelize-mssql';
import sequelizeMySql from '../connections/sequelize-mysql';
import sequelizePostgres from '../connections/sequelize-postgres';

export default function makeAgent() {
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    agentUrl: process.env.FOREST_AGENT_URL,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    loggerLevel: 'Info',
    typingsPath: 'src/forest/typings.ts',
  };

  return createAgent<Schema>(envOptions)
    .addDataSource(createLiveDataSource(liveDatasourceSchema, { seeder: seedLiveDatasource }))
    .addDataSource(createSqlDataSource('mariadb://example:password@localhost:3808/example'))
    .addDataSource(createTypicode())
    .addDataSource(createSequelizeDataSource(sequelizePostgres))
    .addDataSource(createSequelizeDataSource(sequelizeMySql))
    .addDataSource(createSequelizeDataSource(sequelizeMsSql))

    .addChart('numRentals', async (context, resultBuilder) => {
      const rentals = context.dataSource.getCollection('rental');
      const rows = await rentals.aggregate({}, { operation: 'Count' });

      return resultBuilder.value((rows?.[0]?.value as number) ?? 0);
    })

    .customizeCollection('owner', customizeOwner)
    .customizeCollection('address', customizeAddress)
    .customizeCollection('store', customizeStore)
    .customizeCollection('rental', customizeRental)
    .customizeCollection('dvd', customizeDvd)
    .customizeCollection('customer', customizeCustomer)
    .customizeCollection('post', customizePost)
    .customizeCollection('comment', customizeComment)
    .customizeCollection('review', customizeReview);
}
