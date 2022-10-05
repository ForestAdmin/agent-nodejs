import { Factory } from 'fishery';

import { ForestAdminClient } from '../../src/types';

export class ForestAdminClientFactory extends Factory<ForestAdminClient> {}

const forestAdminClientFactory = ForestAdminClientFactory.define(() => ({
  canOnCollection: jest.fn(),
  canExecuteCustomAction: jest.fn(),
  canExecuteCustomActionHook: jest.fn(),
  canRetrieveChart: jest.fn(),
  getScope: jest.fn(),
  markScopesAsUpdated: jest.fn(),
}));

export default forestAdminClientFactory;
