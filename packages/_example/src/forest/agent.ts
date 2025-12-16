import type { Schema } from './typings';
import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createMongoDataSource } from '@forestadmin/datasource-mongo';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import customizeAccount from './customizations/account';
import customizeCard from './customizations/card';
import customizeComment from './customizations/comment';
import customizeCustomer from './customizations/customer';
import customizeDvd from './customizations/dvd';
import customizeOwner from './customizations/owner';
import customizePost from './customizations/post';
import customizeRental from './customizations/rental';
import customizeReview from './customizations/review';
import customizeSales from './customizations/sale';
import customizeStore from './customizations/store';
import createTypicode from './datasources/typicode';
import mongoose, { connectionString } from '../connections/mongoose';
import sequelizeMsSql from '../connections/sequelize-mssql';
import sequelizeMySql from '../connections/sequelize-mysql';
import sequelizePostgres from '../connections/sequelize-postgres';

export default function makeAgent() {
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    forestAppUrl: process.env.FOREST_APP_URL,
    isProduction: false,
    loggerLevel: 'Info',
    typingsPath: 'src/forest/typings.ts',
  };

  return createAgent<Schema>(envOptions)
    .addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: './assets/db.sqlite' }))

    .addDataSource(
      // Using an URI
      createSqlDataSource('mariadb://example:password@localhost:3808/example', {
        liveQueryConnections: 'Main database',
      }),
      { include: ['customer'] },
    )
    .addDataSource(
      // Using a connection object
      createSqlDataSource({
        dialect: 'mariadb',
        username: 'example',
        password: 'password',
        port: 3808,
        database: 'example',
      }),
      { include: ['card', 'active_cards'] }, // active_cards is a view
    )
    .addDataSource(createTypicode())
    .addDataSource(
      createSequelizeDataSource(sequelizePostgres, {
        liveQueryConnections: 'Business intel',
      }),
    )
    .addDataSource(createSequelizeDataSource(sequelizeMySql))
    .addDataSource(createSequelizeDataSource(sequelizeMsSql))
    .addDataSource(
      createMongooseDataSource(mongoose, { asModels: { account: ['address', 'bills.items'] } }),
    )
    .addDataSource(
      createMongoDataSource({
        uri: connectionString,
        dataSource: { flattenMode: 'auto' },
      }),
      {
        exclude: ['accounts', 'accounts_bills', 'accounts_bills_items'],
      },
    )
    .addChart('numRentals', async (context, resultBuilder) => {
      const rentals = context.dataSource.getCollection('rental');
      const rows = await rentals.aggregate({}, { operation: 'Count' });

      return resultBuilder.value((rows?.[0]?.value as number) ?? 0);
    })
    .mountAiMcpServer()
    .addAI({
      model: 'ministral-8b-2512',
      provider: 'mistral',
      apiKey: process.env.MISTRAL_API_KEY,
    })

    .customizeCollection('card', customizeCard)
    .customizeCollection('account', customizeAccount)
    .customizeCollection('owner', customizeOwner)
    .customizeCollection('store', customizeStore)
    .customizeCollection('rental', customizeRental)
    .customizeCollection('dvd', customizeDvd)
    .customizeCollection('customer', customizeCustomer)
    .customizeCollection('post', customizePost)
    .customizeCollection('comment', customizeComment)
    .customizeCollection('review', customizeReview)
    .customizeCollection('sales', customizeSales);
}
