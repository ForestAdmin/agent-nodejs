import type { ForestServerClient } from '../../src/http-client';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { ActivityLogSource, createRemoteAgentClient } from '@forestadmin/agent-client';

import buildClient, { buildClientWithActions } from '../../src/utils/agent-caller';
import { fetchForestSchema } from '../../src/utils/schema-fetcher';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/schema-fetcher');
jest.mock('@forestadmin/agent-client', () => {
  const actual = jest.requireActual('@forestadmin/agent-client');

  return { ...actual, createRemoteAgentClient: jest.fn(actual.createRemoteAgentClient) };
});

const mockCreateRemoteAgentClient = createRemoteAgentClient as jest.MockedFunction<
  typeof createRemoteAgentClient
>;

const logger = jest.fn();
const caller = { forestServerToken: 'forest-token', renderingId: 456 };

function toolContext(forestServerClient: ForestServerClient = createMockForestServerClient()) {
  return { forestServerClient, logger };
}

describe('activity logging', () => {
  it('should write the activity log to the Forest server with the caller identity, as MCP', () => {
    const forestServerClient = createMockForestServerClient({
      forestServerUrl: 'https://api.forestadmin.com',
    });
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          renderingId: 456,
          forestServerToken: 'forest-token',
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    buildClient(request, toolContext(forestServerClient));

    expect(mockCreateRemoteAgentClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        forestServer: {
          serverUrl: 'https://api.forestadmin.com',
          serverToken: 'forest-token',
          renderingId: '456',
        },
        activityLog: { source: ActivityLogSource.MCP, logger },
      }),
    );
  });
});

