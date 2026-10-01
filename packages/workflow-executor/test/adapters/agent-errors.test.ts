import { AgentHttpError } from '@forestadmin/agent-client';

import { classifyAgentFailure, segmentReadError } from '../../src/adapters/agent-errors';
import { AgentPortError, SegmentReadError } from '../../src/errors';

const answered = (status: number) => new AgentHttpError(status, {}, '');

const withCode = (code: string) => Object.assign(new Error(`agent unreachable: ${code}`), { code });

describe('classifyAgentFailure', () => {
  it.each([
    ['a 401', answered(401), { failure: 'forbidden', httpStatus: 401 }],
    ['a 403', answered(403), { failure: 'forbidden', httpStatus: 403 }],
    ['a 502', answered(502), { failure: 'unreachable', httpStatus: 502 }],
    ['a 503', answered(503), { failure: 'unreachable', httpStatus: 503 }],
    ['a 504', answered(504), { failure: 'unreachable', httpStatus: 504 }],
    ['a 408', answered(408), { failure: 'overloaded', httpStatus: 408 }],
    ['a 429', answered(429), { failure: 'overloaded', httpStatus: 429 }],
    ['a 500', answered(500), { failure: 'failed', httpStatus: 500 }],
    ['a 400', answered(400), { failure: 'failed', httpStatus: 400 }],
    ['a response without a status', answered(0), { failure: 'unreachable' }],
    ['a status past the HTTP range', answered(600), { failure: 'unreachable' }],
    ['a timeout', withCode('ECONNABORTED'), { failure: 'unreachable' }],
    ['a refused connection', withCode('ECONNREFUSED'), { failure: 'unreachable' }],
    ['an unknown host', withCode('ENOTFOUND'), { failure: 'unreachable' }],
    ['a reset connection', withCode('ECONNRESET'), { failure: 'unreachable' }],
    ['a temporary DNS failure', withCode('EAI_AGAIN'), { failure: 'unreachable' }],
    ['an unreachable host', withCode('EHOSTUNREACH'), { failure: 'unreachable' }],
    ['an unreachable network', withCode('ENETUNREACH'), { failure: 'unreachable' }],
    ['a broken pipe', withCode('EPIPE'), { failure: 'unreachable' }],
    ['a socket timeout', withCode('ETIMEDOUT'), { failure: 'unreachable' }],
    [
      'an error of its own before any answer',
      new Error('secretOrPrivateKey must have a value'),
      { failure: 'failed' },
    ],
  ])('should classify %s', (_, cause, expected) => {
    expect(classifyAgentFailure(cause)).toStrictEqual(expected);
  });
});

describe('segmentReadError', () => {
  it("should keep the port error message, with the agent's error of a 5xx", () => {
    const cause = new AgentHttpError(500, { errors: [{ detail: 'hook crashed' }] });

    const error = segmentReadError('listSegmentRecordIds', cause);

    expect(error).toBeInstanceOf(SegmentReadError);
    expect(error).toBeInstanceOf(AgentPortError);
    expect(error.message).toBe(
      'Agent port "listSegmentRecordIds" failed: Agent responded with HTTP 500 | agent error: hook crashed',
    );
    expect(error.cause).toBe(cause);
    expect(error.failure).toBe('failed');
    expect(error.httpStatus).toBe(500);
    expect(error.agentDetail).toBe('hook crashed');
  });

  it("should read the agent's error of a 4xx while keeping it out of the message", () => {
    const cause = new AgentHttpError(403, { errors: [{ detail: 'Missing permission' }] });

    const error = segmentReadError('listFieldOperators', cause);

    expect(error.message).toBe(
      'Agent port "listFieldOperators" failed: Agent responded with HTTP 403',
    );
    expect(error.cause).toBe(cause);
    expect(error.failure).toBe('forbidden');
    expect(error.httpStatus).toBe(403);
    expect(error.agentDetail).toBe('Missing permission');
  });

  it('should carry neither a status nor an agent error when the agent never answered', () => {
    const cause = withCode('ECONNREFUSED');

    const error = segmentReadError('listSegmentRecordIds', cause);

    expect(error.message).toBe(
      'Agent port "listSegmentRecordIds" failed: agent unreachable: ECONNREFUSED',
    );
    expect(error.cause).toBe(cause);
    expect(error.failure).toBe('unreachable');
    expect(error.httpStatus).toBeUndefined();
    expect(error.agentDetail).toBeUndefined();
  });
});
