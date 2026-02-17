// eslint-disable-next-line max-classes-per-file
export class BusinessError extends Error {
  // INTERNAL USAGES
  public readonly isBusinessError = true;
  public baseBusinessErrorName: string;

  public readonly data: Record<string, unknown> | undefined;

  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message);
    this.name = name ?? this.constructor.name;
    this.data = data;
  }

  /**
   * We cannot rely on `instanceof` because there can be some mismatch between
   * packages versions as dependencies of different packages.
   * So this function is a workaround to check if an error is of a specific type.
   */
  static isOfType(error: Error, ErrorConstructor: new (...args: never[]) => Error): boolean {
    return (
      error.name === ErrorConstructor.name ||
      (error as BusinessError).baseBusinessErrorName === ErrorConstructor.name
    );
  }
}

export class ValidationError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'ValidationError';
  }
}
export class BadRequestError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'BadRequestError';
  }
}
export class UnprocessableError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'UnprocessableError';
  }
}
export class ForbiddenError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'ForbiddenError';
  }
}
export class NotFoundError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name);
    this.baseBusinessErrorName = 'NotFoundError';
  }
}
