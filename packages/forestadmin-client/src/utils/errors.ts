/* eslint-disable max-classes-per-file */
export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class ForbiddenError extends HttpError {
  constructor(message?: string) {
    super(message ?? 'Forbidden', 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message?: string) {
    super(message ?? 'Not found', 404);
    this.name = 'NotFoundError';
  }
}
