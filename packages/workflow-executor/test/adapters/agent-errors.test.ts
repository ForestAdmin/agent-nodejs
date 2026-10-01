import { AgentHttpError } from '@forestadmin/agent-client';

import {
  agentErrorDetail,
  agentPortError,
  classifyAgentFailure,
  segmentReadError,
} from '../../src/adapters/agent-errors';
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

describe('agentPortError', () => {
  it('keeps the technical message unchanged when the cause carries no HTTP response', () => {
    const cause = new Error('ECONNREFUSED');

    const err = agentPortError('getRecord', cause);

    expect(err).toBeInstanceOf(AgentPortError);
    expect(err.message).toBe('Agent port "getRecord" failed: ECONNREFUSED');
    expect(err.cause).toBe(cause);
  });

  it("appends the error message of the agent's 5xx body to the technical message", () => {
    const cause = new AgentHttpError(500, { error: 'hook crashed' }, '{"error":"hook crashed"}');

    const err = agentPortError('getActionForm', cause);

    expect(err.message).toBe(
      'Agent port "getActionForm" failed: Agent responded with HTTP 500 | agent error: hook crashed',
    );
    expect(err.cause).toBe(cause);
  });

  it('reads the detail of a JSON:API error body', () => {
    const cause = new AgentHttpError(502, { errors: [{ detail: 'upstream unavailable' }] });

    const err = agentPortError('executeAction', cause);

    expect(err.message).toBe(
      'Agent port "executeAction" failed: Agent responded with HTTP 502 | agent error: upstream unavailable',
    );
  });

  it('leaves out everything in the body but the error message', () => {
    const cause = new AgentHttpError(500, {
      errors: [{ detail: 'hook crashed', meta: { stack: 'at record 42 a@b.co' } }],
      data: { email: 'a@b.co' },
    });

    const err = agentPortError('getActionForm', cause);

    expect(err.message).toBe(
      'Agent port "getActionForm" failed: Agent responded with HTTP 500 | agent error: hook crashed',
    );
  });

  it('adds nothing for a body that is not a JSON error, such as an HTML error page', () => {
    const page = '<html><body>Internal Error at record 42</body></html>';

    const err = agentPortError('getActionForm', new AgentHttpError(502, page, page));

    expect(err.message).toBe('Agent port "getActionForm" failed: Agent responded with HTTP 502');
  });

  it.each([400, 401, 403, 422])(
    'keeps a %i response out of the technical message, since its detail can quote the refused input',
    status => {
      const cause = new AgentHttpError(status, { errors: [{ detail: 'email a@b.co is taken' }] });

      const err = agentPortError('updateRecord', cause);

      expect(err.message).toBe(
        `Agent port "updateRecord" failed: Agent responded with HTTP ${status}`,
      );
    },
  );

  it('keeps the agent message of a 4xx out of the AgentPortError message', () => {
    const cause = new AgentHttpError(400, { error: 'value jane@acme.com refused' });

    expect(agentPortError('listSegmentRecordIds', cause).message).toBe(
      'Agent port "listSegmentRecordIds" failed: Agent responded with HTTP 400',
    );
  });

  it('flattens line breaks and control characters of the error message onto one line', () => {
    const cause = new AgentHttpError(500, { error: 'hook\n  crashed\ton\r\nload\u0007' });

    const err = agentPortError('getActionForm', cause);

    expect(err.message).toBe(
      'Agent port "getActionForm" failed: Agent responded with HTTP 500 | agent error: hook crashed on load',
    );
  });

  it('truncates an error message longer than 500 characters', () => {
    const cause = new AgentHttpError(500, { error: 'x'.repeat(600) });

    const err = agentPortError('getActionForm', cause);

    expect(err.message).toBe(
      `Agent port "getActionForm" failed: Agent responded with HTTP 500 | agent error: ${'x'.repeat(
        500,
      )}…`,
    );
  });

  it('adds nothing when the error body carries no usable message', () => {
    const cause = new AgentHttpError(500, { errors: [{ detail: '   ' }], error: 42 });

    const err = agentPortError('getActionForm', cause);

    expect(err.message).toBe('Agent port "getActionForm" failed: Agent responded with HTTP 500');
  });
});

describe('agentErrorDetail', () => {
  it("reads the agent's error message of a 4xx off the agent's answer", () => {
    const cause = new AgentHttpError(400, { errors: [{ detail: 'Unknown segment\nto-review' }] });

    expect(agentErrorDetail(cause)).toBe('Unknown segment to-review');
  });

  it('truncates an error message longer than 500 characters', () => {
    const cause = new AgentHttpError(400, { error: 'x'.repeat(600) });

    expect(agentErrorDetail(cause)).toBe(`${'x'.repeat(500)}…`);
  });

  it('never falls back to the raw response text', () => {
    const cause = new AgentHttpError(400, undefined, '<html>record jane@acme.com</html>');

    expect(agentErrorDetail(cause)).toBeUndefined();
  });
});
