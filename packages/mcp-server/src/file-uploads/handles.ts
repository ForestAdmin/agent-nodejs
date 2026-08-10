import jsonwebtoken from 'jsonwebtoken';

const HANDLE_TYPE = 'mcp-upload';

export interface UploadHandleClaims {
  key: string;
  name: string;
  mimeType: string;
  sha256Base64?: string;
}

export function signUploadHandle(
  claims: UploadHandleClaims & { userId: number | string },
  authSecret: string,
  ttlSeconds: number,
): string {
  return jsonwebtoken.sign(
    {
      type: HANDLE_TYPE,
      key: claims.key,
      name: claims.name,
      mime: claims.mimeType,
      uploader: String(claims.userId),
      ...(claims.sha256Base64 && { sha256: claims.sha256Base64 }),
    },
    authSecret,
    { expiresIn: ttlSeconds },
  );
}

export function verifyUploadHandle(
  handle: string,
  userId: number | string,
  authSecret: string,
): UploadHandleClaims {
  const decoded = jsonwebtoken.verify(handle, authSecret, { algorithms: ['HS256'] }) as {
    type?: string;
    key: string;
    name: string;
    mime: string;
    uploader?: string;
    sha256?: string;
  };

  // The handle is signed with the secret that also signs access tokens, so the type claim is
  // what keeps an access token from being redeemed as an upload handle.
  if (decoded?.type !== HANDLE_TYPE) throw new Error('Not an upload handle');
  if (decoded.uploader !== String(userId)) throw new Error('Handle was issued to another user');

  // key feeds storage.download and mime lands in the stored file, so neither may be undefined.
  if (
    typeof decoded.key !== 'string' ||
    typeof decoded.name !== 'string' ||
    typeof decoded.mime !== 'string'
  ) {
    throw new Error('Malformed upload handle');
  }

  return {
    key: decoded.key,
    name: decoded.name,
    mimeType: decoded.mime,
    sha256Base64: decoded.sha256,
  };
}
