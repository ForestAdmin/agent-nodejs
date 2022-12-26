import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class CustomActionRequiresApprovalError extends ForbiddenError {
  constructor(roleIdsAllowedToApprove: number[]) {
    super('This action requires to be approved.', {
      roleIdsAllowedToApprove,
    });
  }
}
