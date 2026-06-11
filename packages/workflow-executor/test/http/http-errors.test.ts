import {
  InvalidPendingDataError,
  RunAlreadyInFlightError,
  RunNotFoundError,
  RunStorePortError,
  UserMismatchError,
  WorkflowPortError,
} from '../../src/errors';
import {
  BadRequestHttpError,
  BaseHttpError,
  ConflictHttpError,
  ForbiddenHttpError,
  NotFoundHttpError,
  ServiceUnavailableHttpError,
  UnauthorizedHttpError,
  toHttpError,
} from '../../src/http/http-errors';

describe('http status classes', () => {
  it.each([
    [new BadRequestHttpError('bad'), 400, 'bad'],
    [new UnauthorizedHttpError(), 401, 'Unauthorized'],
    [new ForbiddenHttpError(), 403, 'Forbidden'],
    [new NotFoundHttpError('gone'), 404, 'gone'],
    [new ConflictHttpError('busy'), 409, 'busy'],
    [new ServiceUnavailableHttpError('down'), 503, 'down'],
  ] as const)('%s carries its status and userMessage', (err, status, message) => {
    expect(err).toBeInstanceOf(BaseHttpError);
    expect(err.status).toBe(status);
    expect(err.userMessage).toBe(message);
    expect(err.name).toBe(err.constructor.name);
  });

  it('defaults log to false and omits an unset cause', () => {
    const err = new NotFoundHttpError('gone');

    expect(err.log).toBe(false);
    expect(err.cause).toBeUndefined();
  });

  it('carries log and cause when provided', () => {
    const cause = new Error('boom');
    const err = new ServiceUnavailableHttpError('down', { log: true, cause });

    expect(err.log).toBe(true);
    expect(err.cause).toBe(cause);
  });
});

describe('toHttpError', () => {
  it('passes through an already-typed HttpError unchanged', () => {
    const err = new NotFoundHttpError('gone');

    expect(toHttpError(err)).toBe(err);
  });

  it('maps koa-jwt 401 errors (status property) to a 401 Unauthorized', () => {
    const result = toHttpError(Object.assign(new Error('jwt expired'), { status: 401 }));

    expect(result).toBeInstanceOf(UnauthorizedHttpError);
    expect(result?.status).toBe(401);
    expect(result?.userMessage).toBe('Unauthorized');
  });

  it('maps a NotFoundError category to 404 with its userMessage (not logged)', () => {
    const domainError = new RunNotFoundError('run-1');
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(NotFoundHttpError);
    expect(result?.status).toBe(404);
    expect(result?.userMessage).toBe('Run not found or unavailable');
    expect(result?.log).toBe(false);
    expect(result?.cause).toBe(domainError);
  });

  it('maps a ConflictError category to 409 with its userMessage (not logged)', () => {
    const domainError = new RunAlreadyInFlightError('run-1');
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(ConflictHttpError);
    expect(result?.status).toBe(409);
    expect(result?.userMessage).toBe('Run "run-1" is already being processed');
    expect(result?.log).toBe(false);
    expect(result?.cause).toBe(domainError);
  });

  it('maps an AccessDeniedError category to a logged 403 Forbidden (opaque body, no id leak)', () => {
    const domainError = new UserMismatchError('run-1', 7, 42);
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(ForbiddenHttpError);
    expect(result?.status).toBe(403);
    expect(result?.userMessage).toBe('Forbidden');
    expect(result?.log).toBe(true);
    expect(result?.cause).toBe(domainError);
  });

  it.each([
    ['RunStorePortError', new RunStorePortError('getStepExecutions', new Error('db down'))],
    ['WorkflowPortError', new WorkflowPortError('getAvailableRun', new Error('http 502'))],
  ])(
    'maps an UnavailableError category (%s) to a logged 503 with its userMessage',
    (_, domainError) => {
      const result = toHttpError(domainError);

      expect(result).toBeInstanceOf(ServiceUnavailableHttpError);
      expect(result?.status).toBe(503);
      expect(result?.userMessage).toBe(domainError.userMessage);
      expect(result?.log).toBe(true);
      expect(result?.cause).toBe(domainError);
    },
  );

  it('maps any uncategorized WorkflowExecutorError to a logged 400 with its userMessage', () => {
    const domainError = new InvalidPendingDataError([]);
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(BadRequestHttpError);
    expect(result?.status).toBe(400);
    expect(result?.userMessage).toBe('The request body is invalid.');
    expect(result?.log).toBe(true);
    expect(result?.cause).toBe(domainError);
  });

  it('returns null for errors with no HTTP translation', () => {
    expect(toHttpError(new Error('boom'))).toBeNull();
    expect(toHttpError('not even an error')).toBeNull();
    expect(toHttpError(undefined)).toBeNull();
  });
});
