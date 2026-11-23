import type { Context } from 'koa';

import { ActivityLogsService, ForestHttpApi } from '@forestadmin/forestadmin-client';

import {
  activityLogContextOf,
  createBffActivityLogsService,
} from '../../src/auth/activity-log-context';
import { fakeActivityLogsService } from '../helpers/activity-log';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ...jest.requireActual('@forestadmin/forestadmin-client'),
  ActivityLogsService: jest.fn(),
}));

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

describe('activity log context', () => {
  it('should build the service with the BFF application source header', () => {
    createBffActivityLogsService('https://api.forestadmin.com');

    expect(ActivityLogsService).toHaveBeenCalledWith(expect.any(ForestHttpApi), {
      forestServerUrl: 'https://api.forestadmin.com',
      headers: { 'Forest-Application-Source': 'BFF' },
    });
  });

  it('should resolve the server token and the rendering of the request', async () => {
    const context = activityLogContextOf(
      apiKeyCtx(),
      fakeActivityLogsService() as never,
      jest.fn(),
    );

    await expect(context.credentials()).resolves.toEqual({
      forestServerToken: SERVER_TOKEN,
      renderingId: RENDERING_ID,
    });
  });

  it('should refuse with session_expired when the request carries no rendering', async () => {
    const context = activityLogContextOf(
      apiKeyCtx({ apiKeyIdentity: undefined }),
      fakeActivityLogsService() as never,
      jest.fn(),
    );

    await expect(context.credentials()).rejects.toMatchObject({
      status: 401,
      type: 'session_expired',
    });
  });

  it('should drop the cached api key identity when the credential expired', () => {
    const invalidateApiKeyIdentity = jest.fn();
    const context = activityLogContextOf(
      apiKeyCtx({ invalidateApiKeyIdentity }),
      fakeActivityLogsService() as never,
      jest.fn(),
    );

    context.onExpiredCredential?.();

    expect(invalidateApiKeyIdentity).toHaveBeenCalledTimes(1);
  });
});
