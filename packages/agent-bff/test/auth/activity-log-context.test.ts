import type { Context } from 'koa';

import activityLogConfigOf from '../../src/auth/activity-log-context';

const FOREST_SERVER_URL = 'https://api.forestadmin.com';
const RENDERING_ID = 42;
const SERVER_TOKEN = 'api-key-server-token';

function apiKeyCtx(state: Record<string, unknown> = {}): Context {
  return {
    state: {
      authMode: 'api-key',
      apiKeyIdentity: { renderingId: RENDERING_ID },
      resolveForestServerToken: async () => SERVER_TOKEN,
      ...state,
    },
  } as unknown as Context;
}

describe('activity log config', () => {
  it('should write to the Forest server under the BFF source with the request logger', () => {
    const logger = jest.fn();

    const { forestServer, activityLog } = activityLogConfigOf(
      apiKeyCtx(),
      FOREST_SERVER_URL,
      logger,
    );

    expect(forestServer).toEqual({
      serverUrl: FOREST_SERVER_URL,
      serverToken: expect.any(Function),
      renderingId: RENDERING_ID,
    });
    expect(activityLog).toEqual({
      source: 'BFF',
      logger,
      onExpiredCredential: expect.any(Function),
    });
  });

  it('should resolve the server token of the request only when it is asked for', async () => {
    const resolveForestServerToken = jest.fn(async () => SERVER_TOKEN);

    const { forestServer } = activityLogConfigOf(
      apiKeyCtx({ resolveForestServerToken }),
      FOREST_SERVER_URL,
      jest.fn(),
    );

    expect(resolveForestServerToken).not.toHaveBeenCalled();
    await expect((forestServer.serverToken as () => Promise<string>)()).resolves.toBe(SERVER_TOKEN);
  });

  it('should refuse with session_expired when the request carries no rendering', () => {
    expect(() =>
      activityLogConfigOf(apiKeyCtx({ apiKeyIdentity: undefined }), FOREST_SERVER_URL, jest.fn()),
    ).toThrow(expect.objectContaining({ status: 401, type: 'session_expired' }));
  });

  it('should drop the cached api key identity when the credential expired', () => {
    const invalidateApiKeyIdentity = jest.fn();
    const { activityLog } = activityLogConfigOf(
      apiKeyCtx({ invalidateApiKeyIdentity }),
      FOREST_SERVER_URL,
      jest.fn(),
    );

    activityLog.onExpiredCredential?.();

    expect(invalidateApiKeyIdentity).toHaveBeenCalledTimes(1);
  });
});
