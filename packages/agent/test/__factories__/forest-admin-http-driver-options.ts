import { Factory } from 'fishery';
import { ForestAdminHttpDriverOptionsWithDefaults } from '../../src/types';

export default Factory.define<ForestAdminHttpDriverOptionsWithDefaults>(() => ({
  prefix: 'prefix',
  agentUrl: 'http://localhost:1234',
  authSecret: 'not_so_random_auth_secret',
  envSecret: 'env_secret_xxx',
  forestServerUrl: 'https://api.development.forestadmin.com',
  isProduction: false,
  schemaPath: '/tmp/.testschema.json',
  clientId: null,
  logger: () => {},
  scopesCacheDurationInSeconds: 15 * 30,
}));
