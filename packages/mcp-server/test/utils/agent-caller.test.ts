import type { ForestServerClient } from '../../src/http-client';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import InProcessHttpRequester from '../../src/in-process-http-requester';
import buildClient, { buildClientWithActions } from '../../src/utils/agent-caller';
import { fetchForestSchema, getActionEndpoints } from '../../src/utils/schema-fetcher';
import createMockForestServerClient from '../helpers/forest-server-client';

jest.mock('../../src/utils/schema-fetcher');
jest.mock('@forestadmin/agent-client', () => {
  const actual = jest.requireActual('@forestadmin/agent-client');

  return { ...actual, createRemoteAgentClient: jest.fn(actual.createRemoteAgentClient) };
});

const mockCreateRemoteAgentClient = createRemoteAgentClient as jest.MockedFunction<
  typeof createRemoteAgentClient
>;

describe('buildClient', () => {
  it('should create a remote agent client with the token from authInfo', () => {
    const request = {
      authInfo: {
        token: 'test-auth-token',
        extra: {
          userId: 123,
          renderingId: 456,
          environmentId: 789,
          projectId: 101,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request);

    expect(result.rpcClient).toBeDefined();
    expect(typeof result.rpcClient.collection).toBe('function');
  });

  it('should return authData from request.authInfo.extra', () => {
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          userId: 999,
          renderingId: 888,
          environmentId: 777,
          projectId: 666,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request);

    expect(result.authData).toEqual({
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
          environmentApiEndpoint: 'http://custom-agent:4000',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request);

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
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request)).toThrow('Authentication token is missing');
  });

  it('should throw error when authInfo is missing', () => {
    const request = {} as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request)).toThrow('Authentication token is missing');
  });

  it('should throw error when environmentApiEndpoint is missing', () => {
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          userId: 123,
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request)).toThrow('Environment API endpoint is missing or invalid');
  });

  it('should throw error when environmentApiEndpoint is not a string', () => {
    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          environmentApiEndpoint: 12345, // number instead of string
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    expect(() => buildClient(request)).toThrow('Environment API endpoint is missing or invalid');
  });

  describe('when an agentDispatcher is provided', () => {
    const agentDispatcher = { request: jest.fn() };

    beforeEach(() => mockCreateRemoteAgentClient.mockClear());

    it('builds an in-process httpRequester instead of reaching a url', () => {
      const request = {
        authInfo: { token: 'test-token', extra: { environmentApiEndpoint: 'http://public:3310' } },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      buildClient(request, agentDispatcher);

      expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({ httpRequester: expect.any(InProcessHttpRequester) }),
      );
    });

    it('wires the in-process requester with an empty url when environmentApiEndpoint is absent', () => {
      const request = {
        authInfo: { token: 'test-token', extra: {} },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      buildClient(request, agentDispatcher);

      expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({ httpRequester: expect.any(InProcessHttpRequester), url: '' }),
      );
    });
  });

  it('does not build an httpRequester when no agentDispatcher is provided', () => {
    mockCreateRemoteAgentClient.mockClear();
    const request = {
      authInfo: { token: 'test-token', extra: { environmentApiEndpoint: 'http://localhost:3310' } },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    buildClient(request);

    expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith(
      expect.objectContaining({ httpRequester: undefined }),
    );
  });
});

