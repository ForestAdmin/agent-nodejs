import getSchema from '../../src/schema';

describe('getSchema', () => {
  it('should always return an id field', () => {
    const fieldPropertiesByCollection = {
      companies: [{ name: 'about_us', type: 'string' }],
    };

    const [collectionSchema] = getSchema(fieldPropertiesByCollection, { companies: ['about_us'] });
    expect(collectionSchema.fields.id).toEqual({
      isPrimaryKey: true,
      type: 'String',
      isReadOnly: true,
    });
  });

  describe('different field types', () => {
    describe('specific cases', () => {
      describe('when the field type is not supported', () => {
        it('should throw an error', () => {
          const fieldPropertiesByCollection = {
            companies: [{ name: 'unsupported', type: 'unsupported' }],
          };
          expect(() =>
            getSchema(fieldPropertiesByCollection, { companies: ['unsupported'] }),
          ).toThrow('Property "unsupported" has unsupported type unsupported');
        });
      });

      describe('when the field is an enum and options is empty', () => {
        it('should not import the field', () => {
          const fieldPropertiesByCollection = {
            companies: [{ name: 'emptyEnumOptions', type: 'enumeration', options: [] }],
          };
          const [collectionSchema] = getSchema(fieldPropertiesByCollection, {
            companies: ['emptyEnumOptions'],
          });
          expect(collectionSchema.fields.emptyEnumOptions).toBeUndefined();
        });
      });
    });

    test.each([
      [{ type: 'String' }, { type: 'string' }],
      [{ type: 'Date' }, { type: 'datetime' }],
      [{ type: 'Number' }, { type: 'number' }],
      [
        { type: 'Enum', enumValues: ['ORGANIC_SEARCH', 'PAID_SEARCH'] },
        {
          type: 'enumeration',
          options: [{ value: 'ORGANIC_SEARCH' }, { value: 'PAID_SEARCH' }],
        },
      ],
      [{ type: 'Boolean' }, { type: 'bool' }],
      [{ type: 'String' }, { type: 'phone_number' }],
    ])('should return the expected attributes for %s type', (expectedAttributes, property) => {
      const [collectionSchema] = getSchema(
        { companies: [{ name: 'name', ...property }] },
        { companies: ['name'] },
      );
      expect(collectionSchema.fields.name).toEqual({
        isPrimaryKey: false,
        isReadOnly: true,
        ...expectedAttributes,
      });
    });
  });
});
