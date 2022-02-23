import { createMockContext } from '@shopify/jest-koa-mocks';
import openidClient, { Issuer } from 'openid-client';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import Authentication from '../../../src/routes/security/authentication';
import ForestHttpApi from '../../../src/utils/forest-http-api';

jest.mock('openid-client', () => ({ Issuer: jest.fn() }));
jest.mock('../../../src/utils/forest-http-api', () => ({
  getOpenIdIssuerMetadata: jest.fn(),
  getUserInformation: jest.fn(),
}));

describe('Authentication', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();
  const options = factories.forestAdminHttpDriverOptions.build();

  async function createAuthenticationRoutesUsingIssuerClientMock(mock: Record<string, jest.Mock>) {
    const authentication = new Authentication(services, options);

    (openidClient.Issuer as unknown as jest.Mock).mockImplementation(() => ({
      Client: {
        register: jest.fn().mockReturnValue(mock),
      },
    }));

    await authentication.bootstrap();

    return authentication;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrap', () => {
    describe('when the openid configuration cannot be fetched', () => {
      test('should throw an error', async () => {
        (ForestHttpApi.getOpenIdIssuerMetadata as jest.Mock).mockRejectedValue(
          new Error('Failed to fetch openid-configuration.'),
        );

        const authentication = new Authentication(services, options);

        await expect(authentication.bootstrap()).rejects.toThrow(
          'Failed to fetch openid-configuration.',
        );
      });
    });

    describe('without a client id', () => {
      beforeEach(() => {
        (ForestHttpApi.getOpenIdIssuerMetadata as jest.Mock).mockResolvedValue({
          registration_endpoint: 'http://fake-registration-endpoint',
        });
      });

      describe('when the openid client cannot be created', () => {
        test('should throw an error', async () => {
          const clientRegisterSpy = jest.fn().mockImplementation(() => {
            throw new Error('Error thrown during register.');
          });

          openidClient.Issuer = jest.fn().mockImplementation(() => ({
            Client: {
              register: clientRegisterSpy,
            },
          })) as unknown as typeof Issuer;
          const authentication = new Authentication(services, options);

          await expect(authentication.bootstrap()).rejects.toThrow('Error thrown during register.');
          expect(clientRegisterSpy).toHaveBeenCalledTimes(1);
        });
      });

      describe('when the openid client can be created', () => {
        test('should resolve', async () => {
          const clientRegisterSpy = jest.fn().mockReturnValue({});
          openidClient.Issuer = jest.fn().mockImplementation(() => ({
            Client: {
              register: clientRegisterSpy,
            },
          })) as unknown as typeof Issuer;

          const authentication = new Authentication(services, options);

          await expect(authentication.bootstrap()).resolves.not.toThrow();
          expect(clientRegisterSpy).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('with a client id', () => {
      beforeEach(() => {
        (ForestHttpApi.getOpenIdIssuerMetadata as jest.Mock).mockResolvedValue({
          registration_endpoint: 'http://fake-registration-endpoint',
        });
      });

      describe('when the openid client can be created', () => {
        test('should resolve', async () => {
          const clientConstructorSpy = jest.fn().mockReturnValue({});
          openidClient.Issuer = jest.fn().mockImplementation(() => ({
            Client: clientConstructorSpy,
          })) as unknown as typeof Issuer;
          const optionsOverride = { ...options, clientId: 'xx' };
          const authentication = new Authentication(services, optionsOverride);

          await expect(authentication.bootstrap()).resolves.not.toThrow();
          expect(clientConstructorSpy).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('setupRoutes', () => {
      test('should register authentication related public routes', async () => {
        const authentication = new Authentication(services, options);
        authentication.setupRoutes(router);

        expect(router.post).toHaveBeenCalledWith('/authentication', expect.any(Function));
        expect(router.get).toHaveBeenCalledWith('/authentication/callback', expect.any(Function));
        expect(router.post).toHaveBeenCalledWith('/authentication/logout', expect.any(Function));
      });
    });
  });

  describe('handleAuthentication', () => {
    describe('when the given renderingId is correct', () => {
      test('should respond with an authorization url', async () => {
        const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
          authorizationUrl: jest.fn().mockReturnValue('authorizationUrl'),
        });
        const context = createMockContext({
          requestBody: { renderingId: '1' },
        });

        await authentication.handleAuthentication(context);

        expect(context.response.body).toEqual({
          authorizationUrl: 'authorizationUrl',
        });
      });
    });

    describe('when the given renderingId is incorrect', () => {
      test('should response with a 400 error', async () => {
        const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
          authorizationUrl: jest.fn().mockReturnValue('authorizationUrl'),
        });

        const context = createMockContext({
          requestBody: {
            renderingId: 'somethingInvalid',
          },
        });

        await expect(authentication.handleAuthentication(context)).rejects.toThrow(
          'Rendering id must be a number',
        );
      });
    });
  });

  describe('handleAuthenticationCallback', () => {
    describe('when authentication is successful', () => {
      test('should response with a token', async () => {
        const user = {
          id: 1,
          email: 'hello@forest.admin',
          firstName: 'erlich',
          lastName: 'bachman',
          team: 'admin',
          renderingId: '1',
        };
        (ForestHttpApi.getUserInformation as jest.Mock).mockReturnValue(user);
        const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
          callback: jest.fn().mockReturnValue({}),
        });

        const context = createMockContext({
          customProperties: { query: { state: '{"renderingId": 1}' } },
        });
        await authentication.handleAuthenticationCallback(context);

        expect(context.response.body).toContainAllKeys(['token', 'tokenData']);
      });
    });

    describe('when authentication failed', () => {
      describe('when the request state is not a valid json', () => {
        it('should respond with an error', async () => {
          const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
            callback: jest.fn().mockReturnValue({}),
          });

          const context = createMockContext({
            customProperties: { query: { state: '{"rendeId":' } },
          });

          await expect(authentication.handleAuthenticationCallback(context)).rejects.toThrow(
            'Failed to retrieve renderingId from query[state]',
          );
        });
      });

      describe('when the fetch of user informations failed', () => {
        it('should respond with an error', async () => {
          (ForestHttpApi.getUserInformation as jest.Mock).mockRejectedValue(new Error('Failed !'));

          const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
            callback: jest.fn().mockReturnValue({}),
          });

          const context = createMockContext({
            customProperties: { query: { state: '{"renderingId": 1}' } },
          });

          await expect(authentication.handleAuthenticationCallback(context)).rejects.toThrow(
            'Failed !',
          );
        });
      });

      describe('when the provided user does not allow to sign a token', () => {
        it('should respond with an error', async () => {
          (ForestHttpApi.getUserInformation as jest.Mock) = jest.fn().mockResolvedValue(null);

          const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
            callback: jest.fn().mockReturnValue({}),
          });

          const context = createMockContext({
            customProperties: { query: { state: '{"renderingId": 1}' } },
          });

          await expect(authentication.handleAuthenticationCallback(context)).rejects.toThrow();
        });
      });
    });
  });

  describe('handleAuthenticationLogout', () => {
    test('should return a 204', async () => {
      const authentication = new Authentication(services, options);

      const context = createMockContext();

      await authentication.handleAuthenticationLogout(context);

      expect(context.response.status).toEqual(HttpCode.NoContent);
    });
  });
});
