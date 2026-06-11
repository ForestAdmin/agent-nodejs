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
  ForbiddenHttpError,
  InvalidTokenUserIdHttpError,
  NotFoundHttpError,
  RunAccessCheckUnavailableHttpError,
  RunAccessDeniedHttpError,
  RunAlreadyInFlightHttpError,
  RunNotFoundHttpError,
  ServiceUnavailableHttpError,
  UpstreamUnavailableHttpError,
  UserMismatchHttpError,
  WorkflowStepFailedHttpError,
  toHttpError,
} from '../../src/http/http-errors';

describe('http-errors hierarchy', () => {
  it('exposes the three inheritance levels (precise > status class > BaseHttpError)', () => {
    const err = new RunNotFoundHttpError();

    expect(err).toBeInstanceOf(NotFoundHttpError);
    expect(err).toBeInstanceOf(BaseHttpError);
    expect(err).toBeInstanceOf(Error);
  });

  it.each([
    [new InvalidTokenUserIdHttpError(), 400, 'Missing or invalid user id in token', false],
    [new RunAccessDeniedHttpError(), 403, 'Forbidden', false],
    [new RunNotFoundHttpError(), 404, 'Run not found or unavailable', false],
    [new RunAccessCheckUnavailableHttpError(new Error('down')), 503, 'Service unavailable', false],
  ] as const)('%s carries status %i, userMessage and log flag', (err, status, message, log) => {
    expect(err.status).toBe(status);
    expect(err.userMessage).toBe(message);
    expect(err.log).toBe(log);
    expect(err.name).toBe(err.constructor.name);
  });
});

describe('toHttpError', () => {
  it('passes through an already-typed HttpError unchanged', () => {
    const err = new RunNotFoundHttpError();

    expect(toHttpError(err)).toBe(err);
  });

  it('maps koa-jwt 401 errors (status property) to a 401 Unauthorized', () => {
    const result = toHttpError(Object.assign(new Error('jwt expired'), { status: 401 }));

    expect(result?.status).toBe(401);
    expect(result?.userMessage).toBe('Unauthorized');
  });

  it('maps RunNotFoundError to 404 with the public message', () => {
    const result = toHttpError(new RunNotFoundError('run-1'));

    expect(result).toBeInstanceOf(RunNotFoundHttpError);
    expect(result?.status).toBe(404);
    expect(result?.userMessage).toBe('Run not found or unavailable');
    expect(result?.log).toBe(false);
  });

  it('maps RunAlreadyInFlightError to 400 carrying the domain message', () => {
    const domainError = new RunAlreadyInFlightError('run-1');
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(RunAlreadyInFlightHttpError);
    expect(result?.status).toBe(400);
    expect(result?.userMessage).toBe('Run "run-1" is already being processed');
    expect(result?.log).toBe(false);
    expect(result?.cause).toBe(domainError);
  });

  it('maps UserMismatchError to a logged 403 Forbidden', () => {
    const domainError = new UserMismatchError('run-1');
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(UserMismatchHttpError);
    expect(result?.status).toBe(403);
    expect(result?.userMessage).toBe('Forbidden');
    expect(result?.log).toBe(true);
    expect(result?.cause).toBe(domainError);
  });

  it.each([
    ['RunStorePortError', new RunStorePortError('getStepExecutions', new Error('db down'))],
    ['WorkflowPortError', new WorkflowPortError('getAvailableRun', new Error('http 502'))],
  ])('maps %s to 503 (not the 400 catch-all) with its userMessage', (_, domainError) => {
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(UpstreamUnavailableHttpError);
    expect(result).toBeInstanceOf(ServiceUnavailableHttpError);
    expect(result?.status).toBe(503);
    expect(result?.userMessage).toBe(domainError.userMessage);
    expect(result?.log).toBe(true);
    expect(result?.cause).toBe(domainError);
  });

  it('maps any other WorkflowExecutorError to a logged 400 with its userMessage', () => {
    const domainError = new InvalidPendingDataError([]);
    const result = toHttpError(domainError);

    expect(result).toBeInstanceOf(WorkflowStepFailedHttpError);
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

describe('status classes hierarchy coverage', () => {
  it.each([
    [new InvalidTokenUserIdHttpError(), BadRequestHttpError],
    [new UserMismatchHttpError(new UserMismatchError('run-1')), ForbiddenHttpError],
    [
      new UpstreamUnavailableHttpError(new WorkflowPortError('op', new Error('x'))),
      ServiceUnavailableHttpError,
    ],
  ] as const)('%s extends its status class', (err, statusClass) => {
    expect(err).toBeInstanceOf(statusClass);
    expect(err).toBeInstanceOf(BaseHttpError);
  });
});
