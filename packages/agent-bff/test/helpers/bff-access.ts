import jsonwebtoken from 'jsonwebtoken';

import deriveBffAccessKey from '../../src/oauth/bff-access-key';

export const TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
export const ACCESS_TOKEN_KEY = deriveBffAccessKey(TOKEN_ENCRYPTION_KEY);

/** A `bff_access` signed as the BFF signs it for `TOKEN_ENCRYPTION_KEY`. */
export function signBffAccess(
  claims: Record<string, unknown>,
  expiresIn: string | number = '15m',
): string {
  return jsonwebtoken.sign({ type: 'bff_access', ...claims }, ACCESS_TOKEN_KEY, {
    algorithm: 'HS256',
    expiresIn,
  } as jsonwebtoken.SignOptions);
}
