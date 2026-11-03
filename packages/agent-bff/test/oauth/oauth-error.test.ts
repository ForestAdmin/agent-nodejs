import {
  OAuthRequestError,
  forestIdentityNotAllowed,
  invalidClient,
  invalidGrant,
  invalidRequest,
  sessionExpired,
  toErrorBody,
  tooManyRequests,
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

  describe('when a caller builds the error with a positional cause', () => {
    it('should keep the fourth argument as the cause and leave retryAfter unset', () => {
      const cause = new Error('upstream');

      const error = new OAuthRequestError(502, 'server_error', 'Upstream failed', cause);

      expect(error.cause).toBe(cause);
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('when a rate limit refuses the request', () => {
    it('should carry the retry delay without a cause', () => {
      const error = tooManyRequests(7, 'Slow down');

      expect(error).toMatchObject({ status: 429, type: 'too_many_requests', retryAfter: 7 });
      expect(error.cause).toBeUndefined();
    });
  });
});
