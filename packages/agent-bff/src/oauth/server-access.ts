import type { BffAccessTokenPayload } from './bff-token';
import type { SessionTokenCodec } from './session-token';

import jsonwebtoken from 'jsonwebtoken';

import { sessionExpired } from './oauth-error';

function accessTokenExpiry(saasAccessToken: string): number {
  const decoded = jsonwebtoken.decode(saasAccessToken) as { exp?: number } | null;

  return decoded?.exp ?? 0;
}

export default function resolveServerAccess(
  principal: BffAccessTokenPayload,
  codec: SessionTokenCodec,
): string {
  const saasAccessToken =
    typeof principal.server_access === 'string'
      ? codec.openServerAccess(principal.server_access, {
          sid: principal.sid,
          userId: principal.id,
          renderingId: Number(principal.rendering_id),
        })
      : undefined;

  if (saasAccessToken === undefined) {
    throw sessionExpired('Session not found or expired');
  }

  if (accessTokenExpiry(saasAccessToken) <= Math.floor(Date.now() / 1000)) {
    throw sessionExpired('The Forest server access of this session expired');
  }

  return saasAccessToken;
}
