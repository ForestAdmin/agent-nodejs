import jsonwebtoken, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import JTWTokenExpiredError from './errors/jwt-token-expired-error';
import JTWUnableToVerifyError from './errors/jwt-unable-to-verify-error';

export default function verifyAndExtractApproval<TResult>(
  approvalRequestToken: string,
  privateKey: string,
): TResult {
  try {
    return jsonwebtoken.verify(approvalRequestToken, privateKey) as TResult;
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
