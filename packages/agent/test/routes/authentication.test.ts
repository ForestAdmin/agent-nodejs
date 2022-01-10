import openidClient, { Issuer } from 'openid-client';
import { Context } from 'koa';
import factories from '../__factories__';
import Authentication from '../../src/routes/authentication';

describe('Authentication', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.build();
  const router = factories.router.mockAllMethods().build();
  const options = factories.forestAdminHttpDriverOptions.build();

  jest.mock('openid-client', () => ({ Issuer: {} }));

  const createAuthenticationRoutesUsingIssuerClientMock = async mock => {
    const authentication = new Authentication(services, dataSource, options);
    openidClient.Issuer = jest.fn().mockImplementation(() => ({
      Client: {
        register: jest.fn().mockReturnValue(mock),
      },
    })) as unknown as typeof Issuer;

    await authentication.bootstrap();

    return authentication;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrap', () => {
    describe('when the openid configuration cannot be fetched', () => {
      test('should throw an error', async () => {
        services.forestHTTPApi.getOpenIdConfiguration = jest.fn().mockImplementation(() => {
          throw new Error('Failed');
        });
        const authentication = new Authentication(services, dataSource, options);

        await expect(authentication.bootstrap()).rejects.toThrow(
          'Failed to fetch openid-configuration.',
        );
      });
    });

    describe('without a client id', () => {
      beforeEach(() => {
        services.forestHTTPApi.getOpenIdConfiguration = jest.fn().mockImplementation(() => ({
          registration_endpoint: 'http://fake-registration-endpoint',
        }));
      });

      describe('when the openid client cannot be created', () => {
        test('should throw an error', async () => {
          const clientRegisterSpy = jest.fn().mockImplementation(() => {
            throw new Error('Error thrown during register');
          });

          openidClient.Issuer = jest.fn().mockImplementation(() => ({
            Client: {
              register: clientRegisterSpy,
            },
          })) as unknown as typeof Issuer;
          const authentication = new Authentication(services, dataSource, options);

          await expect(authentication.bootstrap()).rejects.toThrow(
            'Failed to create the openid client.',
          );
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

          const authentication = new Authentication(services, dataSource, options);

          await expect(authentication.bootstrap()).resolves.not.toThrow();
          expect(clientRegisterSpy).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('with a client id', () => {
      beforeEach(() => {
        services.forestHTTPApi.getOpenIdConfiguration = jest.fn().mockImplementation(() => ({
          registration_endpoint: 'http://fake-registration-endpoint',
        }));
      });

      describe('when the openid client cannot be created', () => {
        test('should throw an error', async () => {
          const clientConstructorSpy = jest.fn().mockImplementation(() => {
            throw new Error('Failed to create client');
          });
          openidClient.Issuer = jest.fn().mockImplementation(() => ({
            Client: clientConstructorSpy,
          })) as unknown as typeof Issuer;
          const optionsOverride = { ...options, clientId: 'xx' };
          const authentication = new Authentication(services, dataSource, optionsOverride);

          await expect(authentication.bootstrap()).rejects.toThrow(
            'Failed to create the openid client.',
          );
          expect(clientConstructorSpy).toHaveBeenCalledTimes(1);
        });
      });

      describe('when the openid client can be created', () => {
        test('should resolve', async () => {
          const clientConstructorSpy = jest.fn().mockReturnValue({});
          openidClient.Issuer = jest.fn().mockImplementation(() => ({
            Client: clientConstructorSpy,
          })) as unknown as typeof Issuer;
          const optionsOverride = { ...options, clientId: 'xx' };
          const authentication = new Authentication(services, dataSource, optionsOverride);

          await expect(authentication.bootstrap()).resolves.not.toThrow();
          expect(clientConstructorSpy).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('setupPublicRoutes', () => {
      test('should register authentication related public routes', async () => {
        const authentication = new Authentication(services, dataSource, options);
        authentication.setupPublicRoutes(router);

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
        const context = { response: {}, request: { body: { renderingId: '1' } } } as Context;

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

        const context = {
          response: {},
          request: { body: { renderingId: 'somethingInvalid' } },
          throw: jest.fn(),
        } as unknown as Context;
        await authentication.handleAuthentication(context);

        expect(context.throw).toHaveBeenCalledWith(400, 'Failed to retrieve authorization url.');
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
        services.forestHTTPApi.getUserAuthorizationInformations = jest.fn().mockReturnValue(user);
        const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
          callback: jest.fn().mockReturnValue({}),
        });

        interface PartialContext {
          response: { body?: { token?: string; tokenData?: string } };
          request: unknown;
        }
        const context: PartialContext = {
          response: {},
          request: { query: { state: '{"renderingId": 1}' } },
        };
        await authentication.handleAuthenticationCallback(context as unknown as Context);

        expect(context.response.body.token).toBeDefined();
        expect(context.response.body.tokenData).toBeDefined();
      });
    });

    describe('when authentication failed', () => {
      describe('when the request state is not a valid json', () => {
        it('should respond with an error', async () => {
          const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
            callback: jest.fn().mockReturnValue({}),
          });

          const context = {
            response: {},
            request: { query: { state: '{"rendeId":' } },
            throw: jest.fn(),
          } as unknown as Context;
          await authentication.handleAuthenticationCallback(context);

          expect(context.throw).toHaveBeenCalledWith(400, 'Failed to parse renderingId.');
        });
      });

      describe('when the fetch of user informations failed', () => {
        it('should respond with an error', async () => {
          services.forestHTTPApi.getUserAuthorizationInformations = jest
            .fn()
            .mockImplementation(() => {
              throw new Error('Failed !');
            });
          const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
            callback: jest.fn().mockReturnValue({}),
          });

          const context = {
            response: {},
            request: { query: { state: '{"renderingId": 1}' } },
            throw: jest.fn(),
          } as unknown as Context;
          await authentication.handleAuthenticationCallback(context);

          expect(context.throw).toHaveBeenCalledWith(500, 'Failed to fetch user informations.');
        });
      });

      describe('when the provided user does not allow to sign a token', () => {
        it('should respond with an error', async () => {
          services.forestHTTPApi.getUserAuthorizationInformations = jest
            .fn()
            .mockResolvedValue(null);
          const authentication = await createAuthenticationRoutesUsingIssuerClientMock({
            callback: jest.fn().mockReturnValue({}),
          });

          const context = {
            response: {},
            request: { query: { state: '{"renderingId": 1}' } },
            throw: jest.fn(),
          } as unknown as Context;
          await authentication.handleAuthenticationCallback(context);

          expect(context.throw).toHaveBeenCalledWith(
            400,
            'Failed to create token with forestadmin-server.',
          );
        });
      });
    });
  });

  describe('handleAuthenticationLogout', () => {
    test('should return a 204', async () => {
      const authentication = new Authentication(services, dataSource, options);

      const context = {
        response: {},
      } as Context;
      await authentication.handleAuthenticationLogout(context);

      expect(context.response.status).toEqual(204);
    });
  });
});
