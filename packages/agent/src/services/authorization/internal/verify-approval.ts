import jsonwebtoken from 'jsonwebtoken';

import { ActionApprovalJWT } from './types';

export default function verifyAndExtractApproval(approvalRequestToken: string, privateKey: string) {
  try {
    return (jsonwebtoken.verify(approvalRequestToken, privateKey) as ActionApprovalJWT).data;
  } catch (err) {
    throw new Error(
      'Failed to verify and extract approval payload.' +
        ' Can you check the envSecret you have configured?',
    );
  }
}
