// eslint-disable-next-line max-classes-per-file
export class BusinessError extends Error {
  // INTERNAL USAGES
  public readonly isBusinessError = true;
  public baseBusinessErrorName: string;
  public httpCode: number;

  public readonly data: Record<string, unknown> | undefined;

  constructor(message?: string, data?: Record<string, unknown>, name?: string, httpCode = 422) {
    super(message);
    this.name = name ?? this.constructor.name;
    this.data = data;
    this.httpCode = httpCode;
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
    super(message, data, name, 400);
    this.baseBusinessErrorName = 'ValidationError';
  }
}
export class BadRequestError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 400);
    this.baseBusinessErrorName = 'BadRequestError';
  }
}
export class UnprocessableError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 422);
    this.baseBusinessErrorName = 'UnprocessableError';
  }
}
export class ForbiddenError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 403);
    this.baseBusinessErrorName = 'ForbiddenError';
  }
}
export class NotFoundError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 404);
    this.baseBusinessErrorName = 'NotFoundError';
  }
}
export class UnauthorizedError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 401);
    this.baseBusinessErrorName = 'UnauthorizedError';
  }
}
export class TooManyRequestsError extends BusinessError {
  constructor(message?: string, data?: Record<string, unknown>, name?: string) {
    super(message, data, name, 429);
    this.baseBusinessErrorName = 'TooManyRequestsError';
  }
}
