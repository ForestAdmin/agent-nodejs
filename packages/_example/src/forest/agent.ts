import { AgentOptions, createAgent } from '@forestadmin/agent';
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
import { Schema } from './typings';
import mongoose, { connectionString } from '../connections/mongoose';
import sequelizeMsSql from '../connections/sequelize-mssql';
import sequelizeMySql from '../connections/sequelize-mysql';
import sequelizePostgres from '../connections/sequelize-postgres';

export default function makeAgent() {
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    isProduction: false,
    loggerLevel: 'Info',
    typingsPath: 'src/forest/typings.ts',
  };

  return createAgent<Schema>(envOptions)
    .addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: './assets/db.sqlite' }))
    .addDataSource(
      createSqlDataSource(
        'postgres://postgres.mdvbfrrifupdjukiqrtb:qI3iUbMd2O6ssYpY@aws-0-eu-west-2.pooler.supabase.com:5432/postgres',
      ),
    )
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
    .customizeCollection('sales', customizeSales)
    .customizeCollection('reservations', collection => {
      collection.overrideCreate(async context => {
        const { data } = context;

        const record = await context.collection.create(data);
        console.log('create reservation', JSON.stringify(record));

        return record;
      });

      collection.addAction('action with form', {
        scope: 'Bulk',
        execute: (context, resultBuilder) => {
          resultBuilder.success('ok');
        },
        form: [
          {
            type: 'Layout',
            component: 'Page',
            nextButtonLabel: '==>',
            previousButtonLabel: '<==',
            elements: [
              { type: 'String', label: 'first_name' },
              {
                type: 'Layout',
                component: 'Separator',
                // "if_": lambda ctx: ctx.form_values.get("Gender", "") in ["other", ""],
              },
              {
                type: 'Layout',
                component: 'Row',
                fields: [
                  { type: 'Enum', label: 'Gender', enumValues: ['M', 'F', 'other'] },
                  {
                    type: 'String',
                    label: 'Gender_other',
                  },
                ],
              },
            ],
          },
          {
            type: 'Layout',
            component: 'Page',
            // "if_": lambda ctx: ctx.form_values.get("Number of children") != 0,
            elements: [
              { type: 'Number', label: 'Number of children' },
              {
                type: 'Layout',
                component: 'Row',
                fields: [
                  { type: 'Number', label: 'Age of older child' },
                  { type: 'Number', label: 'Age of younger child' },
                ],
              },
              { type: 'Boolean', label: 'Are they wise' },
            ],
            nextButtonLabel: '==>',
            previousButtonLabel: '<==',
          },
          {
            type: 'Layout',
            component: 'Page',
            // "if_": lambda ctx: ctx.form_values.get("Are they wise") is False,
            elements: [
              {
                type: 'Layout',
                component: 'Row',
                fields: [
                  { type: 'StringList', label: 'Why_its_your_fault' },
                  { type: 'String', label: 'Why_its_their_fault', widget: 'TextArea' },
                ],
              },
            ],
            nextButtonLabel: '==>',
            previousButtonLabel: '<==',
          },
        ],
      });

      collection.addAction('static action with form', {
        scope: 'Bulk',
        execute: (context, resultBuilder) => {
          resultBuilder.success('ok');
        },
        form: [{ type: 'String', label: 'name' }],
      });

      // collection.overrideUpdate(async context => {
      //   const { filter, patch } = context;

      //   await context.collection.update(filter, patch);
      // });
    });
}
