import nock from 'nock';

import makeCreateApprovalRequest from '../src/approval-request-creator';
import RemoteAgentClient from '../src/domains/remote-agent-client';
import {
  ActivityLogSource,
  type AgentDispatchRequest,
  type AgentDispatcher,
  createRemoteAgentClient,
} from '../src/index';

jest.mock('../src/approval-request-creator');

const mockMakeCreateApprovalRequest = makeCreateApprovalRequest as jest.MockedFunction<
  typeof makeCreateApprovalRequest
>;

describe('createRemoteAgentClient', () => {
  let requestPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    requestPath = '';
  });

  afterEach(() => nock.cleanAll());

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

  it('should expose the schema it was given', () => {
    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      schema: [
        {
          name: 'users',
          fields: [{ field: 'address', reference: 'User.address.id' }],
          actions: [
            {
              id: 'users-send-email',
              name: 'Send Email',
              endpoint: '/forest/actions/send-email',
              hooks: { load: false, change: [] },
              fields: [],
            },
          ],
        },
      ],
    });

    const users = client.schema.collection('users');
    expect(users.actions['Send Email'].endpoint).toBe('/forest/actions/send-email');
    expect(users.relation('address')).toEqual({ polymorphic: false, target: 'User.address' });
    expect(users.relation('ghost')).toBeNull();
    expect(client.schema.collection('ghost').actions).toEqual({});
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

  it('files approval requests under the source of the activity log', () => {
    createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      forestServer: {
        serverUrl: 'https://api.forestadmin.com',
        serverToken: 'server-token',
        renderingId: 42,
      },
      activityLog: { source: ActivityLogSource.BFF },
    });

    expect(mockMakeCreateApprovalRequest).toHaveBeenCalledWith({
      forestServerUrl: 'https://api.forestadmin.com',
      forestServerToken: 'server-token',
      renderingId: 42,
      source: 'BFF',
    });
  });

  it('refuses an activity log without the Forest server connection it is written to', () => {
    expect(() =>
      createRemoteAgentClient({
        url: 'https://api.example.com',
        token: 'test-token',
        activityLog: { source: ActivityLogSource.MCP },
      }),
    ).toThrow('An activity log needs the Forest server connection it is written to');
  });

  it('does not wire createApprovalRequest when forestServer is omitted', () => {
    createRemoteAgentClient({ url: 'https://api.example.com', token: 'test-token' });

    expect(mockMakeCreateApprovalRequest).not.toHaveBeenCalled();
  });

  it('should send the default timezone when none is provided', async () => {
    const scope = nock('https://api.example.com')
      .get('/forest/users/count')
      .query(true)
      .reply(200, function handler(this: { req: { path: string } }) {
        requestPath = this.req.path;

        return { count: 0 };
      });

    const client = createRemoteAgentClient({ url: 'https://api.example.com', token: 'test-token' });
    await client.collection('users').count();

    scope.done();
    expect(new URL(requestPath, 'https://api.example.com').searchParams.get('timezone')).toBe(
      'Europe/Paris',
    );
  });

  it('should send the provided timezone on agent requests', async () => {
    const scope = nock('https://api.example.com')
      .get('/forest/users/count')
      .query(true)
      .reply(200, function handler(this: { req: { path: string } }) {
        requestPath = this.req.path;

        return { count: 0 };
      });

    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      timezone: 'Asia/Tokyo',
    });
    await client.collection('users').count();

    scope.done();
    expect(new URL(requestPath, 'https://api.example.com').searchParams.get('timezone')).toBe(
      'Asia/Tokyo',
    );
  });

  it('should provide a working client that can access collections', () => {
    const client = createRemoteAgentClient({
      url: 'https://api.example.com',
      token: 'test-token',
      schema: [
        {
          name: 'products',
          actions: [
            {
              name: 'Archive',
              endpoint: '/forest/actions/archive',
              id: 'Archive',
              hooks: { load: false, change: [] },
              fields: [],
            },
          ],
        },
      ],
    });

    const collection = client.collection('products');
    expect(collection).toBeDefined();

    const segment = collection.segment('active');
    expect(segment).toBeDefined();

    const relation = collection.relation('categories', 1);
    expect(relation).toBeDefined();
  });

  describe('when the agent lives in the same process', () => {
    const answeringDispatcher = () => {
      const requests: AgentDispatchRequest[] = [];
      const dispatcher: AgentDispatcher = {
        request: async request => {
          requests.push(request);

          return { status: 200, body: request.path.endsWith('/count') ? { count: 3 } : {} };
        },
      };

      return { dispatcher, requests };
    };

    it('should reach the agent through the dispatcher, without an url', async () => {
      const { dispatcher, requests } = answeringDispatcher();

      const client = createRemoteAgentClient({ token: 'test-token', dispatcher });

      await expect(client.collection('users').count()).resolves.toBe(3);
      expect(requests).toEqual([
        expect.objectContaining({
          method: 'get',
          path: '/forest/users/count',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      ]);
    });

    it("should bound a call with the client's timeout, and an execute with its own", async () => {
      const { dispatcher, requests } = answeringDispatcher();
      const client = createRemoteAgentClient({
        token: 'test-token',
        dispatcher,
        timeoutMs: 2500,
        schema: [
          {
            name: 'users',
            actions: [
              {
                id: 'users-ban',
                name: 'Ban',
                endpoint: '/forest/_actions/users/0/ban',
                hooks: { load: false, change: [] },
                fields: [],
              },
            ],
          },
        ],
      });

      await client.collection('users').count();
      await client.collection('users').executeAction('Ban', { recordIds: ['1'] });

      expect(requests.map(({ path, timeoutMs }) => ({ path, timeoutMs }))).toEqual([
        { path: '/forest/users/count', timeoutMs: 2500 },
        { path: '/forest/_actions/users/0/ban', timeoutMs: 30_000 },
      ]);
    });
  });

  it('should refuse a client with neither the agent url nor a dispatcher', () => {
    expect(() => createRemoteAgentClient({ token: 'test-token' })).toThrow(
      'An agent client needs the agent url or an in-process dispatcher',
    );
  });
});
