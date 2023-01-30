import { Factory } from 'fishery';

import forestAdminClientFactory from './forest-admin-client';
import { AgentOptionsWithDefaults } from '../../src/types';

export default Factory.define<AgentOptionsWithDefaults>(() => ({
  authSecret: 'not_so_random_auth_secret',
  customizeErrorMessage: null,
  envSecret: '61a31971206f285c3e8eb8f3ee420175eb004bfa9fa24846dde6d5dd438e3991',
  forestAdminClient: forestAdminClientFactory.build(),
  forestServerUrl: 'https://api.development.forestadmin.com',
  isProduction: false,
  logger: () => {},
  loggerLevel: 'Error',
  permissionsCacheDurationInSeconds: 15 * 60,
  prefix: 'prefix',
  schemaPath: '/tmp/.testschema.json',
  skipSchemaUpdate: false,
  typingsMaxDepth: 5,
  typingsPath: null,
}));
