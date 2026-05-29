import {
  AiModelPortError,
  InvalidPendingDataError,
  NoMcpToolsError,
  PendingDataNotFoundError,
  extractErrorMessage,
} from '../src/errors';

describe('extractErrorMessage', () => {
  it('returns err.message when non-empty', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back to err.parent.message when err.message is empty (Sequelize pattern)', () => {
    const err = new Error('');
    (err as Error & { parent?: Error }).parent = new Error('connect ECONNREFUSED 127.0.0.1:5459');

    expect(extractErrorMessage(err)).toBe('connect ECONNREFUSED 127.0.0.1:5459');
  });

  it('falls back to err.cause.message when err.message is empty (Error.cause pattern)', () => {
    const err = new Error('');
    (err as Error & { cause?: Error }).cause = new Error('downstream failed');

    expect(extractErrorMessage(err)).toBe('downstream failed');
  });

  it('prefers err.parent over err.cause when both are set', () => {
    const err = new Error('');
    (err as Error & { cause?: Error }).cause = new Error('from cause');
    (err as Error & { parent?: Error }).parent = new Error('from parent');

    expect(extractErrorMessage(err)).toBe('from parent');
  });

  it('falls back to err.name when message/parent/cause are absent', () => {
    class MyError extends Error {
      override name = 'MyError';
    }

    expect(extractErrorMessage(new MyError(''))).toBe('MyError');
  });

  it('returns "Unknown error" when a custom Error overrides .name to empty string', () => {
    const err = new Error('');
    // Force-empty name to exercise the final fallback branch
    Object.defineProperty(err, 'name', { value: '' });

    expect(extractErrorMessage(err)).toBe('Unknown error');
  });

  it('converts non-Error values to string', () => {
    expect(extractErrorMessage('plain string')).toBe('plain string');
    expect(extractErrorMessage(42)).toBe('42');
    expect(extractErrorMessage(null)).toBe('null');
  });

  it('returns undefined when called with undefined', () => {
    expect(extractErrorMessage(undefined)).toBeUndefined();
    expect(extractErrorMessage()).toBeUndefined();
  });

  it('ignores a non-Error .parent (Sequelize-like shape but wrong type)', () => {
    const err = new Error('');
    (err as Error & { parent?: unknown }).parent = 'not an error';
    (err as Error & { cause?: unknown }).cause = new Error('from cause');

    expect(extractErrorMessage(err)).toBe('from cause');
  });
});

describe('NoMcpToolsError', () => {
  it('includes the requested mcpServerId in the technical message', () => {
    const err = new NoMcpToolsError('id-missing');

    expect(err.message).toBe('No MCP tools available for mcpServerId="id-missing"');
    expect(err.userMessage).toBe('No tools are available to execute this step.');
  });

  it('keeps the user-facing message generic — no internal ids must leak', () => {
    const err = new NoMcpToolsError('id-missing');

    expect(err.userMessage).toBe('No tools are available to execute this step.');
    expect(err.userMessage).not.toMatch(/id-missing/);
  });
});

describe('AiModelPortError', () => {
  it('includes the operation and Error cause message in the technical message', () => {
    const err = new AiModelPortError('invoke', new Error('timeout'));

    expect(err.message).toMatch(/invoke/);
    expect(err.message).toMatch(/timeout/);
  });

  it('converts non-Error causes to string in the technical message', () => {
    const err = new AiModelPortError('invoke', 'network failure');

    expect(err.message).toMatch(/network failure/);
  });

  it('exposes a generic user-facing message', () => {
    const err = new AiModelPortError('invoke', new Error('timeout'));

    expect(err.userMessage).toBe(
      'The AI service is unavailable. Please try again or contact your administrator.',
    );
  });

  it('stores the original cause', () => {
    const cause = new Error('root cause');
    const err = new AiModelPortError('invoke', cause);

    expect(err.cause).toBe(cause);
  });
});

describe('PendingDataNotFoundError', () => {
  it('includes the runId and stepIndex in the message', () => {
    const err = new PendingDataNotFoundError('run-42', 3);

    expect(err.message).toMatch(/run-42/);
    expect(err.message).toMatch(/3/);
  });

  it('sets name to PendingDataNotFoundError', () => {
    const err = new PendingDataNotFoundError('run-1', 0);

    expect(err.name).toBe('PendingDataNotFoundError');
  });
});

describe('InvalidPendingDataError', () => {
  it('stores the provided validation issues', () => {
    const issues = [{ path: ['field'], message: 'required', code: 'invalid_type' }];
    const err = new InvalidPendingDataError(issues);

    expect(err.issues).toBe(issues);
  });

  it('exposes a generic user-facing message', () => {
    const err = new InvalidPendingDataError([]);

    expect(err.userMessage).toBe('The request body is invalid.');
  });
});
