import mayHaveRun from '../src/agent-error';
import AgentHttpError, { AgentTimeoutError, AgentUnreachableError } from '../src/errors';

const answered = (status: number, body: unknown = {}) => new AgentHttpError(status, body, '');
const unreachable = (code: string) =>
  new AgentUnreachableError(Object.assign(new Error(`agent failure: ${code}`), { code }));

describe('agent call errors', () => {
  it.each([
    ['a 401', answered(401), 'forbidden', false, 401],
    ['a 403', answered(403), 'forbidden', false, 403],
    ['a 502', answered(502), 'unreachable', true, 502],
    ['a 503', answered(503), 'unreachable', true, 503],
    ['a 504', answered(504), 'unreachable', true, 504],
    ['a 408', answered(408), 'overloaded', true, 408],
    ['a 429', answered(429), 'overloaded', true, 429],
    ['a 500', answered(500), 'failed', false, 500],
    ['a 400', answered(400), 'failed', false, 400],
    ['a response without a status', answered(0), 'unreachable', true, undefined],
    ['a status past the HTTP range', answered(600), 'unreachable', true, undefined],
    ['a timeout', new AgentTimeoutError('Timeout', 10), 'unreachable', true, undefined],
    ['a refused connection', unreachable('ECONNREFUSED'), 'unreachable', true, undefined],
  ])('should classify %s', (_, error, kind, retryable, httpStatus) => {
    expect({ kind: error.kind, retryable: error.retryable, httpStatus: error.httpStatus }).toEqual({
      kind,
      retryable,
      httpStatus,
    });
  });

  it("should carry the agent's message of a structured 4xx", () => {
    expect(answered(422, { errors: [{ detail: 'Email is invalid' }] }).agentMessage).toBe(
      'Email is invalid',
    );
  });

  it('should leave out the message of a 5xx, and keep its detail', () => {
    const error = answered(500, { errors: [{ detail: 'at Object.<anonymous> (index.js:1:1)' }] });

    expect(error.agentMessage).toBeUndefined();
    expect(error.detail).toBe('at Object.<anonymous> (index.js:1:1)');
  });

  it('should leave out the message of a status past the HTTP range', () => {
    expect(answered(0, { errors: [{ detail: 'x' }] }).agentMessage).toBeUndefined();
  });

  it('should read the detail from the first non-empty message of a JSON:API error body', () => {
    const error = answered(500, {
      errors: [{ detail: '  ', message: 'hook crashed' }],
      error: 'x',
    });

    expect(error.detail).toBe('hook crashed');
  });

  it('should read the detail from the top-level error of a flat body', () => {
    expect(answered(500, { error: 'hook crashed' }).detail).toBe('hook crashed');
  });

  it('should read no detail from a body that is not a JSON error, such as an HTML page', () => {
    expect(answered(502, '<html>bad gateway</html>').detail).toBeUndefined();
  });

  it('should leave out an unstructured body', () => {
    const error = new AgentHttpError(400, '<html>Bad Request</html>', '<html>Bad Request</html>');

    expect(error.agentMessage).toBeUndefined();
  });
});

describe('mayHaveRun', () => {
  it.each([
    ['a timeout', new AgentTimeoutError('Timeout', 10), true],
    ['a reset connection', unreachable('ECONNRESET'), true],
    ['a 502', answered(502), true],
    ['a 504', answered(504), true],
    ['a refused connection', unreachable('ECONNREFUSED'), false],
    ['a 503', answered(503), false],
    ['an error of its own', new Error('secretOrPrivateKey must have a value'), false],
  ])('should tell whether %s may have run', (_, error, expected) => {
    expect(mayHaveRun(error)).toBe(expected);
  });
});
