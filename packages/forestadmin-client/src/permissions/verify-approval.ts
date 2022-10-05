import jsonwebtoken, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import JTWTokenExpiredError from './errors/jwt-token-expired-error';
import JTWUnableToVerifyError from './errors/jwt-unable-to-verify-error';

import { SmartActionRequestBody } from './types';

export default function verifyAndExtractApproval(
  approvalRequestToken: string,
  privateKey: string,
): SmartActionRequestBody {
  try {
    return jsonwebtoken.verify(approvalRequestToken, privateKey) as SmartActionRequestBody;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new JTWTokenExpiredError();
    } else if (err instanceof JsonWebTokenError) {
      throw new JTWUnableToVerifyError();
    } else {
      throw err;
    }
  }
}
