/* eslint-disable max-classes-per-file */
export class BusinessError extends Error {}
export class CustomizationError extends Error {
  constructor(message: string, stack?: string) {
    super(message);
    this.stack = stack;
  }
}
