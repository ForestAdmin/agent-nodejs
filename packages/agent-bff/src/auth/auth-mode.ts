import { ambiguousCredentials, unauthorized } from '../http/bff-http-error';

export type AuthMode = 'oauth' | 'api-key';

const BEARER_PATTERN = /^Bearer[ \t]+(.+)$/i;

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
