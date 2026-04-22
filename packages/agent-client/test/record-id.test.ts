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

  it('should handle an empty array', () => {
    expect(encodeRecordId([])).toBe('');
  });
});
