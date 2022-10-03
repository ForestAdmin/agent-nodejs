import verifyAndExtractApproval from '../../../../src/services/authorization/internal/verify-approval';

import {
  JTWTokenExpiredError,
  JTWUnableToVerifyError,
} from '../../../../src/services/authorization/internal/types';

/**
 * Fake token generated with "my-secret" HMACSHA256 private key
 * Payload:
 * {
 * "data": {
 *     "id": "forest-test-ok"
 *   }
 * }
 */
const TOKEN =
  // eslint-disable-next-line max-len
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiZm9yZXN0LXRlc3Qtb2sifX0.9m5q7pCqFCzRESPsv9ITsx2a2Gndx80s_fd6v9j3Dlc';

const EXPIRED_TOKEN =
  // eslint-disable-next-line max-len
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiZm9yZXN0LXRlc3Qtb2sifSwiZXhwIjoxNTE2MjM5MDIyfQ.7t9zLeE_wffl6j6cb6EbAQj02eYDZ1IQ5fPJeT1sNzo';

describe('verifyAndExtractApproval', () => {
  describe('invalid approval request token', () => {
    it('should throw a JTWUnableToVerifyError error', () => {
      expect(() => verifyAndExtractApproval('token', 'privateKey')).toThrow(JTWUnableToVerifyError);
    });
  });

  describe('invalid secretKey', () => {
    it('should throw a JTWUnableToVerifyError error', () => {
      expect(() => verifyAndExtractApproval(TOKEN, 'privateKey')).toThrow(JTWUnableToVerifyError);
    });
  });

  describe('expired token', () => {
    it('should throw a JTWTokenExpiredError error', () => {
      expect(() => verifyAndExtractApproval(EXPIRED_TOKEN, 'my-secret')).toThrow(
        JTWTokenExpiredError,
      );
    });
  });

  describe('valid secretKey', () => {
    it('should return the data payload of the token', () => {
      const dataPayload = verifyAndExtractApproval(TOKEN, 'my-secret');
      expect(dataPayload.id).toStrictEqual('forest-test-ok');
    });
  });
});
