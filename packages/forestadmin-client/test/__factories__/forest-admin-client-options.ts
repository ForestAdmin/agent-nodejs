import type { ForestAdminClientOptionsWithDefaults } from '../../src/types';

import { Factory } from 'fishery';

export default Factory.define<ForestAdminClientOptionsWithDefaults>(() => ({
  envSecret: '61a31971206f285c3e8eb8f3ee420175eb004bfa9fa24846dde6d5dd438e3991',
  forestServerUrl: 'https://api.development.forestadmin.com',
  permissionsCacheDurationInSeconds: 15 * 60,
  instantCacheRefresh: true,
  experimental: null,
  logger: jest.fn(),
}));
