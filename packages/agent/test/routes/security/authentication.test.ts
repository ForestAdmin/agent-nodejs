import { createMockContext } from '@shopify/jest-koa-mocks';
import { ClientAuthMethod, Issuer } from 'openid-client';

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
    expect(router.get).toHaveBeenCalledWith('/authentication/callback', expect.any(Function));
    expect(router.use).toHaveBeenCalledWith(expect.any(Function));
  });

  test('bootstrap should retrieve the openId client', async () => {
    options.forestAdminClient.getOpenIdClient = jest.fn().mockResolvedValue('value');
    await route.bootstrap();

    expect(options.forestAdminClient.getOpenIdClient).toHaveBeenCalled();
  });

  test('bootstrap should throw if the openid configuration cannot be fetched', async () => {
    options.forestAdminClient.getOpenIdClient = jest
      .fn()
      .mockRejectedValue(new Error('Cannot fetch openid configuration'));

    await expect(route.bootstrap()).rejects.toThrow('Cannot fetch openid configuration');
  });

  describe('when the route is bootstraped', () => {
    beforeEach(async () => {
      const issuer = await Issuer.discover('https://accounts.google.com');
      const client = new issuer.Client({
        client_id: '123',
        token_endpoint_auth_method: 'none' as ClientAuthMethod,
        redirect_uris: ['https://localhost/authentication/callback'],
      });

      options.forestAdminClient.getOpenIdClient = jest.fn().mockResolvedValue(client);

      await route.bootstrap();
    });

    test('/authentication responds with auth url if renderingId is correct', async () => {
      const context = createMockContext({ requestBody: { renderingId: '1' } });

      // @ts-expect-error: testing private method
      await route.handleAuthentication(context);

      expect(context.response.body).toEqual({
        authorizationUrl: expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth'),
      });
    });

    test('/authentication throws if renderingId is incorrect', async () => {
      const context = createMockContext({ requestBody: { renderingId: 'somethingInvalid' } });

      // @ts-expect-error: testing private method
      const fn = () => route.handleAuthentication(context);

      await expect(fn).rejects.toThrow('Rendering id must be a number');
    });

    test('/authentication/callback responds with token if auth is successful', async () => {
      const context = createMockContext({
        customProperties: { query: { state: '{"renderingId": 1}' } },
      });

      options.forestAdminClient.getUserInfo = jest.fn().mockResolvedValue({
        id: 1,
        email: 'hello@forest.admin',
        firstName: 'erlich',
        lastName: 'bachman',
        team: 'admin',
        renderingId: '1',
      });

      // @ts-expect-error: testing private method
      await route.handleAuthenticationCallback(context);

      expect(context.response.body).toContainAllKeys(['token', 'tokenData']);
    });

    test('/authentication/callback throws if request.state is invalid', async () => {
      const context = createMockContext({
        customProperties: { query: { state: '{"rendeId":' } },
      });

      // @ts-expect-error: testing private method
      const fn = () => route.handleAuthenticationCallback(context);
      await expect(fn).rejects.toThrow('Failed to retrieve renderingId from query[state]');
    });

    test('/authentication/callback throws if it fails to fetch userinfo (exception)', async () => {
      options.forestAdminClient.getUserInfo = jest
        .fn()
        .mockRejectedValue(new Error('Failed to fetch userinfo'));

      const context = createMockContext({
        customProperties: { query: { state: '{"renderingId": 1}' } },
      });

      // @ts-expect-error: testing private method
      const fn = () => route.handleAuthenticationCallback(context);

      await expect(fn).rejects.toThrow('Failed to fetch userinfo');
    });

    test('/authentication/callback throws if it fails to fetch userinfo (null)', async () => {
      options.forestAdminClient.getUserInfo = jest.fn().mockResolvedValue(null);

      const context = createMockContext({
        customProperties: { query: { state: '{"renderingId": 1}' } },
      });

      // @ts-expect-error: testing private method
      const fn = () => route.handleAuthenticationCallback(context);

      await expect(fn).rejects.toThrow();
    });
  });
});
