import jsonwebtoken, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { ActionApprovalJWT, JTWTokenExpiredError, JTWUnableToVerifyError } from './types';

export default function verifyAndExtractApproval(approvalRequestToken: string, privateKey: string) {
  try {
    return (jsonwebtoken.verify(approvalRequestToken, privateKey) as ActionApprovalJWT).data;
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
