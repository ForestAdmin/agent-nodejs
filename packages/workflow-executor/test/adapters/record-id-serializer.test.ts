import { deserializeRecordId, serializeRecordId } from '../../src/adapters/record-id-serializer';
import { RecordIdSerializationError } from '../../src/errors';

describe('serializeRecordId', () => {
  it('single id → no pipe', () => {
    expect(serializeRecordId(['42'])).toBe('42');
  });

  it('composite ids → pipe-joined', () => {
    expect(serializeRecordId(['id1', 'id2'])).toBe('id1|id2');
  });

  it('numbers are stringified', () => {
    expect(serializeRecordId([42, 99])).toBe('42|99');
  });

  it('mixed string and number ids', () => {
    expect(serializeRecordId(['org', 42])).toBe('org|42');
  });

  // '|' is the reserved segment delimiter, so a part that contains it would over-split on the way
  // back and match the wrong record. Fail loudly instead of silently corrupting the key.
  it('throws when a part contains the reserved pipe separator', () => {
    expect(() => serializeRecordId(['a|b'])).toThrow(RecordIdSerializationError);
  });
});

describe('deserializeRecordId', () => {
  it('single id → single-element array', () => {
    expect(deserializeRecordId('42')).toEqual(['42']);
  });

  it('pipe string → multi-element array', () => {
    expect(deserializeRecordId('id1|id2')).toEqual(['id1', 'id2']);
  });

  it('three segments', () => {
    expect(deserializeRecordId('a|b|c')).toEqual(['a', 'b', 'c']);
  });

  // deserialize stays permissive (bare split). Empty segments from a malformed wire value are
  // rejected at the validation boundaries that consume the result, not here.
  it('over-splits a raw value containing the reserved pipe (rejected at the boundary, not here)', () => {
    expect(deserializeRecordId('a|b|c')).toEqual(['a', 'b', 'c']);
    expect(deserializeRecordId('a|')).toEqual(['a', '']);
  });
});
