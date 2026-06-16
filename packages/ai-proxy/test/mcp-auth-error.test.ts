import { classifyMcpLoadError, isMcpAuthError } from '../src/mcp-auth-error';

function withCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as { cause?: unknown }).cause = cause;

  return error;
}

describe('isMcpAuthError', () => {
  it('detects a 401 numeric status field', () => {
    expect(isMcpAuthError({ code: 401 })).toBe(true);
  });

  it('detects a 403 numeric status field', () => {
    expect(isMcpAuthError(Object.assign(new Error('denied'), { status: 403 }))).toBe(true);
  });

  it('detects 401 / unauthorized / forbidden in the message', () => {
    expect(isMcpAuthError(new Error('Request failed with status code 401'))).toBe(true);
    expect(isMcpAuthError(new Error('Unauthorized'))).toBe(true);
    expect(isMcpAuthError(new Error('403 Forbidden'))).toBe(true);
  });

  it('walks the cause chain', () => {
    expect(
      isMcpAuthError(withCause('wrapper', Object.assign(new Error('inner'), { status: 401 }))),
    ).toBe(true);
  });

  it('returns false for non-auth errors and nullish input', () => {
    expect(isMcpAuthError(new Error('ECONNREFUSED'))).toBe(false);
    expect(isMcpAuthError(new Error('500 Internal Server Error'))).toBe(false);
    expect(isMcpAuthError(undefined)).toBe(false);
  });
});

describe('classifyMcpLoadError', () => {
  it("classifies auth failures as 'auth'", () => {
    expect(classifyMcpLoadError(new Error('HTTP 403 Forbidden'))).toBe('auth');
    expect(classifyMcpLoadError({ status: 401 })).toBe('auth');
  });

  it("classifies network failures as 'connection'", () => {
    expect(classifyMcpLoadError(new Error('connect ECONNREFUSED 127.0.0.1:3000'))).toBe(
      'connection',
    );
    expect(classifyMcpLoadError(new Error('fetch failed'))).toBe('connection');
    expect(classifyMcpLoadError(new Error('socket hang up'))).toBe('connection');
  });

  it("classifies everything else as 'unknown'", () => {
    expect(classifyMcpLoadError(new Error('tool schema invalid'))).toBe('unknown');
  });
});
