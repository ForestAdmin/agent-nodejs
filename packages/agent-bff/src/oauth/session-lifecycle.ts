import type ForestServerClient from './forest-server-client';
import type { SessionStore } from './session-store';

import jsonwebtoken from 'jsonwebtoken';

import { OAuthExchangeError } from './forest-server-client';
import { serverError, sessionExpired } from './oauth-error';

export interface EnsureFreshServerAccessParams {
  sid: string;
  store: SessionStore;
  serverClient: ForestServerClient;
}

const CLIENT_ERROR_CODES = new Set(['invalid_grant', 'invalid_request', 'invalid_client']);

const inFlightRefreshesBySid = new Map<string, Promise<string>>();

function accessTokenExpiry(saasAccessToken: string): number {
  const decoded = jsonwebtoken.decode(saasAccessToken) as { exp?: number } | null;

  return decoded?.exp ?? 0;
}

async function refreshAndPersist(
  sid: string,
  store: SessionStore,
  serverClient: ForestServerClient,
): Promise<string> {
  const currentRefresh = store.getSaasRefreshToken(sid);

  if (currentRefresh === undefined) {
    throw sessionExpired('Session not found or expired');
  }

  let rotated: Awaited<ReturnType<ForestServerClient['refreshServerToken']>>;

  try {
    rotated = await serverClient.refreshServerToken(currentRefresh);
  } catch (error) {
    if (error instanceof OAuthExchangeError && CLIENT_ERROR_CODES.has(error.error)) {
      throw sessionExpired('The Forest server rejected the refresh token');
    }

    throw serverError('Failed to reach the Forest server to refresh the session');
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

export default async function ensureFreshServerAccess({
  sid,
  store,
  serverClient,
}: EnsureFreshServerAccessParams): Promise<string> {
  const session = store.get(sid);

  if (!session) {
    throw sessionExpired('Session not found or expired');
  }

  if (accessTokenExpiry(session.saasAccessToken) > Math.floor(Date.now() / 1000)) {
    return session.saasAccessToken;
  }

  const existing = inFlightRefreshesBySid.get(sid);
  if (existing) return existing;

  const refresh = refreshAndPersist(sid, store, serverClient).finally(() => {
    inFlightRefreshesBySid.delete(sid);
  });
  inFlightRefreshesBySid.set(sid, refresh);

  return refresh;
}