describe('buildClient', () => {
  it('should create a remote agent client with the token from authInfo', () => {
    const request = {
      authInfo: {
        token: 'test-auth-token',
        extra: {
          ...caller,
          userId: 123,
          renderingId: 456,
          environmentId: 789,
          projectId: 101,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request, toolContext());

    expect(result.rpcClient).toBeDefined();
    expect(typeof result.rpcClient.collection).toBe('function');
  });

  it('should return authData from request.authInfo.extra', () => {
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          userId: 999,
          renderingId: 888,
          environmentId: 777,
          projectId: 666,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request, toolContext());

    expect(result.authData).toEqual({
      ...caller,
      userId: 999,
      renderingId: 888,
      environmentId: 777,
      projectId: 666,
      environmentApiEndpoint: 'http://localhost:3310',
    });
  });

  it('should create client that can access collections', () => {
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          environmentApiEndpoint: 'http://custom-agent:4000',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request, toolContext());

    // The client should have the collection method
    expect(result.rpcClient.collection).toBeDefined();
    // Calling collection should return a collection object
    const collection = result.rpcClient.collection('users');
    expect(collection).toBeDefined();
    expect(typeof collection.list).toBe('function');
    expect(typeof collection.count).toBe('function');
  });

  it('should throw error when token is missing', () => {
    const request = {
      authInfo: {
        extra: {
          ...caller,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request, toolContext())).toThrow('Authentication token is missing');
  });

  it('refuses to build a client for a request carrying no rendering', () => {
    mockCreateRemoteAgentClient.mockClear();
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          forestServerToken: 'forest-token',
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request, toolContext())).toThrow(
      'Invalid or missing renderingId in authentication context',
    );
    expect(mockCreateRemoteAgentClient).not.toHaveBeenCalled();
  });

  it('should throw error when authInfo is missing', () => {
    const request = {} as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request, toolContext())).toThrow('Authentication token is missing');
  });

  it('should throw error when environmentApiEndpoint is missing', () => {
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          userId: 123,
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request, toolContext())).toThrow(
      'Environment API endpoint is missing or invalid',
    );
  });

  it('should throw error when environmentApiEndpoint is not a string', () => {
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          environmentApiEndpoint: 12345, // number instead of string
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request, toolContext())).toThrow(
      'Environment API endpoint is missing or invalid',
    );
  });

  describe('when an agentDispatcher is provided', () => {
    const agentDispatcher = { request: jest.fn() };

    beforeEach(() => mockCreateRemoteAgentClient.mockClear());

    it('reaches the agent through the dispatcher instead of the url', () => {
      const request = {
        authInfo: {
          token: 'test-token',
          extra: {
            ...caller,
            environmentApiEndpoint: 'http://public:3310',
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      buildClient(request, { ...toolContext(), agentDispatcher });

      expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({ dispatcher: agentDispatcher }),
      );
    });

    it('reaches the same agent path in-process as over HTTP for a record id holding a space', async () => {
      agentDispatcher.request.mockResolvedValue({ status: 200, body: {}, text: '{}' });
      const request = {
        authInfo: { token: 'test-token', extra: { ...caller } },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      const { rpcClient } = buildClient(request, { ...toolContext(), agentDispatcher });
      await rpcClient.collection('orders').getOne('A B');

      expect(agentDispatcher.request).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/forest/orders/A%20B' }),
      );
    });

    it('needs no url when environmentApiEndpoint is absent', () => {
      const request = {
        authInfo: {
          token: 'test-token',
          extra: {
            ...caller,
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      buildClient(request, { ...toolContext(), agentDispatcher });

      expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({ dispatcher: agentDispatcher, url: undefined }),
      );
    });
  });

  it('reaches the url when no agentDispatcher is provided', () => {
    mockCreateRemoteAgentClient.mockClear();
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    buildClient(request, toolContext());

    expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith(
      expect.objectContaining({ dispatcher: undefined, url: 'http://localhost:3310' }),
    );
  });
});

describe('buildClientWithActions', () => {
  const mockFetchForestSchema = fetchForestSchema as jest.MockedFunction<typeof fetchForestSchema>;
  let mockForestServerClient: jest.Mocked<ForestServerClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestServerClient = createMockForestServerClient();
  });

  it('should give the client the collections of the forest schema', async () => {
    const mockSchema = {
      collections: [
        {
          name: 'users',
          actions: [{ name: 'Send Email', endpoint: '/forest/_actions/users/0/send-email' }],
        },
      ],
    };
    mockFetchForestSchema.mockResolvedValue(mockSchema as never);

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await buildClientWithActions(request, { forestServerClient: mockForestServerClient, logger });

    expect(mockFetchForestSchema).toHaveBeenCalledWith(mockForestServerClient);
    expect(mockCreateRemoteAgentClient).toHaveBeenLastCalledWith(
      expect.objectContaining({ schema: mockSchema.collections }),
    );
  });

  it('should return authData from request', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          userId: 123,
          renderingId: 456,
          environmentId: 789,
          projectId: 101,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = await buildClientWithActions(request, {
      forestServerClient: mockForestServerClient,
      logger,
    });

    expect(result.authData).toEqual({
      ...caller,
      userId: 123,
      renderingId: 456,
      environmentId: 789,
      projectId: 101,
      environmentApiEndpoint: 'http://localhost:3310',
    });
  });

  it('should throw error when token is missing', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);

    const request = {
      authInfo: {
        extra: {
          ...caller,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await expect(
      buildClientWithActions(request, { forestServerClient: mockForestServerClient, logger }),
    ).rejects.toThrow('Authentication token is missing');
  });

  it('passes the forestServer connection when url, token and renderingId are all present', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);
    mockForestServerClient = createMockForestServerClient({
      forestServerUrl: 'https://api.forestadmin.com',
    });

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          renderingId: 456,
          environmentApiEndpoint: 'http://localhost:3310',
          forestServerToken: 'server-token',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await buildClientWithActions(request, { forestServerClient: mockForestServerClient, logger });

    expect(mockCreateRemoteAgentClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        forestServer: {
          serverUrl: 'https://api.forestadmin.com',
          serverToken: 'server-token',
          renderingId: '456',
        },
      }),
    );
  });

  it('refuses to build a client for a request carrying no Forest server token', async () => {
    mockCreateRemoteAgentClient.mockClear();
    const request = {
      authInfo: {
        token: 'test-token',
        extra: { renderingId: 456, environmentApiEndpoint: 'http://localhost:3310' },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await expect(
      buildClientWithActions(request, { forestServerClient: mockForestServerClient, logger }),
    ).rejects.toThrow('Invalid or missing forestServerToken in authentication context');
    expect(mockCreateRemoteAgentClient).not.toHaveBeenCalled();
  });

  it('reaches the agent through the dispatcher when one is provided', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);
    const agentDispatcher = { request: jest.fn() };

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          ...caller,
          environmentApiEndpoint: 'http://public:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await buildClientWithActions(request, {
      forestServerClient: mockForestServerClient,
      logger,
      agentDispatcher,
    });

    expect(mockCreateRemoteAgentClient).toHaveBeenLastCalledWith(
      expect.objectContaining({ dispatcher: agentDispatcher }),
    );
  });
});
