import { Factory } from 'fishery';

import { AgentOptionsWithDefaults } from '../../src/types';

export default Factory.define<AgentOptionsWithDefaults>(() => ({
  prefix: 'prefix',
  authSecret: 'not_so_random_auth_secret',
  envSecret: '61a31971206f285c3e8eb8f3ee420175eb004bfa9fa24846dde6d5dd438e3991',
  customizeErrorMessage: null,
  forestServerUrl: 'https://api.development.forestadmin.com',
  isProduction: false,
  schemaPath: '/tmp/.testschema.json',
  permissionsCacheDurationInSeconds: 15 * 60,
  logger: () => {},
  loggerLevel: 'Error',
  typingsPath: null,
  typingsMaxDepth: 5,
}));
