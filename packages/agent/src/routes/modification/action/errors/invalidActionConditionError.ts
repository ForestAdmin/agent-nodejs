import { UnprocessableError } from '@forestadmin/datasource-toolkit';

export default class InvalidActionConditionError extends UnprocessableError {
  constructor() {
    super(
      'The conditions to trigger this action cannot be verified. Please contact an administrator.',
    );
  }
}
