import ColumnSchemaValidator from '../../../src/utils/forest-schema/column-schema-validator';
import * as factories from '../../__factories__';

describe('ColumnSchemaValidator', () => {
  describe('enumValues', () => {
    describe('when enumValues is empty', () => {
      it('should not throw', () => {
        const column = factories.columnSchema.build({
          columnType: 'Enum',
          enumValues: [],
        });
        expect(() => ColumnSchemaValidator.validate(column, 'isbn')).not.toThrow();
      });
    });

    describe('when enumValues is not an array', () => {
      it('should throw', () => {
        const column = factories.columnSchema.build({
          columnType: 'Enum',
          enumValues: 'not an array' as unknown as string[],
        });
        expect(() => ColumnSchemaValidator.validate(column, 'isbn')).toThrow(
          'The enumValues of column \'isbn\' must be an array of string instead of "not an array"',
        );
      });
    });

    describe('when enumValues is not an array of strings', () => {
      it('should throw', () => {
        const column = factories.columnSchema.build({
          columnType: 'Enum',
          enumValues: [1, 2, 3] as unknown as string[],
        });
        expect(() => ColumnSchemaValidator.validate(column, 'isbn')).toThrow(
          "The enumValues of column 'isbn' must be an array of string instead of [1,2,3]",
        );
      });
    });

    describe('when enumValues is an array of strings', () => {
      it('should not throw', () => {
        const column = factories.columnSchema.build({
          columnType: 'Enum',
          enumValues: ['a', 'b', 'c'],
        });
        expect(() => ColumnSchemaValidator.validate(column, 'isbn')).not.toThrow();
      });
    });
  });
});
