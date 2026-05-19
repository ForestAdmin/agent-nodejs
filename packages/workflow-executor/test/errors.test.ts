import { NoMcpToolsError, extractErrorMessage } from '../src/errors';

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
    expect(extractErrorMessage(undefined)).toBe('undefined');
  });

  it('ignores a non-Error .parent (Sequelize-like shape but wrong type)', () => {
    const err = new Error('');
    (err as Error & { parent?: unknown }).parent = 'not an error';
    (err as Error & { cause?: unknown }).cause = new Error('from cause');

    expect(extractErrorMessage(err)).toBe('from cause');
  });
});

describe('NoMcpToolsError', () => {
  const Ctor = NoMcpToolsError as unknown as new (
    requestedId?: string,
    loadedIds?: readonly string[],
  ) => NoMcpToolsError;

  it('produces a fully generic technical message when no id was requested (no filter case)', () => {
    const err = new Ctor();

    expect(err.message).toBe('No MCP tools available');
    expect(err.userMessage).toBe('No tools are available to execute this step.');
  });

  it('includes the requested mcpServerId in the technical message when a filter was active', () => {
    const err = new Ctor('id-missing', ['id-A', 'id-B']);

    expect(err.message).toMatch(/id-missing/);
  });

  it('lists the loaded MCP config ids in the technical message so misconfigurations are diagnosable', () => {
    const err = new Ctor('id-missing', ['id-A', 'id-B']);

    expect(err.message).toMatch(/id-A/);
    expect(err.message).toMatch(/id-B/);
  });

  it('handles an empty loaded-id list without producing a malformed message', () => {
    const err = new Ctor('id-missing', []);

    expect(err.message).toMatch(/id-missing/);
    expect(err.message).not.toMatch(/undefined|null|\[object/i);
  });

  it('keeps the user-facing message generic — no internal ids must leak', () => {
    const err = new Ctor('id-missing', ['id-A', 'id-B']);

    expect(err.userMessage).toBe('No tools are available to execute this step.');
    expect(err.userMessage).not.toMatch(/id-missing|id-A|id-B/);
  });
});
