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

    it('should only log the error and not throw if creating the client throws', async () => {
      serverQueryMock.mockImplementationOnce(() => {
        throw new Error('myError');
      });

      const options = factories.forestAdminClientOptions.build();
      const service = new AuthService(options);

      await expect(service.init()).resolves.toBe(undefined);
      expect(options.logger).toHaveBeenCalledWith(
        'Warn',
        'Error while registering the authentication client. Authentication might not work: myError',
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

  describe('if initialization failed', () => {
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
    });

    describe('generateAuthorizationUrl', () => {
      it('should try to reinit the client if initialization failed', async () => {
        fakeClient.authorizationUrl.mockResolvedValue('myAuthorizationUrl');

        await service.generateAuthorizationUrl({
          scope: 'myScope',
          state: 'myState',
        });

        expect(issuerMock).toHaveBeenCalledTimes(1);
        expect(fakeClient.authorizationUrl).toHaveBeenCalledTimes(1);
      });

      it('should throw an error if reinitialization failed', async () => {
        fakeClient.authorizationUrl.mockResolvedValue('myAuthorizationUrl');
        const error = new Error('myError');
        issuerMock.mockImplementationOnce(() => {
          throw error;
        });

        const fn = () =>
          service.generateAuthorizationUrl({
            scope: 'myScope',
            state: 'myState',
          });

        await expect(fn).rejects.toEqual(error);
      });
    });

    describe('generateTokens', () => {
      it('should try to reinit the client if initialization failed', async () => {
        fakeClient.callback.mockResolvedValue({
          access_token: 'myAccessToken',
        });

        await service.generateTokens({
          query: { code: 'myCode' },
          state: 'myState',
        });

        expect(issuerMock).toHaveBeenCalledTimes(1);
        expect(fakeClient.callback).toHaveBeenCalledTimes(1);
      });

      it('should throw an error if reinitialization failed', async () => {
        fakeClient.authorizationUrl.mockResolvedValue('myAuthorizationUrl');
        const error = new Error('myError');
        issuerMock.mockImplementationOnce(() => {
          throw error;
        });

        await expect(
          service.generateTokens({
            query: { code: 'myCode' },
            state: 'myState',
          }),
        ).rejects.toEqual(error);
      });
    });
  });
});
