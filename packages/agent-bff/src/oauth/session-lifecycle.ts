import type ForestServerClient from './forest-server-client';
import type { SessionStore, StoredSession } from './session-store';
import type { Logger } from '../ports/logger-port';

import jsonwebtoken from 'jsonwebtoken';

import { OAuthExchangeError } from './forest-server-client';
import { serverError, sessionExpired } from './oauth-error';

export interface EnsureFreshServerAccessParams {
  sid: string;
  store: SessionStore;
  serverClient: ForestServerClient;
  logger: Logger;
}

const CLIENT_ERROR_CODES = new Set(['invalid_grant', 'invalid_request', 'invalid_client']);

const inFlightRefreshesBySid = new Map<string, Promise<string>>();

function accessTokenExpiry(saasAccessToken: string): number {
  const decoded = jsonwebtoken.decode(saasAccessToken) as { exp?: number } | null;

  return decoded?.exp ?? 0;
}

async function refreshAndPersist(
  session: StoredSession,
  { sid, store, serverClient, logger }: EnsureFreshServerAccessParams,
): Promise<string> {
  const sessionContext = { renderingId: session.renderingId, userId: session.userId };

  if (!session.clientId) {
    logger(
      'Warn',
      'The session has no client id to refresh the Forest server token',
      sessionContext,
    );

    throw sessionExpired('Session not found or expired');
  }

  const currentRefresh = store.getSaasRefreshToken(sid);

  if (currentRefresh === undefined) {
    throw sessionExpired('Session not found or expired');
  }

  let rotated: Awaited<ReturnType<ForestServerClient['refreshServerToken']>>;

  try {
    rotated = await serverClient.refreshServerToken({
      refreshToken: currentRefresh,
      clientId: session.clientId,
    });
  } catch (error) {
    if (error instanceof OAuthExchangeError && CLIENT_ERROR_CODES.has(error.error)) {
      logger('Warn', 'The Forest server rejected the session refresh', {
        ...sessionContext,
        error: error.error,
        errorDescription: error.message,
      });

      throw sessionExpired('The Forest server rejected the refresh token');
    }

    throw serverError('Failed to reach the Forest server to refresh the session', error);
  }

  if (!store.get(sid)) {
    throw sessionExpired('Session expired during token refresh');
  }

  store.updateSaasTokens(sid, {
    saasAccessToken: rotated.saasAccessToken,
    saasRefreshToken: rotated.saasRefreshToken,
  });

  return rotated.saasAccessToken;
}

export default async function ensureFreshServerAccess(
  params: EnsureFreshServerAccessParams,
): Promise<string> {
  const { sid, store } = params;
  const session = store.get(sid);

  if (!session) {
    throw sessionExpired('Session not found or expired');
  }

  if (accessTokenExpiry(session.saasAccessToken) > Math.floor(Date.now() / 1000)) {
    return session.saasAccessToken;
  }

  const existing = inFlightRefreshesBySid.get(sid);
  if (existing) return existing;

  const refresh = refreshAndPersist(session, params).finally(() => {
    inFlightRefreshesBySid.delete(sid);
  });
  inFlightRefreshesBySid.set(sid, refresh);

  return refresh;
}
