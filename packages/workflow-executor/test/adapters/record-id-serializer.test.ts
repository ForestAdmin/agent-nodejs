import { deserializeRecordId, serializeRecordId } from '../../src/adapters/record-id-serializer';

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
});
