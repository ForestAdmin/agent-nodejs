import { UnprocessableError } from '@forestadmin/datasource-toolkit';

export default class ApprovalSelectionTooLargeError extends UnprocessableError {
  constructor(max: number) {
    super(
      `This action requires approval and cannot be triggered on more than ${max} records at once. ` +
        `Please refine your selection.`,
    );
  }
}
