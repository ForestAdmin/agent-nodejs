// eslint-disable-next-line max-classes-per-file
export class BusinessError extends Error {
  public readonly data: Record<string, unknown> | undefined;

  constructor(message?: string, data?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.data = data;
  }
}

export class ValidationError extends BusinessError {}
export class UnprocessableError extends BusinessError {}
export class ForbiddenError extends BusinessError {}
