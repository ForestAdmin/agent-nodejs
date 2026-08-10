import jsonwebtoken from 'jsonwebtoken';

import { signUploadHandle, verifyUploadHandle } from '../../src/file-uploads/handles';

const AUTH_SECRET = 'test-auth-secret';

const claims = {
  key: 'mcp-uploads/uuid/report.pdf',
  name: 'report.pdf',
  mimeType: 'application/pdf',
  userId: 42,
};

describe('upload handles', () => {
  it('round-trips the claims for the same user', () => {
    const handle = signUploadHandle(claims, AUTH_SECRET, 60);

    expect(verifyUploadHandle(handle, 42, AUTH_SECRET)).toEqual({
      key: 'mcp-uploads/uuid/report.pdf',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      sha256Base64: undefined,
    });
  });

  it('carries the sha256 pin when provided', () => {
    const handle = signUploadHandle({ ...claims, sha256Base64: 'digest==' }, AUTH_SECRET, 60);

    expect(verifyUploadHandle(handle, 42, AUTH_SECRET).sha256Base64).toBe('digest==');
  });

  it('accepts a user id whose type differs between signing and redemption', () => {
    const handle = signUploadHandle(claims, AUTH_SECRET, 60);

    expect(verifyUploadHandle(handle, '42', AUTH_SECRET).key).toBe('mcp-uploads/uuid/report.pdf');
  });

  it('rejects a handle redeemed by another user', () => {
    const handle = signUploadHandle(claims, AUTH_SECRET, 60);

    expect(() => verifyUploadHandle(handle, 43, AUTH_SECRET)).toThrow(
      'Handle was issued to another user',
    );
  });

  it('rejects an expired handle', () => {
    const handle = signUploadHandle(claims, AUTH_SECRET, -1);

    expect(() => verifyUploadHandle(handle, 42, AUTH_SECRET)).toThrow('jwt expired');
  });

  it('rejects a handle signed with another secret', () => {
    const handle = signUploadHandle(claims, 'other-secret', 60);

    expect(() => verifyUploadHandle(handle, 42, AUTH_SECRET)).toThrow('invalid signature');
  });

  it('rejects an access token that was signed with the same secret', () => {
    const accessTokenLookalike = jsonwebtoken.sign({ id: 42 }, AUTH_SECRET, { expiresIn: 60 });

    expect(() => verifyUploadHandle(accessTokenLookalike, 42, AUTH_SECRET)).toThrow(
      'Not an upload handle',
    );
  });

  it.each([
    ['garbage', 'not.a.jwt'],
    ['a truncated jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ'],
    ['an empty string', ''],
  ])('rejects %s, which is what a hallucinating model sends', (_, handle) => {
    expect(() => verifyUploadHandle(handle, 42, AUTH_SECRET)).toThrow();
  });

  it('rejects a handle whose key claim is missing, instead of downloading undefined', () => {
    const forged = jsonwebtoken.sign(
      { type: 'mcp-upload', uploader: '42', name: 'x.pdf', mime: 'application/pdf' },
      AUTH_SECRET,
      { expiresIn: 60 },
    );

    expect(() => verifyUploadHandle(forged, 42, AUTH_SECRET)).toThrow('Malformed upload handle');
  });
});
