import { CollectionSchemaSchema, FieldSchemaSchema } from '../../src/types/validated/collection';

describe('FieldSchemaSchema type tolerance', () => {
  const base = {
    fieldName: 'col',
    displayName: 'Col',
    isRelationship: false,
  };

  it('parses a primitive type', () => {
    expect(FieldSchemaSchema.parse({ ...base, type: 'String' }).type).toBe('String');
  });

  it('normalizes a non-primitive smart-field type string to null', () => {
    expect(FieldSchemaSchema.parse({ ...base, type: 'DateTime' }).type).toBeNull();
  });

  it('normalizes a [null] array-column type to null', () => {
    expect(FieldSchemaSchema.parse({ ...base, type: [null] }).type).toBeNull();
  });

  it('keeps an explicit null type as null', () => {
    expect(FieldSchemaSchema.parse({ ...base, type: null }).type).toBeNull();
  });

  it('keeps a missing type as undefined', () => {
    expect(FieldSchemaSchema.parse(base).type).toBeUndefined();
  });
});

describe('CollectionSchemaSchema field type tolerance', () => {
  const collection = {
    collectionName: 'orders',
    collectionId: 'orders',
    collectionDisplayName: 'Orders',
    primaryKeyFields: ['id'],
    fields: [
      { fieldName: 'id', displayName: 'Id', isRelationship: false, type: 'Number' },
      { fieldName: 'computed', displayName: 'Computed', isRelationship: false, type: 'DateTime' },
      { fieldName: 'tags', displayName: 'Tags', isRelationship: false, type: [null] },
    ],
  };

  it('parses the collection instead of rejecting it, dropping unparseable types to null', () => {
    const parsed = CollectionSchemaSchema.parse(collection);

    expect(parsed.fields.map(f => f.type)).toEqual(['Number', null, null]);
  });
});
