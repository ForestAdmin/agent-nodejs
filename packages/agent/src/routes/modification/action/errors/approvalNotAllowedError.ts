import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class ApprovalNotAllowedError extends ForbiddenError {
  data: { roleIdsAllowedToApprove: number[] };

  constructor(roleIdsAllowedToApprove: number[]) {
    super("You don't have permission to approve this action.");
    this.data = {
      roleIdsAllowedToApprove,
    };

    // Needed to test it... (due to toMatchObject)
    this.name = 'ApprovalNotAllowedError';
  }
}
