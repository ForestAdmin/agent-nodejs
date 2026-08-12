import toFieldSchema from '../../src/openapi/field-schemas';

describe('toFieldSchema', () => {
  it.each([
    ['String', { type: 'string' }],
    ['Boolean', { type: 'boolean' }],
    ['Number', { type: 'number' }],
    ['Date', { type: 'string', format: 'date-time' }],
    ['Dateonly', { type: 'string', format: 'date' }],
    ['Uuid', { type: 'string', format: 'uuid' }],
    ['Enum', { type: 'string' }],
  ])('should map the %s column type', (type, expected) => {
    expect(toFieldSchema(type)).toEqual(expected);
  });

  it('should leave a Json column unconstrained, since any JSON value is accepted there', () => {
    expect(toFieldSchema('Json')).toEqual({});
  });

  it('should describe a File as a data URI, which is how an action receives one', () => {
    expect(toFieldSchema('File')).toEqual({ type: 'string', description: 'A data URI.' });
  });

  it('should wrap an array type around its item type', () => {
    expect(toFieldSchema(['Number'])).toEqual({ type: 'array', items: { type: 'number' } });
  });

  it('should map a composite type to an object, one property per nested field', () => {
    expect(
      toFieldSchema({
        fields: [
          { field: 'street', type: 'String' },
          { field: 'zip', type: 'Number' },
        ],
      }),
    ).toEqual({
      type: 'object',
      properties: { street: { type: 'string' }, zip: { type: 'number' } },
    });
  });

  it('should nest a composite inside an array, which a nested list column produces', () => {
    expect(toFieldSchema([{ fields: [{ field: 'street', type: 'String' }] }])).toEqual({
      type: 'array',
      items: { type: 'object', properties: { street: { type: 'string' } } },
    });
  });

  it('should not constrain an empty array type, which carries no item to describe', () => {
    expect(toFieldSchema([])).toEqual({ type: 'array', items: {} });
  });

  it.each([
    ['a relation marker', 'ManyToOne'],
    ['a type a newer agent introduced', 'Vector'],
  ])('should leave %s unconstrained rather than guess', (_, type) => {
    expect(toFieldSchema(type)).toEqual({});
  });

  it.each([
    ['a malformed composite', { fields: 'not-an-array' }],
    ['a value that is not a type at all', 42],
    ['null', null],
  ])('should leave %s unconstrained, since the schema is cast from untyped data', (_, type) => {
    expect(toFieldSchema(type as never)).toEqual({});
  });

  it.each([
    ['a null entry', null],
    ['an entry with no name', {}],
    ['an entry whose name is not a string', { field: 42, type: 'String' }],
  ])('should drop %s from a composite rather than abort the document', (_, field) => {
    expect(
      toFieldSchema({ fields: [field, { field: 'street', type: 'String' }] } as never),
    ).toEqual({
      type: 'object',
      properties: { street: { type: 'string' } },
    });
  });
});
