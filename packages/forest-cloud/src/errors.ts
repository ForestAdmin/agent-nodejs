/* eslint-disable max-classes-per-file */
import { BusinessError } from '@forestadmin/datasource-toolkit';

export { BusinessError };
export class ValidationError extends BusinessError {}
export class CustomizationError extends BusinessError {
  constructor(message: string, stack?: string) {
    super(message);
    this.stack = stack;
  }
}
export class CloudToolkitVersionError extends BusinessError {}
