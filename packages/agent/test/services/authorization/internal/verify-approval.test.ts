import verifyAndExtractApproval from '../../../../src/services/authorization/internal/verify-approval';

import { UnableToVerifyJTWError } from '../../../../src/services/authorization/internal/types';

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

describe('verifyAndExtractApproval', () => {
  describe('invalid approval request token', () => {
    it('should throw an error', () => {
      expect(() => verifyAndExtractApproval('token', 'privateKey')).toThrow(UnableToVerifyJTWError);
    });
  });

  describe('invalid secretKey', () => {
    it('should throw an error', () => {
      expect(() => verifyAndExtractApproval(TOKEN, 'privateKey')).toThrow(UnableToVerifyJTWError);
    });
  });

  describe('valid secretKey', () => {
    it('should return the data payload of the token', () => {
      const dataPayload = verifyAndExtractApproval(TOKEN, 'my-secret');
      expect(dataPayload.id).toStrictEqual('forest-test-ok');
    });
  });
});
