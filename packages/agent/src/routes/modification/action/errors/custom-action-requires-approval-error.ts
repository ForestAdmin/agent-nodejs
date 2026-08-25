import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class CustomActionRequiresApprovalError extends ForbiddenError {
  // `recordIds` is only set for a "select all" trigger: the frontend has no explicit id list in
  // that case, so the agent resolves the selection (capped) and hands the ids back to be stored in
  // the approval request.
  constructor(roleIdsAllowedToApprove: number[], recordIds?: Array<string | number>) {
    super('This action requires to be approved.', {
      roleIdsAllowedToApprove,
      ...(recordIds ? { recordIds } : {}),
    });
  }
}
