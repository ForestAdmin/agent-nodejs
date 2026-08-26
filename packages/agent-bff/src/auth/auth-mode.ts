import type { BffAccessTokenPayload } from '../oauth/bff-token';

import { ambiguousCredentials, unauthorized } from '../http/bff-http-error';

export type AuthMode = 'oauth' | 'api-key';

const BEARER_PATTERN = /^Bearer[ \t]+(.+)$/i;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

export function requireRenderingId(principal: BffAccessTokenPayload): number {
  if (!POSITIVE_INTEGER.test(String(principal.rendering_id))) {
    throw unauthorized('The session carries no usable rendering');
  }

  return Number(principal.rendering_id);
}

export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;

  const match = BEARER_PATTERN.exec(authorization.trim());
  if (!match) return undefined;

  const token = match[1].trim();

  return token === '' ? undefined : token;
}

export function resolveAuthMode({
  hasBearer,
  hasApiKey,
}: {
  hasBearer: boolean;
  hasApiKey: boolean;
}): AuthMode {
  if (hasBearer && hasApiKey) throw ambiguousCredentials();
  if (hasApiKey) return 'api-key';
  if (hasBearer) return 'oauth';

  throw unauthorized();
}
