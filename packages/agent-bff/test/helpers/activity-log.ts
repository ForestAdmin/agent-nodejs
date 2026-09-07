import type {
  ActivityLogWriter,
  RecordActivityLogOptions,
} from '../../src/activity-log/activity-log-writer';
import type { ActivityLogsWriter } from '../../src/activity-log/activity-logs-service';
import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { SessionStore } from '../../src/oauth/session-store';
import type { Logger } from '../../src/ports/logger-port';
import type { Middleware } from 'koa';

import jsonwebtoken from 'jsonwebtoken';

import createActivityLogWriter from '../../src/activity-log/activity-log-writer';
import createForestServerTokenMiddleware from '../../src/auth/forest-server-token-middleware';

export const ACTIVITY_LOG_ID = 'log-1';
export const ACTIVITY_LOG_INDEX = 'activity-logs-2024';
export const API_KEY_SERVER_TOKEN = 'api-key-server-token';
export const RENDERING_ID = 42;
export const SESSION_ID = 'sid-1';

export interface FakeActivityLogsService extends ActivityLogsWriter {
  createMcpActivityLog: jest.Mock;
  updateActivityLogStatus: jest.Mock;
}

export function fakeActivityLogsService(
  overrides: Partial<FakeActivityLogsService> = {},
): FakeActivityLogsService {
  return {
    createMcpActivityLog: jest.fn(async () => ({
      id: ACTIVITY_LOG_ID,
      attributes: { index: ACTIVITY_LOG_INDEX },
    })),
    updateActivityLogStatus: jest.fn(async () => undefined),
    ...overrides,
  } as FakeActivityLogsService;
}

export function activityLogsOf(service: ActivityLogsWriter, logger: Logger): ActivityLogWriter {
  return createActivityLogWriter({ service, logger });
}

export function passthroughActivityLogs(): ActivityLogWriter {
  return {
    record<T>(options: RecordActivityLogOptions<T>): Promise<T> {
      return options.operation();
    },

    drain(): Promise<void> {
      return Promise.resolve();
    },
  };
}

export function sessionAccessToken(): string {
  return jsonwebtoken.sign({ scope: 'forest' }, 'session-secret', { expiresIn: '15m' });
}

export function sessionStoreOf(saasAccessToken: string | undefined): SessionStore {
  return {
    get: (sid: string) =>
      sid === SESSION_ID && saasAccessToken !== undefined ? { saasAccessToken } : undefined,
  } as unknown as SessionStore;
}

export const unusedServerClient = {} as ForestServerClient;

export function apiKeyCredentials(
  forestServerToken: string | undefined = API_KEY_SERVER_TOKEN,
): Middleware {
  return async function stubApiKeyCredentials(ctx, next) {
    ctx.state.authMode = 'api-key';
    ctx.state.apiKeyIdentity = { renderingId: RENDERING_ID };
    ctx.state.forestServerToken = forestServerToken;
    await next();
  };
}

export function oauthCredentials(): Middleware {
  return async function stubOAuthCredentials(ctx, next) {
    ctx.state.authMode = 'oauth';
    ctx.state.principal = { sid: SESSION_ID, rendering_id: String(RENDERING_ID) };
    await next();
  };
}

export function forestServerTokenStep(saasAccessToken?: string): Middleware {
  return createForestServerTokenMiddleware({
    session: { store: sessionStoreOf(saasAccessToken), serverClient: unusedServerClient },
  });
}
