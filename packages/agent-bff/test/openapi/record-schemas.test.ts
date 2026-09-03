import type { UnfoldedCollection } from '../../src/openapi/unfolding';

import recordSchema, { recordKey } from '../../src/openapi/record-schemas';

const PEOPLE: UnfoldedCollection = {
  name: 'people',
  fields: {
    projectable: [{ name: 'profile_file', type: 'File' }],
    filterable: [],
    degraded: null,
  },
  primaryKeys: [{ name: 'id', type: 'Number' }],
  relations: [],
  actions: [],
};

describe('recordSchema', () => {
  it('should keep the File data-URI contract when the wire key differs from the schema name', () => {
    const schema = recordSchema(PEOPLE, {
      $ref: '#/components/schemas/ForestRecordMeta',
    }) as { properties: Record<string, unknown> };

    expect(schema.properties.profileFile).toEqual({
      type: ['string', 'null'],
      description: 'A data URI. The "profile_file" field.',
    });
  });

  it('should publish every field as nullable, since capabilities never report nullability', () => {
    const schema = recordSchema(
      {
        ...PEOPLE,
        fields: {
          ...PEOPLE.fields,
          projectable: [
            { name: 'first_name', type: 'String' },
            { name: 'age', type: 'Number' },
            { name: 'payload', type: 'Json' },
          ],
        },
      },
      { $ref: '#/components/schemas/ForestRecordMeta' },
    ) as { properties: Record<string, { type?: unknown }> };

    expect(schema.properties.firstName.type).toEqual(['string', 'null']);
    expect(schema.properties.age.type).toEqual(['number', 'null']);
    expect(schema.properties.payload.type).toBeUndefined();
  });

  it('should publish array items and nested properties as nullable too, not just the container', () => {
    const schema = recordSchema(
      {
        ...PEOPLE,
        fields: {
          ...PEOPLE.fields,
          projectable: [
            { name: 'tags', type: ['String'] },
            {
              name: 'address',
              type: { fields: [{ field: 'city', type: 'String' }] },
            },
          ],
        },
      },
      { $ref: '#/components/schemas/ForestRecordMeta' },
    ) as { properties: Record<string, unknown> };

    expect(schema.properties.tags).toEqual({
      type: ['array', 'null'],
      items: { type: ['string', 'null'] },
    });
    expect(schema.properties.address).toEqual({
      type: ['object', 'null'],
      properties: { city: { type: ['string', 'null'] } },
    });
  });

  it('should camelize a nested member name, which the deserializer rewrites too', () => {
    const schema = recordSchema(
      {
        ...PEOPLE,
        fields: {
          ...PEOPLE.fields,
          projectable: [
            {
              name: 'address',
              type: { fields: [{ field: 'postal_code', type: 'String' }] },
            },
            {
              name: 'places',
              type: [{ fields: [{ field: 'street_name', type: 'String' }] }],
            },
          ],
        },
      },
      { $ref: '#/components/schemas/ForestRecordMeta' },
    ) as { properties: Record<string, { properties?: object; items?: { properties?: object } }> };

    expect(schema.properties.address.properties).toEqual({
      postalCode: { type: ['string', 'null'] },
    });
    expect(schema.properties.places.items?.properties).toEqual({
      streetName: { type: ['string', 'null'] },
    });
  });
});

describe('recordKey', () => {
  it('should leave an already-clean name untouched', () => {
    expect(recordKey('email')).toBe('email');
  });

  it('should camelCase a snake_case name, since that is how the response carries it', () => {
    expect(recordKey('created_at')).toBe('createdAt');
  });

  it('should collapse every casing and separator variant onto one key, like the deserializer', () => {
    ['first_name', 'firstName', 'FirstName', 'first-name', 'FIRST_NAME'].forEach(name => {
      expect(recordKey(name)).toBe('firstName');
    });
  });

  it('should camelize non-ASCII names too, which a hand-rolled mirror would likely miss', () => {
    expect(recordKey('état_civil')).toBe('étatCivil');
  });
});
