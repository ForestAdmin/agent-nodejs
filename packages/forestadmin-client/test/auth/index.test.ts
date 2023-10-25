import openidClient from 'openid-client';

import AuthService from '../../src/auth';
import { AuthenticationError } from '../../src/auth/errors';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server');
const serverQueryMock = ServerUtils.query as jest.Mock;

jest.mock('openid-client', () => {
  class FakeOpError extends Error {
    constructor(...params: ConstructorParameters<typeof openidClient.errors.OPError>) {
      super();
      Object.assign(this, params);
    }
  }

  return { Issuer: jest.fn(), errors: { OPError: FakeOpError } };
});
const issuerMock = openidClient.Issuer as unknown as jest.Mock;

describe('AuthService', () => {
  beforeEach(() => {
    serverQueryMock.mockClear();
    issuerMock.mockClear();
  });

  describe('init', () => {
    test('should instantiate a Client', async () => {
      // Mock the openid-client Issuer
      const fakeConfig = {};
      const fakeClient = {};
      const registerMock = jest.fn().mockReturnValue(fakeClient);

      serverQueryMock.mockResolvedValueOnce(fakeConfig);
      issuerMock.mockReturnValue({ Client: { register: registerMock } });

      // Build an openIdClient
      const options = factories.forestAdminClientOptions.build();
      const service = new AuthService(options);
      await service.init();

      expect(serverQueryMock).toHaveBeenCalledWith(
        options,
        'get',
        '/oidc/.well-known/openid-configuration',
      );
      expect(issuerMock).toHaveBeenCalledWith(fakeConfig);
      expect(registerMock).toHaveBeenCalledWith(
        { token_endpoint_auth_method: 'none' },
        { initialAccessToken: options.envSecret },
      );
    });
  });

  describe('getUserInfo', () => {
    test('should return the user info', async () => {
      serverQueryMock.mockResolvedValueOnce({
        data: {
          id: '1',
          attributes: {
            email: 'john.doe@email.com',
            first_name: 'John',
            last_name: 'Doe',
            teams: ['myTeam'],
            role: 'admin',
            permission_level: 'admin',
            tags: [{ key: 'tagKey', value: 'tagValue' }],
          },
        },
      });

      const options = factories.forestAdminClientOptions.build();
      const service = new AuthService(options);
      const userInfo = await service.getUserInfo(34, 'myAccessToken');

      expect(userInfo).toStrictEqual({
        id: 1,
        renderingId: 34,
        email: 'john.doe@email.com',
        firstName: 'John',
        lastName: 'Doe',
        team: 'myTeam',
        role: 'admin',
        permissionLevel: 'admin',
        tags: { tagKey: 'tagValue' },
      });

      expect(serverQueryMock).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/v2/renderings/34/authorization',
        { 'forest-token': 'myAccessToken' },
      );
    });
  });

  describe('once initialized', () => {
    let fakeClient: {
      authorizationUrl: jest.Mock;
      callback: jest.Mock;
    };
    let service: AuthService;

    beforeEach(async () => {
      fakeClient = {
        authorizationUrl: jest.fn(),
        callback: jest.fn(),
      };
      const fakeIssuer = {
        Client: { register: jest.fn().mockReturnValue(fakeClient) },
      };

      issuerMock.mockReturnValue(fakeIssuer);
      const options = factories.forestAdminClientOptions.build();
      service = new AuthService(options);
      await service.init();
    });

    describe('generateAuthorizationUrl', () => {
      test('should return the authorization url', async () => {
        fakeClient.authorizationUrl.mockResolvedValue('myAuthorizationUrl');

        const url = await service.generateAuthorizationUrl({
          scope: 'myScope',
          state: 'myState',
        });

        expect(url).toBe('myAuthorizationUrl');
        expect(fakeClient.authorizationUrl).toHaveBeenCalledWith({
          scope: 'myScope',
          state: 'myState',
        });
      });

      test('should throw if the client is not initialized', async () => {
        const options = factories.forestAdminClientOptions.build();
        const unitializedService = new AuthService(options);

        const fn = () =>
          unitializedService.generateAuthorizationUrl({
            scope: 'myScope',
            state: 'myState',
          });

        await expect(fn).rejects.toThrow('AuthService not initialized');
      });
    });

    describe('generateTokens', () => {
      test('should return the tokens', async () => {
        fakeClient.callback.mockResolvedValue({
          access_token: 'myAccessToken',
        });

        const tokens = await service.generateTokens({
          query: { code: 'myCode' },
          state: 'myState',
        });

        expect(tokens).toEqual({
          accessToken: 'myAccessToken',
        });
      });

      test('should throw if the client is not initialized', async () => {
        const options = factories.forestAdminClientOptions.build();
        const unitializedService = new AuthService(options);

        const fn = () =>
          unitializedService.generateTokens({
            query: { code: 'myCode' },
            state: 'myState',
          });

        await expect(fn).rejects.toThrow('AuthService not initialized');
      });

      test('should translate an OPError to an AuthenticationError', async () => {
        const opError = new openidClient.errors.OPError({
          error: 'myError',
          error_description: 'myErrorDescription',
          state: 'myState',
        });
        fakeClient.callback.mockRejectedValue(opError);

        const fn = () =>
          service.generateTokens({
            query: { code: 'myCode' },
            state: 'myState',
          });

        await expect(fn).rejects.toThrow(new AuthenticationError(opError));
      });

      test('should rethrow other errors', async () => {
        const error = new Error('myError');
        fakeClient.callback.mockRejectedValue(error);

        const fn = () =>
          service.generateTokens({
            query: { code: 'myCode' },
            state: 'myState',
          });

        await expect(fn).rejects.toThrow(error);
      });
    });
  });
});
