import type { PermissionsOverride } from '../src/permission-overrides';
import type { HttpRequester } from '@forestadmin/agent-client';

import TestableAgentBase from '../src/testable-agent-base';

describe('TestableAgentBase', () => {
  let overridePermissions: jest.Mock<Promise<void>, [PermissionsOverride]>;
  let client: TestableAgentBase;

  beforeEach(() => {
    overridePermissions = jest.fn().mockResolvedValue(undefined);
    client = new TestableAgentBase({
      httpRequester: {} as unknown as HttpRequester,
      overridePermissions,
    });
  });

  describe('overrideCollectionPermission', () => {
    it('should call overridePermissions with collection permissions', async () => {
      await client.overrideCollectionPermission('users', {
        browseEnabled: true,
        editEnabled: false,
      });

      expect(overridePermissions).toHaveBeenCalledWith({
        users: {
          collection: { browseEnabled: true, editEnabled: false },
          actions: {},
        },
      });
    });

    it('should not throw when overridePermissions is not provided', async () => {
      const clientWithout = new TestableAgentBase({
        httpRequester: {} as unknown as HttpRequester,
      });

      await expect(
        clientWithout.overrideCollectionPermission('users', { browseEnabled: true }),
      ).resolves.toBeUndefined();
    });
  });

  describe('overrideActionPermission', () => {
    it('should call overridePermissions with action permissions', async () => {
      await client.overrideActionPermission('users', 'sendEmail', {
        triggerEnabled: true,
        approvalRequired: true,
      });

      expect(overridePermissions).toHaveBeenCalledWith({
        users: {
          collection: {},
          actions: { sendEmail: { triggerEnabled: true, approvalRequired: true } },
        },
      });
    });

    it('should not throw when overridePermissions is not provided', async () => {
      const clientWithout = new TestableAgentBase({
        httpRequester: {} as unknown as HttpRequester,
      });

      await expect(
        clientWithout.overrideActionPermission('users', 'sendEmail', { triggerEnabled: true }),
      ).resolves.toBeUndefined();
    });
  });

  describe('clearPermissionOverride', () => {
    it('should call overridePermissions with an empty object', async () => {
      await client.clearPermissionOverride();

      expect(overridePermissions).toHaveBeenCalledWith({});
    });

    it('should not throw when overridePermissions is not provided', async () => {
      const clientWithout = new TestableAgentBase({
        httpRequester: {} as unknown as HttpRequester,
      });

      await expect(clientWithout.clearPermissionOverride()).resolves.toBeUndefined();
    });
  });
});
