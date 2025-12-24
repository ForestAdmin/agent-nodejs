import type { AgentOptionsWithDefaults } from '../../src/types';

import { Factory } from 'fishery';

import forestAdminClientFactory from './forest-admin-client';

export default Factory.define<AgentOptionsWithDefaults>(() => ({
  authSecret: 'not_so_random_auth_secret',
  customizeErrorMessage: null,
  envSecret: '61a31971206f285c3e8eb8f3ee420175eb004bfa9fa24846dde6d5dd438e3991',
  forestAdminClient: forestAdminClientFactory.build(),
  forestServerUrl: 'https://api.development.forestadmin.com',
  forestAppUrl: 'https://app.development.forestadmin.com',
  isProduction: false,
  logger: () => {},
  loggerLevel: 'Error',
  permissionsCacheDurationInSeconds: 15 * 60,
  instantCacheRefresh: false,
  prefix: 'prefix',
  schemaPath: '/tmp/.testschema.json',
  skipSchemaUpdate: false,
  typingsMaxDepth: 5,
  typingsPath: null,
  limitExportSize: 5000,
  experimental: {},
  maxBodySize: '50mb',
  bodyParserOptions: {
    jsonLimit: '50mb',
  },
  ignoreMissingSchemaElementErrors: false,
  useUnsafeActionEndpoint: false,
}));
