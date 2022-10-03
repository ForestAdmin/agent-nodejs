import jsonwebtoken from 'jsonwebtoken';

import { ActionApprovalJWT, UnableToVerifyJTWError } from './types';

export default function verifyAndExtractApproval(approvalRequestToken: string, privateKey: string) {
  try {
    return (jsonwebtoken.verify(approvalRequestToken, privateKey) as ActionApprovalJWT).data;
  } catch (err) {
    throw new UnableToVerifyJTWError();
  }
}
