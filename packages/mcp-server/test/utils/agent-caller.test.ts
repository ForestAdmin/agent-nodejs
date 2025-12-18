import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import buildClient from '../../src/utils/agent-caller';

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
});
