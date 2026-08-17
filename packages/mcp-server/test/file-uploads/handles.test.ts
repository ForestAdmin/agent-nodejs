import jsonwebtoken from 'jsonwebtoken';

import {
  UPLOADED_FILE_PREFIX,
  signUploadHandle,
  verifyUploadHandle,
} from '../../src/file-uploads/handles';

const AUTH_SECRET = 'test-auth-secret';

const claims = {
  key: 'mcp-uploads/uuid/report.pdf',
  name: 'report.pdf',
  mimeType: 'application/pdf',
  userId: 42,
};

describe('upload handles', () => {
  it('exports the sentinel prefix used inside action values', () => {
    expect(UPLOADED_FILE_PREFIX).toBe('$uploadedFile:');
  });

  describe('signUploadHandle / verifyUploadHandle', () => {
    it('round-trips the claims for the same user', () => {
      const handle = signUploadHandle(claims, AUTH_SECRET, 60);

      expect(verifyUploadHandle(handle, 42, AUTH_SECRET)).toEqual({
        key: 'mcp-uploads/uuid/report.pdf',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        sha256: undefined,
      });
    });

    it('carries the sha256 pin when provided', () => {
      const handle = signUploadHandle({ ...claims, sha256: 'digest==' }, AUTH_SECRET, 60);

      expect(verifyUploadHandle(handle, 42, AUTH_SECRET).sha256).toBe('digest==');
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

    it('rejects a token signed with another secret', () => {
      const handle = signUploadHandle(claims, 'other-secret', 60);

      expect(() => verifyUploadHandle(handle, 42, AUTH_SECRET)).toThrow('invalid signature');
    });

    it('rejects a JWT that is not an upload handle', () => {
      const accessTokenLookalike = jsonwebtoken.sign({ id: 42 }, AUTH_SECRET, { expiresIn: 60 });

      expect(() => verifyUploadHandle(accessTokenLookalike, 42, AUTH_SECRET)).toThrow(
        'Not an upload handle',
      );
    });
  });
});
