import { Factory } from 'fishery';
import { ForestAdminHttpDriverOptions } from '../../src/types';

export default Factory.define<ForestAdminHttpDriverOptions>(() => ({
  prefix: 'prefix',
  agentUrl: 'http://localhost:1234',
  authSecret: 'not_so_random_auth_secret',
  envSecret: 'env_secret_xxx',
  forestServerUrl: 'https://api.forestadmin.com',
}));
