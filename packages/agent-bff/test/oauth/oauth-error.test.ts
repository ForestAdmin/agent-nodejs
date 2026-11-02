import {
  OAuthRequestError,
  forestIdentityNotAllowed,
  invalidClient,
  invalidGrant,
  invalidRequest,
  sessionExpired,
  toErrorBody,
} from '../../src/oauth/oauth-error';

describe('oauth-error', () => {
  describe('when serializing an error to the response body', () => {
    it('should produce the RFC 6749 flat { error, error_description } shape', () => {
      const error = invalidRequest('Missing param');

      expect(toErrorBody(error)).toEqual({
        error: 'invalid_request',
        error_description: 'Missing param',
      });
    });
  });

  describe('when building each contract error', () => {
    it.each([
      ['invalidRequest', invalidRequest('x'), 'invalid_request', 400],
      ['invalidClient', invalidClient('x'), 'invalid_client', 400],
      ['invalidGrant', invalidGrant('x'), 'invalid_grant', 400],
      [
        'forestIdentityNotAllowed',
        forestIdentityNotAllowed('x'),
        'forest_identity_not_allowed',
        403,
      ],
      ['sessionExpired', sessionExpired('x'), 'session_expired', 401],
    ])('should set %s to type %s and status %d', (_label, error, type, status) => {
      expect(error).toBeInstanceOf(OAuthRequestError);
      expect(error.type).toBe(type);
      expect(error.status).toBe(status);
    });
  });
});
