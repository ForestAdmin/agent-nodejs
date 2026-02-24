// eslint-disable-next-line max-classes-per-file
export class BusinessError extends Error {
  // INTERNAL USAGES
  public readonly isBusinessError = true;
  public readonly baseBusinessErrorName: string;

  public readonly data: Record<string, unknown> | undefined;

  constructor(
    message?: string,
    data?: Record<string, unknown>,
    name?: string,
    baseBusinessErrorName?: string,
  ) {
    super(message);
    this.name = name ?? this.constructor.name;
    this.data = data;
    this.baseBusinessErrorName = baseBusinessErrorName ?? this.constructor.name;
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
    super(message, data, name, 'ValidationError');
  }
}
export class BadRequestError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 'BadRequestError');
  }
}
export class UnprocessableError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 'UnprocessableError');
  }
}
export class ForbiddenError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 'ForbiddenError');
  }
}
export class NotFoundError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 'NotFoundError');
  }
}
export class UnauthorizedError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 'UnauthorizedError');
  }
}
export class TooManyRequestsError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 'TooManyRequestsError');
  }
}
