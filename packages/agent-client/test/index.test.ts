import makeCreateApprovalRequest from '../src/approval-request-creator';
import RemoteAgentClient from '../src/domains/remote-agent-client';
import { type ActionEndpointsByCollection, createRemoteAgentClient } from '../src/index';

jest.mock('../src/approval-request-creator');

const mockMakeCreateApprovalRequest = makeCreateApprovalRequest as jest.MockedFunction<
  typeof makeCreateApprovalRequest
>;

describe('createRemoteAgentClient', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create a RemoteAgentClient instance', () => {
    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
    });

    expect(client).toBeInstanceOf(RemoteAgentClient);
  });

  it('should create a client without token', () => {
    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
    });

    expect(client).toBeInstanceOf(RemoteAgentClient);
  });

  it('should pass action endpoints to the client', () => {
    const actionEndpoints: ActionEndpointsByCollection = {
      users: {
        sendEmail: {
          name: 'Send Email',
          endpoint: '/forest/actions/send-email',
          id: 'Send@@@Email',
          hooks: { load: false, change: [] },
          fields: [],
        },
      },
    };

    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      actionEndpoints,
    });

    const collection = client.collection('users');
    expect(collection).toBeDefined();
  });

  it('should pass overridePermissions function to the client', async () => {
    const overridePermissions = jest.fn().mockResolvedValue(undefined);

    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      overridePermissions,
    });

    await client.overrideCollectionPermission('users' as any, { browseEnabled: true });

    expect(overridePermissions).toHaveBeenCalledWith({
      users: {
        collection: { browseEnabled: true },
        actions: {},
      },
    });
  });

  it('wires createApprovalRequest from the forestServer fields when provided', () => {
    createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      forestServer: {
        serverUrl: 'https://api.forestadmin.com',
        serverToken: 'server-token',
        renderingId: 42,
      },
    });

    expect(mockMakeCreateApprovalRequest).toHaveBeenCalledWith({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
    });
  });

  it('does not wire createApprovalRequest when forestServer is omitted', () => {
    createRemoteAgentClient({ url: 'https://api.example.com', token: 'test-token' });

    expect(mockMakeCreateApprovalRequest).not.toHaveBeenCalled();
  });

  it('should provide a working client that can access collections', () => {
    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      actionEndpoints: {
        products: {
          archive: {
            name: 'Archive',
            endpoint: '/forest/actions/archive',
            id: 'Archive',
            hooks: { load: false, change: [] },
            fields: [],
          },
        },
      },
    });

    const collection = client.collection('products');
    expect(collection).toBeDefined();

    const segment = collection.segment('active');
    expect(segment).toBeDefined();

    const relation = collection.relation('categories', 1);
    expect(relation).toBeDefined();
  });
});
