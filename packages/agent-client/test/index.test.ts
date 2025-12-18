import RemoteAgentClient from '../src/domains/remote-agent-client';
import { createRemoteAgentClient } from '../src/index';

describe('createRemoteAgentClient', () => {
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
    const actionEndpoints = {
      users: {
        sendEmail: { name: 'Send Email', endpoint: '/forest/actions/send-email' },
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

  it('should provide a working client that can access collections', () => {
    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      actionEndpoints: {
        products: {
          archive: { name: 'Archive', endpoint: '/forest/actions/archive' },
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
