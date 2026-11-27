import serializeRecordId, { deserializeRecordId } from '../src/record-id';

describe('serializeRecordId', () => {
  it('should return a string as-is', () => {
    expect(serializeRecordId('abc')).toBe('abc');
  });

  it('should coerce a number to string', () => {
    expect(serializeRecordId(42)).toBe('42');
  });

  it('should pipe-join a composite array of strings and numbers', () => {
    expect(serializeRecordId([1, 'abc', 2])).toBe('1|abc|2');
  });

  it('should handle a single-element array', () => {
    expect(serializeRecordId([42])).toBe('42');
  });

  it('should throw on an empty composite array', () => {
    expect(() => serializeRecordId([])).toThrow('Composite record id cannot be empty');
  });

  it('should throw when a composite part is null', () => {
    expect(() => serializeRecordId([1, null as unknown as string])).toThrow(
      'Composite record id parts cannot be null or undefined',
    );
  });

  it('should throw when a composite part is undefined', () => {
    expect(() => serializeRecordId([1, undefined as unknown as string])).toThrow(
      'Composite record id parts cannot be null or undefined',
    );
  });

  it('should throw when a composite part contains the pipe separator', () => {
    expect(() => serializeRecordId(['1|abc', 2])).toThrow(
      'Composite record id part "1|abc" cannot contain the "|" separator',
    );
  });
});

describe('deserializeRecordId', () => {
  it('should split a packed composite id on the pipe separator', () => {
    expect(deserializeRecordId('1|abc|2')).toEqual(['1', 'abc', '2']);
  });

  it('should return a single part for a simple id', () => {
    expect(deserializeRecordId('42')).toEqual(['42']);
  });
});
