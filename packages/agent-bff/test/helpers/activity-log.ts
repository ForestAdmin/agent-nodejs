import type {
  ActivityLogWriter,
  RecordActivityLogOptions,
} from '../../src/activity-log/activity-log-writer';
import type { ActivityLogsWriter } from '../../src/activity-log/activity-logs-service';
import type { Logger } from '../../src/ports/logger-port';
import type { Middleware } from 'koa';

import jsonwebtoken from 'jsonwebtoken';

import createActivityLogWriter from '../../src/activity-log/activity-log-writer';
import createForestServerTokenMiddleware from '../../src/auth/forest-server-token-middleware';
import createSessionTokenCodec from '../../src/oauth/session-token';
import createTokenCipher from '../../src/oauth/token-cipher';

export const ACTIVITY_LOG_ID = 'log-1';
export const ACTIVITY_LOG_INDEX = 'activity-logs-2024';
export const API_KEY_SERVER_TOKEN = 'api-key-server-token';
export const RENDERING_ID = 42;
export const SESSION_ID = 'sid-1';
export const SESSION_USER_ID = 7;

export const testSessionTokens = createSessionTokenCodec(
  createTokenCipher(Buffer.alloc(32, 3).toString('base64')),
  () => Date.now(),
);

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

    drain(): Promise<string[]> {
      return Promise.resolve([]);
    },
  };
}

export function sessionAccessToken(): string {
  return jsonwebtoken.sign({ scope: 'forest' }, 'session-secret', { expiresIn: '15m' });
}

export function sealedServerAccess(saasAccessToken: string): string {
  return testSessionTokens.sealServerAccess(
    { sid: SESSION_ID, userId: SESSION_USER_ID, renderingId: RENDERING_ID },
    saasAccessToken,
  );
}

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
    ctx.state.principal = {
      sid: SESSION_ID,
      id: SESSION_USER_ID,
      rendering_id: String(RENDERING_ID),
    };
    await next();
  };
}

export function forestServerTokenStep(
  saasAccessToken?: string,
  logger: Logger = () => undefined,
): Middleware {
  const tokenStep = createForestServerTokenMiddleware({
    session: { sessionTokens: testSessionTokens },
    logger,
  });

  return async function sealedServerAccessStep(ctx, next) {
    if (ctx.state.principal && saasAccessToken !== undefined) {
      ctx.state.principal.server_access = sealedServerAccess(saasAccessToken);
    }

    await tokenStep(ctx, next);
  };
}
