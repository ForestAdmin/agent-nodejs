import type { FieldSchema } from '../../src/types/validated/collection';

import { isEmbeddedField } from '../../src/types/validated/collection';

function fieldWithType(type: FieldSchema['type']): FieldSchema {
  return { fieldName: 'attr', displayName: 'Attr', isRelationship: false, type };
}

describe('isEmbeddedField', () => {
  it('returns true for an object (embedded document) columnType', () => {
    expect(isEmbeddedField(fieldWithType({ ssn: 'String', nationality: 'String' }))).toBe(true);
  });

  it('returns true for an array-of-objects (embedded array) columnType', () => {
    expect(isEmbeddedField(fieldWithType([{ title: 'String', amount: 'Number' }]))).toBe(true);
  });

  it('returns false for a primitive columnType', () => {
    expect(isEmbeddedField(fieldWithType('String'))).toBe(false);
  });

  it('returns false for an array-of-primitives columnType', () => {
    expect(isEmbeddedField(fieldWithType(['String']))).toBe(false);
  });

  it('returns false when the columnType is null', () => {
    expect(isEmbeddedField(fieldWithType(null))).toBe(false);
  });

  it('returns false when the columnType is undefined', () => {
    expect(isEmbeddedField(fieldWithType(undefined))).toBe(false);
  });
});
