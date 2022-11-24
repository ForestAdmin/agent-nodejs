import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class CustomActionRequiresApprovalError extends ForbiddenError {
  data: { roleIdsAllowedToApprove: number[] };

  constructor(roleIdsAllowedToApprove: number[]) {
    super('This action requires to be approved.');

    this.data = {
      roleIdsAllowedToApprove,
    };
  }
}
