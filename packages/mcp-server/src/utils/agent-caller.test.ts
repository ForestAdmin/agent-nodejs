import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { createRemoteAgentClient } from '@forestadmin-experimental/agent-nodejs-testing';

import buildClient from './agent-caller';

jest.mock('@forestadmin-experimental/agent-nodejs-testing');

const mockCreateRemoteAgentClient = createRemoteAgentClient as jest.MockedFunction<
  typeof createRemoteAgentClient
>;

describe('buildClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a remote agent client with the token from authInfo', () => {
    const mockRpcClient = { collection: jest.fn() };
    mockCreateRemoteAgentClient.mockReturnValue(
      mockRpcClient as unknown as ReturnType<typeof createRemoteAgentClient>,
    );

    const request = {
      authInfo: {
        token: 'test-auth-token',
        extra: {
          userId: 123,
          renderingId: '456',
          environmentId: 789,
          projectId: 101,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request);

    expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith({
      token: 'test-auth-token',
      url: 'http://localhost:3310',
      actionEndpoints: {},
    });
    expect(result.rpcClient).toBe(mockRpcClient);
  });

  it('should return authData from request.authInfo.extra', () => {
    const mockRpcClient = { collection: jest.fn() };
    mockCreateRemoteAgentClient.mockReturnValue(
      mockRpcClient as unknown as ReturnType<typeof createRemoteAgentClient>,
    );

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          userId: 999,
          renderingId: '888',
          environmentId: 777,
          projectId: 666,
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request);

    expect(result.authData).toEqual({
      userId: 999,
      renderingId: '888',
      environmentId: 777,
      projectId: 666,
      environmentApiEndpoint: 'http://localhost:3310',
    });
  });

  it('should use environmentApiEndpoint from authInfo.extra', () => {
    const mockRpcClient = { collection: jest.fn() };
    mockCreateRemoteAgentClient.mockReturnValue(
      mockRpcClient as unknown as ReturnType<typeof createRemoteAgentClient>,
    );

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          environmentApiEndpoint: 'http://custom-agent:4000',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    buildClient(request);

    expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith({
      token: 'test-token',
      url: 'http://custom-agent:4000',
      actionEndpoints: {},
    });
  });

  it('should handle undefined token gracefully', () => {
    const mockRpcClient = { collection: jest.fn() };
    mockCreateRemoteAgentClient.mockReturnValue(
      mockRpcClient as unknown as ReturnType<typeof createRemoteAgentClient>,
    );

    const request = {
      authInfo: {
        extra: {
          environmentApiEndpoint: 'http://localhost:3310',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    buildClient(request);

    expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith({
      token: undefined,
      url: 'http://localhost:3310',
      actionEndpoints: {},
    });
  });

  it('should handle undefined authInfo gracefully', () => {
    const mockRpcClient = { collection: jest.fn() };
    mockCreateRemoteAgentClient.mockReturnValue(
      mockRpcClient as unknown as ReturnType<typeof createRemoteAgentClient>,
    );

    const request = {} as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    const result = buildClient(request);

    expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith({
      token: undefined,
      url: undefined,
      actionEndpoints: {},
    });
    expect(result.authData).toBeUndefined();
  });

  it('should handle undefined environmentApiEndpoint gracefully', () => {
    const mockRpcClient = { collection: jest.fn() };
    mockCreateRemoteAgentClient.mockReturnValue(
      mockRpcClient as unknown as ReturnType<typeof createRemoteAgentClient>,
    );

    const request = {
      authInfo: {
        token: 'test-token',
        extra: {
          userId: 123,
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

    buildClient(request);

    expect(mockCreateRemoteAgentClient).toHaveBeenCalledWith({
      token: 'test-token',
      url: undefined,
      actionEndpoints: {},
    });
  });
});
