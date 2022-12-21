import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('on field of type boolean', () => {
  test('valid value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'boolean',
        factories.columnSchema.build({
          columnType: 'Boolean',
        }),
        true,
      ),
    ).not.toThrow();
  });

  test('invalid value type should throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'boolean',
        factories.columnSchema.build({
          columnType: 'Boolean',
        }),
        'not a boolean',
      ),
    ).toThrow('Wrong type for "boolean": not a boolean. Expects Boolean');
  });
});
