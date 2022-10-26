import { ForbiddenError } from '@forestadmin/datasource-toolkit';

export default class CustomActionTriggerForbiddenError extends ForbiddenError {
  constructor() {
    super("You don't have the permission to trigger this action");
  }
}
