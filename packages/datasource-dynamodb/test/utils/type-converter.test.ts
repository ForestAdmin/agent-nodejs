import TypeConverter from '../../src/utils/type-converter';

describe('TypeConverter', () => {
  describe('inferTypeFromValue', () => {
    it.each([
      [true, 'boolean'],
      [12, 'number'],
      ['hello', 'string'],
      [null, 'null'],
      [undefined, 'null'],
      [['a'], 'array'],
      [new Set(['a']), 'array'],
      [{ a: 1 }, 'object'],
      [new Date(), 'date'],
      ['2024-01-15T10:30:00Z', 'date'],
      ['2024-01-15', 'dateonly'],
      ['10:30:00', 'timeonly'],
      [{ type: 'Point', coordinates: [2.35, 48.85] }, 'point'],
      [new Uint8Array([1, 2]), 'binary'],
    ])('infers %p as %s', (value, expected) => {
      expect(TypeConverter.inferTypeFromValue(value)).toBe(expected);
    });
  });

  describe('getMostSpecificType', () => {
    it('keeps the type shared by every sample', () => {
      expect(TypeConverter.getMostSpecificType(['number', 'number'])).toBe('number');
    });

    it('ignores null samples when the others agree', () => {
      expect(TypeConverter.getMostSpecificType(['string', 'null'])).toBe('string');
    });

    it('prefers date over dateonly when both are seen', () => {
      expect(TypeConverter.getMostSpecificType(['date', 'dateonly'])).toBe('date');
    });

    it('falls back to object (Json) for incompatible types', () => {
      expect(TypeConverter.getMostSpecificType(['number', 'string'])).toBe('object');
    });

    it('returns null for no sample', () => {
      expect(TypeConverter.getMostSpecificType([])).toBe('null');
    });
  });

  describe('getColumnTypeFromDataType', () => {
    it.each([
      ['string', 'String'],
      ['number', 'Number'],
      ['boolean', 'Boolean'],
      ['date', 'Date'],
      ['dateonly', 'Dateonly'],
      ['timeonly', 'Timeonly'],
      ['point', 'Point'],
      ['binary', 'String'],
      ['object', 'Json'],
      ['array', 'Json'],
      ['null', 'Json'],
    ])('maps %s to %s', (dataType, columnType) => {
      expect(TypeConverter.getColumnTypeFromDataType(dataType as never)).toBe(columnType);
    });

    it('throws on an unknown data type', () => {
      expect(() => TypeConverter.getColumnTypeFromDataType('weird' as never)).toThrow(
        'Unsupported data type: "weird"',
      );
    });
  });

  describe('operatorsForColumnType', () => {
    it('gives strings the full text operators', () => {
      const operators = TypeConverter.operatorsForColumnType('String');

      expect([...operators]).toEqual(
        expect.arrayContaining([
          'Equal',
          'In',
          'Like',
          'ILike',
          'Contains',
          'IContains',
          'StartsWith',
          'EndsWith',
        ]),
      );
    });

    it('does not give booleans range operators', () => {
      expect(TypeConverter.operatorsForColumnType('Boolean').has('GreaterThan')).toBe(false);
    });

    it('gives numbers range operators', () => {
      expect(TypeConverter.operatorsForColumnType('Number').has('GreaterThanOrEqual')).toBe(true);
    });
  });

  describe('isSortable', () => {
    it('does not sort Json-like types', () => {
      expect(TypeConverter.isSortable('object')).toBe(false);
      expect(TypeConverter.isSortable('array')).toBe(false);
      expect(TypeConverter.isSortable('point')).toBe(false);
    });

    it('sorts scalar types', () => {
      expect(TypeConverter.isSortable('string')).toBe(true);
      expect(TypeConverter.isSortable('number')).toBe(true);
      expect(TypeConverter.isSortable('date')).toBe(true);
    });
  });
});
