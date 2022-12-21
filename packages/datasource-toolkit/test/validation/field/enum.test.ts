import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('on field of type enum', () => {
  test('valid value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'enum',
        factories.columnSchema.build({
          columnType: 'Enum',
          enumValues: ['a', 'b', 'c'],
        }),
        'a',
      ),
    ).not.toThrow();
  });

  test('invalid value type should throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'enum',
        factories.columnSchema.build({
          columnType: 'Enum',
          enumValues: ['a', 'b', 'c'],
        }),
        'd',
      ),
    ).toThrow('The given enum value(s) [d] is not listed in [a,b,c]');
  });
});
