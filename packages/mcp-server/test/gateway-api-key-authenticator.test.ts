import { GatewayApiKeyResolveError } from '@forestadmin/forestadmin-client';
import {
  InsufficientScopeError,
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import jsonwebtoken from 'jsonwebtoken';

import GatewayApiKeyAuthenticator from '../src/gateway-api-key-authenticator';

const AUTH_SECRET = 'auth-secret';
const PARSED = { keyId: 'a'.repeat(16), secret: 'b'.repeat(64) };
const OTHER_PARSED = { keyId: 'c'.repeat(16), secret: 'd'.repeat(64) };
const NOW = 1_700_000_000_000;

const IDENTITY = {
  user: {
    id: 42,
    email: 'bot@forest.local',
    firstName: 'Bot',
    lastName: null,
    team: 'Operations',
    tags: [{ key: 'region', value: 'eu' }],
    permissionLevel: 'user',
  },
  renderingId: 7,
  saasAccessToken: 'saas-token',
};

function setup({ now = (): number => NOW }: { now?: () => number } = {}) {
  const resolve = jest.fn();
  const authenticator = new GatewayApiKeyAuthenticator({
    client: { resolve },
    authSecret: AUTH_SECRET,
    now,
  });

  return { resolve, authenticator };
}

describe('GatewayApiKeyAuthenticator', () => {
  it('should resolve the parsed key and return the identity', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockResolvedValue(IDENTITY);

    const result = await authenticator.authenticate(PARSED);

    expect(resolve).toHaveBeenCalledWith(PARSED);
    expect(result.identity).toEqual(IDENTITY);
  });

  it('should mint an agent token signed with the auth secret for five minutes', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockResolvedValue(IDENTITY);

    const { agentToken, expiresAt } = await authenticator.authenticate(PARSED);

    expect(expiresAt).toBe(NOW / 1000 + 300);
    expect(jsonwebtoken.verify(agentToken, AUTH_SECRET, { ignoreExpiration: true })).toEqual(
      expect.objectContaining({
        id: 42,
        email: 'bot@forest.local',
        firstName: 'Bot',
        lastName: '',
        team: 'Operations',
        renderingId: 7,
        tags: { region: 'eu' },
        permissionLevel: 'user',
        first_name: 'Bot',
        last_name: '',
        rendering_id: 7,
        permission_level: 'user',
        exp: NOW / 1000 + 300,
      }),
    );
  });

  it('should serve a resolved key from the cache for 60 seconds', async () => {
    let now = NOW;
    const { resolve, authenticator } = setup({ now: () => now });
    resolve.mockResolvedValue(IDENTITY);

    await authenticator.authenticate(PARSED);
    now += 59_999;
    await authenticator.authenticate(PARSED);

    expect(resolve).toHaveBeenCalledTimes(1);

    now += 1;
    await authenticator.authenticate(PARSED);

    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('should mint a fresh agent token on a cached resolution', async () => {
    let now = NOW;
    const { resolve, authenticator } = setup({ now: () => now });
    resolve.mockResolvedValue(IDENTITY);

    const first = await authenticator.authenticate(PARSED);
    now += 30_000;
    const second = await authenticator.authenticate(PARSED);

    expect(second.expiresAt).toBe(first.expiresAt + 30);
  });

  it('should cache each key separately', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockResolvedValue(IDENTITY);

    await authenticator.authenticate(PARSED);
    await authenticator.authenticate(OTHER_PARSED);

    expect(resolve).toHaveBeenNthCalledWith(1, PARSED);
    expect(resolve).toHaveBeenNthCalledWith(2, OTHER_PARSED);
  });

  it('should evict the oldest key once 10000 keys are cached', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockResolvedValue(IDENTITY);
    const keyAt = (index: number) => ({
      keyId: index.toString(16).padStart(16, '0'),
      secret: 'b'.repeat(64),
    });

    for (let index = 0; index <= 10_000; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await authenticator.authenticate(keyAt(index));
    }

    await authenticator.authenticate(keyAt(1));
    expect(resolve).toHaveBeenCalledTimes(10_001);

    await authenticator.authenticate(keyAt(0));
    expect(resolve).toHaveBeenCalledTimes(10_002);
  });

  it('should refuse an unknown or revoked key as an invalid token', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockRejectedValue(new GatewayApiKeyResolveError({ status: 401 }));

    const error = await authenticator.authenticate(PARSED).catch(e => e);

    expect(error).toBeInstanceOf(InvalidTokenError);
    expect(error.message).toBe('Invalid or revoked service account credential');
  });

  it('should refuse a project without the Gateway MCP plan feature as insufficient scope', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockRejectedValue(
      new GatewayApiKeyResolveError({ status: 403, code: 'plan_feature_missing' }),
    );

    const error = await authenticator.authenticate(PARSED).catch(e => e);

    expect(error).toBeInstanceOf(InsufficientScopeError);
    expect(error.message).toBe("The project's plan does not include the Gateway MCP");
  });

  it('should refuse a service account not allowed on the environment as insufficient scope', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockRejectedValue(
      new GatewayApiKeyResolveError({ status: 403, code: 'forest_identity_not_allowed' }),
    );

    const error = await authenticator.authenticate(PARSED).catch(e => e);

    expect(error).toBeInstanceOf(InsufficientScopeError);
    expect(error.message).toBe('This service account is not allowed on this environment');
  });

  it.each([
    ['a 400', { status: 400 }],
    ['a 429', { status: 429, retryAfter: 5 }],
    ['a 500', { status: 500 }],
    ['an unreachable server', { unreachable: true }],
  ])('should report %s as a server error', async (_, params) => {
    const { resolve, authenticator } = setup();
    resolve.mockRejectedValue(new GatewayApiKeyResolveError(params));

    const error = await authenticator.authenticate(PARSED).catch(e => e);

    expect(error).toBeInstanceOf(ServerError);
    expect(error.message).toBe('Unable to resolve the service account credential');
  });

  it.each([401, 403])('should cache a %s refusal for 10 seconds', async status => {
    let now = NOW;
    const { resolve, authenticator } = setup({ now: () => now });
    resolve.mockRejectedValue(new GatewayApiKeyResolveError({ status }));

    await authenticator.authenticate(PARSED).catch(() => undefined);
    now += 9_999;
    await authenticator.authenticate(PARSED).catch(() => undefined);

    expect(resolve).toHaveBeenCalledTimes(1);

    now += 1;
    await authenticator.authenticate(PARSED).catch(() => undefined);

    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 429', { status: 429 }],
    ['a 500', { status: 500 }],
    ['an unreachable server', { unreachable: true }],
  ])('should not cache %s', async (_, params) => {
    const { resolve, authenticator } = setup();
    resolve.mockRejectedValueOnce(new GatewayApiKeyResolveError(params));
    resolve.mockResolvedValueOnce(IDENTITY);

    await authenticator.authenticate(PARSED).catch(() => undefined);
    const result = await authenticator.authenticate(PARSED);

    expect(result.identity).toEqual(IDENTITY);
  });

  it.each([401, 403, 500])('should keep the resolve error of a %s as the cause', async status => {
    const { resolve, authenticator } = setup();
    const resolveError = new GatewayApiKeyResolveError({ status, code: 'some_code' });
    resolve.mockRejectedValue(resolveError);

    const error = await authenticator.authenticate(PARSED).catch(e => e);

    expect(error.cause).toBe(resolveError);
  });

  it('should rethrow an error that is not a resolve refusal', async () => {
    const { resolve, authenticator } = setup();
    const unexpected = new TypeError('boom');
    resolve.mockRejectedValue(unexpected);

    await expect(authenticator.authenticate(PARSED)).rejects.toBe(unexpected);
  });

  it('should refuse and not cache an identity without a Forest token', async () => {
    const { resolve, authenticator } = setup();
    resolve.mockResolvedValueOnce({ ...IDENTITY, saasAccessToken: undefined });
    resolve.mockResolvedValueOnce(IDENTITY);

    const error = await authenticator.authenticate(PARSED).catch(e => e);
    const result = await authenticator.authenticate(PARSED);

    expect(error).toBeInstanceOf(ServerError);
    expect(error.message).toBe('The service account credential resolved without a Forest token');
    expect(result.identity).toEqual(IDENTITY);
  });
});
