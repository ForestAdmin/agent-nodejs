import type ForestServerClient from './forest-server-client';
import type { SessionStore } from './session-store';

import jsonwebtoken from 'jsonwebtoken';

import { sessionExpired } from './oauth-error';

export interface EnsureFreshServerAccessParams {
  sid: string;
  store: SessionStore;
  serverClient: ForestServerClient;
}

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

  try {
    const rotated = await serverClient.refreshServerToken(currentRefresh);
    store.updateSaasTokens(sid, {
      saasAccessToken: rotated.saasAccessToken,
      saasRefreshToken: rotated.saasRefreshToken,
    });

    return rotated.saasAccessToken;
  } catch {
    throw sessionExpired('Failed to refresh the Forest server session');
  }
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
