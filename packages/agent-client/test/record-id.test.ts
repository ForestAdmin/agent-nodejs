import encodeRecordId from '../src/record-id';

describe('encodeRecordId', () => {
  it('should return a string as-is', () => {
    expect(encodeRecordId('abc')).toBe('abc');
  });

  it('should coerce a number to string', () => {
    expect(encodeRecordId(42)).toBe('42');
  });

  it('should pipe-join a composite array of strings and numbers', () => {
    expect(encodeRecordId([1, 'abc', 2])).toBe('1|abc|2');
  });

  it('should handle a single-element array', () => {
    expect(encodeRecordId([42])).toBe('42');
  });

  it('should throw on an empty composite array', () => {
    expect(() => encodeRecordId([])).toThrow('Composite record id cannot be empty');
  });

  it('should throw when a composite part is null', () => {
    expect(() => encodeRecordId([1, null as unknown as string])).toThrow(
      'Composite record id parts cannot be null or undefined',
    );
  });

  it('should throw when a composite part is undefined', () => {
    expect(() => encodeRecordId([1, undefined as unknown as string])).toThrow(
      'Composite record id parts cannot be null or undefined',
    );
  });

  it('should throw when a composite part contains the pipe separator', () => {
    expect(() => encodeRecordId(['1|abc', 2])).toThrow(
      'Composite record id part "1|abc" cannot contain the "|" separator',
    );
  });
});
