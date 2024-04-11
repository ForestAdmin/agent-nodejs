import { AuthenticationError, ForbiddenError } from '@forestadmin/forestadmin-client';
import { createMockContext } from '@shopify/jest-koa-mocks';
import { errors } from 'openid-client';

import Authentication from '../../../src/routes/security/authentication';
import { AgentOptionsWithDefaults } from '../../../src/types';
import * as factories from '../../__factories__';

describe('Authentication', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();
  let options: AgentOptionsWithDefaults;
  let route: Authentication;

  beforeEach(async () => {
    jest.clearAllMocks();

    options = factories.forestAdminHttpDriverOptions.build();
    route = new Authentication(services, options);
  });

  test('setupRoutes should register two routes and one middleware', async () => {
    route.setupRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/authentication', expect.any(Function));
    expect(router.get).toHaveBeenCalledWith(
      '/authentication/callback',
      expect.any(Function),
      expect.any(Function),
    );
    expect(router.use).toHaveBeenCalledWith(expect.any(Function));
  });

  test('bootstrap should retrieve the openId client', async () => {
    const init = jest.spyOn(options.forestAdminClient.authService, 'init').mockResolvedValue();

    await route.bootstrap();

    expect(init).toHaveBeenCalled();
  });

  describe('when the route is bootstraped', () => {
    describe('/authentication', () => {
      test('responds with auth url if renderingId is correct', async () => {
        const context = createMockContext({ requestBody: { renderingId: '1' } });

        const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=123';
        jest
          .spyOn(options.forestAdminClient.authService, 'generateAuthorizationUrl')
          .mockResolvedValue(authUrl);

        // @ts-expect-error: testing private method
        await route.handleAuthentication(context);

        expect(context.response.body).toEqual({
          authorizationUrl: authUrl,
        });
      });

      test('throws if renderingId is incorrect', async () => {
        const context = createMockContext({ requestBody: { renderingId: 'somethingInvalid' } });

        // @ts-expect-error: testing private method
        const fn = () => route.handleAuthentication(context);

        await expect(fn).rejects.toThrow('Rendering id must be a number');
      });
    });

    describe('/authentication/callback', () => {
      test('responds with token if auth is successful', async () => {
        const context = createMockContext({
          customProperties: { query: { state: '{"renderingId": 1}' } },
        });

        jest.spyOn(options.forestAdminClient.authService, 'generateTokens').mockResolvedValue({
          accessToken: '123',
        });

        jest.spyOn(options.forestAdminClient.authService, 'getUserInfo').mockResolvedValue({
          id: 1,
          email: 'hello@forest.admin',
          firstName: 'erlich',
          lastName: 'bachman',
          team: 'admin',
          renderingId: 1,
          role: 'admin',
          tags: {},
          permissionLevel: 'admin',
        });

        // @ts-expect-error: testing private method
        await route.handleAuthenticationCallback(context);

        expect(context.response.body).toEqual({
          token: expect.any(String),
          tokenData: {
            id: 1,
            email: 'hello@forest.admin',
            firstName: 'erlich',
            lastName: 'bachman',
            team: 'admin',
            renderingId: 1,
            role: 'admin',
            tags: {},
            permissionLevel: 'admin',
            exp: expect.any(Number),
            iat: expect.any(Number),
          },
        });
      });

      test('throws if request.state is invalid', async () => {
        const context = createMockContext({
          customProperties: { query: { state: '{"rendeId":' } },
        });

        // @ts-expect-error: testing private method
        const fn = () => route.handleAuthenticationCallback(context);
        await expect(fn).rejects.toThrow('Failed to retrieve renderingId from query[state]');
      });

      test('throws if it fails to fetch userinfo (exception)', async () => {
        jest.spyOn(options.forestAdminClient.authService, 'generateTokens').mockResolvedValue({
          accessToken: '123',
        });
        jest
          .spyOn(options.forestAdminClient.authService, 'getUserInfo')
          .mockRejectedValue(new Error('Failed to fetch userinfo'));

        const context = createMockContext({
          customProperties: { query: { state: '{"renderingId": 1}' } },
        });

        // @ts-expect-error: testing private method
        const fn = () => route.handleAuthenticationCallback(context);

        await expect(fn).rejects.toThrow('Failed to fetch userinfo');
      });

      test('throws if it fails to fetch userinfo (null)', async () => {
        options.forestAdminClient.authService.getUserInfo = jest.fn().mockResolvedValue(null);

        const context = createMockContext({
          customProperties: { query: { state: '{"renderingId": 1}' } },
        });

        // @ts-expect-error: testing private method
        const fn = () => route.handleAuthenticationCallback(context);

        await expect(fn).rejects.toThrow();
      });

      describe('exception handling', () => {
        test('returns a translated error if it is an AuthenticationError', async () => {
          route.setupRoutes(router);

          const getMock = router.get as jest.Mock;

          const errorHandler = getMock.mock.calls[0][1];
          const callbackHandler = getMock.mock.calls[0][2];

          const context = createMockContext({
            customProperties: { query: { state: '{"renderingId": 1}' } },
          });

          jest.spyOn(options.forestAdminClient.authService, 'generateTokens').mockRejectedValue(
            new AuthenticationError(
              new errors.OPError({
                error: 'invalid_request',
                error_description: 'Invalid request',
                state: '123',
              }),
            ),
          );

          await errorHandler(context, async () => {
            await callbackHandler(context);
          });

          expect(context.response.status).toEqual(401);
          expect(context.response.body).toEqual({
            error: 'invalid_request',
            error_description: 'Invalid request',
            state: '123',
          });
        });

        test('returns a translated error if it is ForbiddenError', async () => {
          route.setupRoutes(router);

          const getMock = router.get as jest.Mock;

          const errorHandler = getMock.mock.calls[0][1];
          const callbackHandler = getMock.mock.calls[0][2];

          const context = createMockContext({
            customProperties: { query: { state: '{"renderingId": 1}' } },
          });

          jest
            .spyOn(options.forestAdminClient.authService, 'generateTokens')
            .mockRejectedValue(new ForbiddenError('access denied'));

          await errorHandler(context, async () => {
            await callbackHandler(context);
          });

          expect(context.response.status).toEqual(403);
          expect(context.response.body).toEqual({
            error: 403,
            error_description: 'access denied',
          });
        });

        test('rethrow the error if it is not an AuthenticationError', async () => {
          route.setupRoutes(router);

          const getMock = router.get as jest.Mock;

          const errorHandler = getMock.mock.calls[0][1];
          const callbackHandler = getMock.mock.calls[0][2];

          const context = createMockContext({
            customProperties: { query: { state: '{"renderingId": 1}' } },
          });

          jest
            .spyOn(options.forestAdminClient.authService, 'generateTokens')
            .mockRejectedValue(new Error('Something went wrong'));

          await expect(
            errorHandler(context, async () => {
              await callbackHandler(context);
            }),
          ).rejects.toThrow('Something went wrong');
        });
      });
    });
  });
});
