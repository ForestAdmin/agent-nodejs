import type HttpRequester from '../../src/http-requester';

import RemoteAgentClient from '../../src/domains/remote-agent-client';

jest.mock('../../src/http-requester');

describe('RemoteAgentClient', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let client: RemoteAgentClient;
  let overridePermissionsMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
      stream: jest.fn(),
    } as any;
    overridePermissionsMock = jest.fn().mockResolvedValue(undefined);
    client = new RemoteAgentClient({
      httpRequester,
      actionEndpoints: {
        users: {
          sendEmail: { name: 'Send Email', endpoint: '/forest/actions/send-email' },
        },
      },
      overridePermissions: overridePermissionsMock,
    });
  });

  describe('constructor', () => {
    it('should create an instance without parameters', () => {
      const emptyClient = new RemoteAgentClient();
      expect(emptyClient).toBeInstanceOf(RemoteAgentClient);
    });

    it('should create an instance with all parameters', () => {
      expect(client).toBeInstanceOf(RemoteAgentClient);
    });
  });

  describe('collection', () => {
    it('should return a Collection instance', () => {
      const collection = client.collection('users');
      expect(collection).toBeDefined();
    });

    it('should pass action endpoints to collection', () => {
      const collection = client.collection('users');
      expect(collection).toBeDefined();
    });
  });

  describe('overrideCollectionPermission', () => {
    it('should call overridePermissions with collection permissions', async () => {
      await client.overrideCollectionPermission('users', {
        browseEnabled: true,
        editEnabled: false,
      });

      expect(overridePermissionsMock).toHaveBeenCalledWith({
        users: {
          collection: {
            browseEnabled: true,
            editEnabled: false,
          },
          actions: {},
        },
      });
    });

    it('should not throw if overridePermissions is not provided', async () => {
      const clientWithoutOverride = new RemoteAgentClient({
        httpRequester,
      });

      await expect(
        clientWithoutOverride.overrideCollectionPermission('users', { browseEnabled: true }),
      ).resolves.toBeUndefined();
    });
  });

  describe('overrideActionPermission', () => {
    it('should call overridePermissions with action permissions', async () => {
      await client.overrideActionPermission('users', 'sendEmail', {
        triggerEnabled: true,
        approvalRequired: true,
      });

      expect(overridePermissionsMock).toHaveBeenCalledWith({
        users: {
          collection: {},
          actions: {
            sendEmail: {
              triggerEnabled: true,
              approvalRequired: true,
            },
          },
        },
      });
    });

    it('should not throw if overridePermissions is not provided', async () => {
      const clientWithoutOverride = new RemoteAgentClient({
        httpRequester,
      });

      await expect(
        clientWithoutOverride.overrideActionPermission('users', 'sendEmail', {
          triggerEnabled: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('clearPermissionOverride', () => {
    it('should call overridePermissions with empty object', async () => {
      await client.clearPermissionOverride();

      expect(overridePermissionsMock).toHaveBeenCalledWith({});
    });

    it('should not throw if overridePermissions is not provided', async () => {
      const clientWithoutOverride = new RemoteAgentClient({
        httpRequester,
      });

      await expect(clientWithoutOverride.clearPermissionOverride()).resolves.toBeUndefined();
    });
  });
});
