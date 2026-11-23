import type { Schema } from './typings';
import type { AgentOptions } from '@forestadmin/agent';

import { createAgent } from '@forestadmin/agent';
import { createMongoDataSource } from '@forestadmin/datasource-mongo';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import customizeAccounts from './customizations/accounts';
import customizeAlerts from './customizations/alerts';
import customizeCardMerchants from './customizations/card-merchants';
import customizeCardTransactions from './customizations/card-transactions';
import customizeCards from './customizations/cards';
import customizeChargebacks from './customizations/chargebacks';
import customizeCustomers from './customizations/customers';
import customizeDisputeRequests from './customizations/dispute-requests';
import customizeIndividuals from './customizations/individuals';
import customizeInvestigations from './customizations/investigations';
import customizeKycCases from './customizations/kyc-cases';
import customizeSarReports from './customizations/sar-reports';
import customizeTransactions from './customizations/transactions';
import createCardMerchants from './datasources/card-merchants';
import mongoose, { connectionString } from '../connections/mongoose';
import sequelizeMsSql from '../connections/sequelize-mssql';
import sequelizeMySql from '../connections/sequelize-mysql';
import sequelizePostgres from '../connections/sequelize-postgres';
import { SQLITE_STORAGE } from '../connections/sequelize-sqlite';
import { sqlOptions, sqlUri } from '../connections/sql-options';
import { merchantsApiUrl } from '../merchants-api';

const PENDING_ALERT_STATUSES = ['OPEN', 'IN_REVIEW', 'SECOND_LOOK'];

const ZENDESK_OAUTH_DOMAIN = 'forestadmin.com';

export default function makeAgent() {
  const envOptions: AgentOptions = {
    authSecret: process.env.FOREST_AUTH_SECRET,
    envSecret: process.env.FOREST_ENV_SECRET,
    forestServerUrl: process.env.FOREST_SERVER_URL,
    forestAppUrl: process.env.FOREST_APP_URL,
    workflowExecutorUrl: process.env.WORKFLOW_EXECUTOR_URL,
    isProduction: false,
    loggerLevel: 'Info',
    typingsPath: 'src/forest/typings.ts',
  };

  const rawAllowedOAuthClients = process.env.FOREST_MCP_ALLOWED_OAUTH_CLIENTS;
  const configuredOAuthClients = rawAllowedOAuthClients
    ? rawAllowedOAuthClients
        .split(',')
        .map(domain => domain.trim())
        .filter(Boolean)
    : undefined;
  const allowedOAuthClients = configuredOAuthClients?.length
    ? [...new Set([...configuredOAuthClients, ZENDESK_OAUTH_DOMAIN])]
    : configuredOAuthClients;

  const bffAllowedOrigins = (process.env.BFF_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return (
    createAgent<Schema>(envOptions)
      .addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: SQLITE_STORAGE }))

      .addDataSource(
        // Using an URI
        createSqlDataSource(sqlUri('mariadb'), {
          liveQueryConnections: 'Main database',
        }),
        { include: ['cards'] },
      )
      .addDataSource(
        // Using a connection object
        createSqlDataSource(sqlOptions('mariadb')),
        { include: ['active_cards'] }, // active_cards is a view
      )
      .addDataSource(createCardMerchants(merchantsApiUrl()))
      .addDataSource(
        createSequelizeDataSource(sequelizePostgres, {
          liveQueryConnections: 'Business intel',
        }),
      )
      .addDataSource(createSequelizeDataSource(sequelizeMySql))
      .addDataSource(createSequelizeDataSource(sequelizeMsSql))
      .addDataSource(
        createMongooseDataSource(mongoose, {
          asModels: { kyc_cases: ['applicant', 'documents.check'] },
        }),
      )
      .addDataSource(
        createMongoDataSource({
          uri: connectionString,
          dataSource: { flattenMode: 'auto' },
        }),
        { exclude: ['kyc_cases', 'kyc_cases_documents'] },
      )
      .addChart('pendingAlerts', async (context, resultBuilder) => {
        const alerts = context.dataSource.getCollection('alerts');
        const rows = await alerts.aggregate(
          { conditionTree: { field: 'status', operator: 'In', value: PENDING_ALERT_STATUSES } },
          { operation: 'Count' },
        );

        return resultBuilder.value((rows?.[0]?.value as number) ?? 0);
      })

      // One allowlist for both services on purpose: separate lists need the two deprecated aliases.
      .addGateway({
        ...(allowedOAuthClients && { allowedOAuthClients }),
        mcp: true,
        api: {
          allowedOrigins: bffAllowedOrigins,
          tokenEncryptionKey: process.env.BFF_TOKEN_ENCRYPTION_KEY,
        },
      })

      .customizeCollection('individuals', customizeIndividuals)
      .customizeCollection('accounts', customizeAccounts)
      .customizeCollection('alerts', customizeAlerts)
      .customizeCollection('card_merchants', customizeCardMerchants)
      .customizeCollection('card_transactions', customizeCardTransactions)
      .customizeCollection('cards', customizeCards)
      .customizeCollection('chargebacks', customizeChargebacks)
      .customizeCollection('customers', customizeCustomers)
      .customizeCollection('dispute_requests', customizeDisputeRequests)
      .customizeCollection('investigations', customizeInvestigations)
      .customizeCollection('kyc_cases', customizeKycCases)
      .customizeCollection('sar_reports', customizeSarReports)
      .customizeCollection('transactions', customizeTransactions)
  );
}
