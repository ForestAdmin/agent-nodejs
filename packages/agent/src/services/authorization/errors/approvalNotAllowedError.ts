import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class ApprovalNotAllowedError extends ForbiddenError {
  data: { rolesIdsAllowedToApprove: number[] };

  constructor(rolesIdsAllowedToApprove: number[]) {
    super("You don't have the permission to approve this action.");

    this.data = {
      rolesIdsAllowedToApprove,
    };
  }
}
