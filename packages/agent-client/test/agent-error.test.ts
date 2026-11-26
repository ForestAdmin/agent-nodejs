import classifyAgentError from '../src/agent-error';
import AgentHttpError, { AgentTimeoutError } from '../src/errors';

const answered = (status: number, body: unknown = {}) => new AgentHttpError(status, body, '');
const withCode = (code: string) => Object.assign(new Error(`agent failure: ${code}`), { code });

describe('classifyAgentError', () => {
  it.each([
    ['a 401', answered(401), { kind: 'forbidden', httpStatus: 401, retryable: false }],
    ['a 403', answered(403), { kind: 'forbidden', httpStatus: 403, retryable: false }],
    ['a 502', answered(502), { kind: 'unreachable', httpStatus: 502, retryable: true }],
    ['a 503', answered(503), { kind: 'unreachable', httpStatus: 503, retryable: true }],
    ['a 504', answered(504), { kind: 'unreachable', httpStatus: 504, retryable: true }],
    ['a 408', answered(408), { kind: 'overloaded', httpStatus: 408, retryable: true }],
    ['a 429', answered(429), { kind: 'overloaded', httpStatus: 429, retryable: true }],
    ['a 500', answered(500), { kind: 'failed', httpStatus: 500, retryable: false }],
    ['a 400', answered(400), { kind: 'failed', httpStatus: 400, retryable: false }],
    ['a response without a status', answered(0), { kind: 'unreachable', retryable: true }],
    ['a status past the HTTP range', answered(600), { kind: 'unreachable', retryable: true }],
    ['a timeout', new AgentTimeoutError('Timeout', 10), { kind: 'unreachable', retryable: true }],
    ['a refused connection', withCode('ECONNREFUSED'), { kind: 'unreachable', retryable: true }],
    ['a reset connection', withCode('ECONNRESET'), { kind: 'unreachable', retryable: true }],
    ['an unknown host', withCode('ENOTFOUND'), { kind: 'unreachable', retryable: true }],
    ['a socket timeout', withCode('ETIMEDOUT'), { kind: 'unreachable', retryable: true }],
    [
      'an error of its own before any answer',
      new Error('secretOrPrivateKey must have a value'),
      { kind: 'failed', retryable: false },
    ],
  ])('should classify %s', (_, error, expected) => {
    expect(classifyAgentError(error)).toStrictEqual(expected);
  });

  it("should carry the agent's message of a structured 4xx", () => {
    const error = answered(422, { errors: [{ detail: 'Email is invalid' }] });

    expect(classifyAgentError(error)).toStrictEqual({
      kind: 'failed',
      httpStatus: 422,
      agentMessage: 'Email is invalid',
      retryable: false,
    });
  });

  it('should leave out the message of a 5xx', () => {
    const error = answered(500, { errors: [{ detail: 'at Object.<anonymous> (index.js:1:1)' }] });

    expect(classifyAgentError(error).agentMessage).toBeUndefined();
  });

  it('should leave out an unstructured body', () => {
    const error = new AgentHttpError(400, '<html>Bad Request</html>', '<html>Bad Request</html>');

    expect(classifyAgentError(error).agentMessage).toBeUndefined();
  });
});
