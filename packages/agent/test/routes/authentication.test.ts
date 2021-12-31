import { Context } from 'koa';
import Authentication from '../../src/routes/authentication';
import { openidClientRegisterMock } from '../__mocks__/openid-client';
import superagentMock from '../__mocks__/superagent';
import factories from '../__factories__';

describe('Authentication', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.build();
  const router = factories.router.mockAllMethods().build();
  const options = factories.forestAdminHttpDriverOptions.build({
    prefix: '/forest-test',
    authSecret: 'xxxxxxxxxx',
    envSecret: 'yyyyyyyyyy',
    agentUrl: 'http://localhost:1234',
  });
  const openidValidConfiguration = {
    registration_endpoint: 'http://my_registration_endpoint.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // superagent has a dedicated mock implementation
    superagentMock.mockClear();
  });

  describe('bootstrap', () => {
    describe('when the openid configuration cannot be retrieved', () => {
      test('should throw an error', async () => {
        superagentMock.setMockError('failed!', 500);
        const authentication = new Authentication(services, dataSource, options);

        await expect(authentication.bootstrap()).rejects.toThrowError(
          'Failed to fetch openid-configuration',
        );
        expect((authentication as any).client).toBeUndefined();
      });
    });

    describe('when the openid configuration was successfully retrieved', () => {
      beforeEach(() => {
        superagentMock.setMockResponseBody(openidValidConfiguration);
      });

      describe('when not using client id', () => {
        test('should create an oidc client and bootstrap successfully', async () => {
          openidClientRegisterMock.mockReturnValue({});
          const authentication = new Authentication(services, dataSource, options);

          await authentication.bootstrap();

          expect((authentication as any).client).toBeDefined();
        });
      });

      describe('when using client id', () => {
        test('should create an oidc client and bootstrap successfully', async () => {
          const optionsOverride = { ...options, clientId: 'xx' };
          const authentication = new Authentication(services, dataSource, optionsOverride);

          await authentication.bootstrap();

          expect((authentication as any).client).toBeDefined();
        });
      });
    });
  });

  test('should register authentication related public routes', async () => {
    const authentication = new Authentication(services, dataSource, options);
    authentication.setupPublicRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/authentication', expect.any(Function));
    expect(router.get).toHaveBeenCalledWith('/authentication/callback', expect.any(Function));
    expect(router.post).toHaveBeenCalledWith('/authentication/logout', expect.any(Function));
  });

  describe('handleAuthentication', () => {
    describe('when the given renderingId is correct', () => {
      test('should respond with an authorization url', async () => {
        const authentication = new Authentication(services, dataSource, options);
        (authentication as any).client = {
          authorizationUrl: jest.fn().mockReturnValue('authorizationUrl'),
        };

        const context = { response: {}, request: { body: { renderingId: 1 } } } as Context;
        await authentication.handleAuthentication(context);

        expect(context.response.body).toEqual({
          authorizationUrl: 'authorizationUrl',
        });
      });
    });

    describe('when the given renderingId is incorrect', () => {
      test('should response with a 400 error', async () => {
        const authentication = new Authentication(services, dataSource, options);
        (authentication as any).client = {
          authorizationUrl: jest.fn().mockReturnValue('authorizationUrl'),
        };

        const context = {
          response: {},
          request: { body: { renderingId: 'somethingInvalid' } },
          throw: jest.fn() as any,
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
          first_name: 'erlich',
          last_name: 'bachman',
          teams: ['admin'],
        };
        superagentMock.setMockResponseBody({
          data: {
            id: 1,
            attributes: user,
          },
        });
        const authentication = new Authentication(services, dataSource, options);
        (authentication as any).client = {
          callback: jest.fn().mockReturnValue('authorizationUrl'),
        };

        const context = {
          response: {},
          request: { query: { state: '{"renderingId": 1}' } },
        } as unknown as Context;
        await authentication.handleAuthenticationCallback(context);

        expect((context.response.body as any).token).toBeDefined();
        expect((context.response.body as any).tokenData).toBeDefined();
      });
    });

    describe('when authentication failed', () => {
      it('should respond with an error', async () => {
        superagentMock.setMockError('failed!', 400);
        const authentication = new Authentication(services, dataSource, options);
        const callbackMock = jest.fn().mockReturnValue('authorizationUrl');
        (authentication as any).client = {
          callback: callbackMock,
        };

        const context = {
          response: {},
          request: { query: { state: '{"renderingId": 1}' } },
          throw: jest.fn() as any,
        } as unknown as Context;
        await authentication.handleAuthenticationCallback(context);

        expect(context.throw).toHaveBeenCalledWith(
          400,
          'Failed to exchange token with forestadmin-server.',
        );
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
