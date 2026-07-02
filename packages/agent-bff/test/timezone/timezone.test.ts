import { BffHttpError } from '../../src/http/bff-http-error';
import { isValidTimezone, resolveTimezone } from '../../src/timezone/timezone';

describe('isValidTimezone', () => {
  it.each(['Europe/Paris', 'America/New_York', 'UTC'])('accepts %s', tz => {
    expect(isValidTimezone(tz)).toBe(true);
  });

  it.each(['Mars/Phobos', 'Not/AZone', ''])('rejects %s', tz => {
    expect(isValidTimezone(tz)).toBe(false);
  });

  it('accepts an IANA zone in non-canonical casing', () => {
    expect(isValidTimezone('europe/paris')).toBe(true);
  });
});

describe('resolveTimezone', () => {
  it('prefers the header over body and fallback', () => {
    expect(
      resolveTimezone({ header: 'America/New_York', body: 'Asia/Tokyo', fallback: 'UTC' }),
    ).toBe('America/New_York');
  });

  it('uses the body when the header is absent', () => {
    expect(resolveTimezone({ body: 'Asia/Tokyo', fallback: 'UTC' })).toBe('Asia/Tokyo');
  });

  it('uses the fallback when header and body are absent', () => {
    expect(resolveTimezone({ fallback: 'Europe/Paris' })).toBe('Europe/Paris');
  });

  it('skips blank sources', () => {
    expect(resolveTimezone({ header: '   ', body: '', fallback: 'UTC' })).toBe('UTC');
  });

  it('throws missing_timezone when nothing resolves', () => {
    expect(() => resolveTimezone({})).toThrow(
      expect.objectContaining({ type: 'missing_timezone', status: 400 }),
    );
    expect(() => resolveTimezone({})).toThrow(BffHttpError);
  });

  it('throws invalid_timezone when the resolved value is not IANA', () => {
    expect(() => resolveTimezone({ header: 'Mars/Phobos' })).toThrow(
      expect.objectContaining({ type: 'invalid_timezone', status: 400 }),
    );
  });
});
