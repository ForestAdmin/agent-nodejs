import { ambiguousCredentials, unauthorized } from '../http/bff-http-error';

export type AuthMode = 'oauth' | 'api-key';

const BEARER_PREFIX = 'Bearer ';

export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization || !authorization.startsWith(BEARER_PREFIX)) return undefined;

  const token = authorization.slice(BEARER_PREFIX.length).trim();

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
