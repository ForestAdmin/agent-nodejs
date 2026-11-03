import type { BffAccessTokenPayload } from './bff-token';
import type { SessionTokenCodec } from './session-token';

import jsonwebtoken from 'jsonwebtoken';

import { sessionExpired } from './oauth-error';

function hasExpired(saasAccessToken: string): boolean {
  const decoded = jsonwebtoken.decode(saasAccessToken) as { exp?: unknown } | null;

  return typeof decoded?.exp === 'number' && decoded.exp <= Math.floor(Date.now() / 1000);
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

  if (hasExpired(saasAccessToken)) {
    throw sessionExpired('The Forest server access of this session expired');
  }

  return saasAccessToken;
}
