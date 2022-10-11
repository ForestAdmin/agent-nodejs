import { Factory } from 'fishery';
import type { ForestAdminClient } from '@forestadmin/forestadmin-client';

export class ForestAdminClientFactory extends Factory<ForestAdminClient> {}

const forestAdminClientFactory = ForestAdminClientFactory.define(() => ({
  verifySignedActionParameters: jest.fn(),
  canRetrieveChart: jest.fn(),
  getScope: jest.fn(),
  markScopesAsUpdated: jest.fn(),
  permissionService: {
    canApproveCustomAction: jest.fn(),
    canOnCollection: jest.fn(),
    canRequestCustomActionParameters: jest.fn(),
    canRetrieveChart: jest.fn(),
    canTriggerCustomAction: jest.fn(),
  },
}));

export default forestAdminClientFactory;
