import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class CustomActionRequiresApprovalError extends ForbiddenError {
  data: { rolesIdsAllowedToApprove: number[] };

  constructor(rolesIdsAllowedToApprove: number[]) {
    super('This action requires to be approved.');

    this.data = {
      rolesIdsAllowedToApprove,
    };
  }
}
