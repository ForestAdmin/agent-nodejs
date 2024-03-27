/* eslint-disable max-classes-per-file */
export class BusinessError extends Error {}
export class ValidationError extends BusinessError {}
export class CustomizationError extends BusinessError {
  constructor(message: string, stack?: string) {
    super(message);
    this.stack = stack;
  }
}
export class CloudToolkitVersionError extends BusinessError {}
