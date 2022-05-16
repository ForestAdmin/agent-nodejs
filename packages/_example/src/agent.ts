import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createLiveDataSource } from '@forestadmin/datasource-live';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import { Schema } from './typings';
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
import liveDatasourceSchema from './datasources/live/schema';
import mongoose from './datasources/mongoose/mongodb';
import seedLiveDatasource from './datasources/live/seed';
import sequelizeMsSql from './datasources/sequelize/mssql';
import sequelizeMySql from './datasources/sequelize/mysql';
import sequelizePostgres from './datasources/sequelize/postgres';

export default async function makeAgent(options: AgentOptions) {
  return createAgent<Schema>(options)
    .addDataSource(createLiveDataSource(liveDatasourceSchema, { seeder: seedLiveDatasource }))
    .addDataSource(createSqlDataSource('mariadb://example:password@localhost:3808/example'))
    .addDataSource(createTypicode())
    .addDataSource(createSequelizeDataSource(sequelizePostgres))
    .addDataSource(createSequelizeDataSource(sequelizeMySql))
    .addDataSource(createSequelizeDataSource(sequelizeMsSql))
    .addDataSource(createMongooseDataSource(mongoose))

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