describe('buildClientWithActions', () => {
  const mockFetchForestSchema = fetchForestSchema as jest.MockedFunction<typeof fetchForestSchema>;
  const mockGetActionEndpoints = getActionEndpoints as jest.MockedFunction<
    typeof getActionEndpoints
  >;
  let mockForestServerClient: jest.Mocked<ForestServerClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestServerClient = createMockForestServerClient();
  });

  it('should fetch the forest schema and get action endpoints', async () => {
    const mockSchema = {
      collections: [
        {
          name: 'users',
          actions: [{ name: 'Send Email', endpoint: '/forest/_actions/users/0/send-email' }],
        },
      ],
    };
    const mockActionEndpoints = {
      users: {
        'Send Email': {
          name: 'Send Email',
          endpoint: '/forest/_actions/users/0/send-email',
          id: 'Send@@@Email',
          hooks: { load: false, change: [] },
          fields: [],
        },
      },
    };

    mockFetchForestSchema.mockResolvedValue(mockSchema as never);
    mockGetActionEndpoints.mockReturnValue(mockActionEndpoints);

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await buildClientWithActions(request, mockForestServerClient);

    expect(mockFetchForestSchema).toHaveBeenCalledWith(mockForestServerClient);
    expect(mockGetActionEndpoints).toHaveBeenCalledWith(mockSchema);
  });

  it('should create a client with the action endpoints', async () => {
    const mockSchema = {
      collections: [
        {
          name: 'orders',
          actions: [
            { name: 'Refund', endpoint: '/forest/_actions/orders/0/refund' },
            { name: 'Ship', endpoint: '/forest/_actions/orders/1/ship' },
          ],
        },
      ],
    };
    const mockActionEndpoints = {
      orders: {
        Refund: {
          name: 'Refund',
          endpoint: '/forest/_actions/orders/0/refund',
          id: 'Refund',
          hooks: { load: false, change: [] },
          fields: [],
        },
        Ship: {
          name: 'Ship',
          endpoint: '/forest/_actions/orders/1/ship',
          id: 'Ship',
          hooks: { load: false, change: [] },
          fields: [],
        },
      },
    };

    mockFetchForestSchema.mockResolvedValue(mockSchema as never);
    mockGetActionEndpoints.mockReturnValue(mockActionEndpoints);

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = await buildClientWithActions(request, mockForestServerClient);

    expect(result.rpcClient).toBeDefined();
    expect(typeof result.rpcClient.collection).toBe('function');
  });

  it('should return authData from request', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);
    mockGetActionEndpoints.mockReturnValue({});

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          userId: 123,
          renderingId: 456,
          environmentId: 789,
          projectId: 101,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = await buildClientWithActions(request, mockForestServerClient);

    expect(result.authData).toEqual({
      userId: 123,
      renderingId: 456,
      environmentId: 789,
      projectId: 101,
      environmentApiEndpoint: 'http://localhost:3310',
    });
  });

  it('should throw error when token is missing', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);
    mockGetActionEndpoints.mockReturnValue({});

    const request = {
      authInfo: {
        extra: {
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await expect(buildClientWithActions(request, mockForestServerClient)).rejects.toThrow(
      'Authentication token is missing',
    );
  });

  it('passes the forestServer connection when url, token and renderingId are all present', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);
    mockGetActionEndpoints.mockReturnValue({});
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

    await buildClientWithActions(request, mockForestServerClient);

    expect(mockCreateRemoteAgentClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        forestServer: {
          serverUrl: 'https://api.forestadmin.com',
          serverToken: 'server-token',
          renderingId: 456,
        },
      }),
    );
  });

  it('omits the forestServer connection when forestServerToken is missing', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);
    mockGetActionEndpoints.mockReturnValue({});
    mockForestServerClient = createMockForestServerClient({
      forestServerUrl: 'https://api.forestadmin.com',
    });

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          renderingId: 456,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await buildClientWithActions(request, mockForestServerClient);

    expect(mockCreateRemoteAgentClient).toHaveBeenLastCalledWith(
      expect.objectContaining({ forestServer: undefined }),
    );
  });

  it('builds an in-process httpRequester when an agentDispatcher is provided', async () => {
    mockFetchForestSchema.mockResolvedValue({ collections: [] } as never);
    mockGetActionEndpoints.mockReturnValue({});
    const agentDispatcher = { request: jest.fn() };

    const request = {
      authInfo: { token: 'test-token', extra: { environmentApiEndpoint: 'http://public:3310' } },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    await buildClientWithActions(request, mockForestServerClient, agentDispatcher);

    expect(mockCreateRemoteAgentClient).toHaveBeenLastCalledWith(
      expect.objectContaining({ httpRequester: expect.any(InProcessHttpRequester) }),
    );
  });
});
