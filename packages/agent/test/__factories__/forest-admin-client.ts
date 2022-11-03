import type { ForestAdminClient } from '@forestadmin/forestadmin-client';

import { Factory } from 'fishery';

export class ForestAdminClientFactory extends Factory<ForestAdminClient> {}

const forestAdminClientFactory = ForestAdminClientFactory.define(() => ({
  verifySignedActionParameters: jest.fn(),
  canExecuteChart: jest.fn(),
  getScope: jest.fn(),
  markScopesAsUpdated: jest.fn(),
  permissionService: {
    canExecuteSegmentQuery: jest.fn(),
    canApproveCustomAction: jest.fn(),
    canOnCollection: jest.fn(),
    canRequestCustomActionParameters: jest.fn(),
    canExecuteChart: jest.fn(),
    canTriggerCustomAction: jest.fn(),
  },
  contextVariablesInstantiator: {
    buildContextVariables: jest.fn(),
  },
  chartHandler: {
    getChartWithContextInjected: jest.fn(),
  },
}));

export default forestAdminClientFactory;
