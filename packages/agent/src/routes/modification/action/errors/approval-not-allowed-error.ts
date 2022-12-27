import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class ApprovalNotAllowedError extends ForbiddenError {
  constructor(roleIdsAllowedToApprove: number[]) {
    super("You don't have permission to approve this action.", {
      roleIdsAllowedToApprove,
    });
  }
}
