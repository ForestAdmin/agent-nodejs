import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createMongoDataSource } from '@forestadmin/datasource-mongo';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import {
  ForestAdminClientWithCache,
  ForestAdminServerInterface,
  buildApplicationServices,
} from '@forestadmin/forestadmin-client';
import PermissionServiceWithCache from '@forestadmin/forestadmin-client/dist/permissions/permission-with-cache';

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
import { Schema } from './typings';
import mongoose, { connectionString } from '../connections/mongoose';
import sequelizeMsSql from '../connections/sequelize-mssql';
import sequelizeMySql from '../connections/sequelize-mysql';
import sequelizePostgres from '../connections/sequelize-postgres';

class FaH implements ForestAdminServerInterface {
  // @ts-ignore
  getEnvironmentPermissions() {
    throw new Error('getEnvironmentPermissions');
  }

  // @ts-ignore
  async getUsers() {
    return [];
  }

  // @ts-ignore
  getRenderingPermissions() {
    return { stats: [] };
  }

  // @ts-ignore
  getModelCustomizations() {
    throw new Error('getModelCustomizations');
  }

  // @ts-ignore
  makeAuthService() {
    return {
      init: async () => {},
      getUserInfo: async (renderingId: number, accessToken: string) => ({}),
      generateAuthorizationUrl: async (params: { scope: string; state: string }) => 'authUrl',
      generateTokens: async () => 'token',
    };
  }
}

// @ts-ignore
const perm = new PermissionServiceWithCache({ can: () => true }, { getUser: () => ({}) });

const {
  optionsWithDefaults,
  renderingPermission,
  contextVariables,
  chartHandler,
  modelCustomizationService,
  eventsHandler,
  // @ts-ignore
} = buildApplicationServices(new FaH(), {
  envSecret: 'aaaaa',
  forestServerUrl: process.env.FOREST_SERVER_URL,
});

const faClient = new ForestAdminClientWithCache(
  optionsWithDefaults,
  perm,
  renderingPermission,
  contextVariables,
  chartHandler,
  // @ts-ignore
  { getConfiguration: async () => ({ ipRules: [], isFeatureEnabled: false }) },
  { postSchema: () => {} },
  {
    init: () => {},
    generateAuthorizationUrl: () => 'http://localhost:3351/forest/authentication/callback?state=1',
    generateTokens: async () => 'token',
    getUserInfo: async () => ({}),
  },
  modelCustomizationService,
  { subscribeEvents: () => {} },
  eventsHandler,
);

export default function makeAgent() {
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: 'http://localhost:3352/',
    // forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    loggerLevel: 'Info',
    typingsPath: 'src/forest/typings.ts',
    forestAdminClient: faClient,
  };

  return createAgent<Schema>(envOptions)
    .addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: './assets/db.sqlite' }))

    .addDataSource(
      // Using an URI
      createSqlDataSource('mariadb://example:password@localhost:3808/example'),
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
    .addDataSource(createSequelizeDataSource(sequelizePostgres))
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
