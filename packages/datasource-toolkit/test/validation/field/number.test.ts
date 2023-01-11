import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('on field of type number', () => {
  test('valid value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValueForField(
        'number',
        factories.columnSchema.build({
          columnType: 'Number',
        }),
        1,
      ),
    ).not.toThrow();
  });

  test('invalid value type should throw error', () => {
    expect(() =>
      FieldValidator.validateValueForField(
        'number',
        factories.columnSchema.build({
          columnType: 'Number',
        }),
        '1',
      ),
    ).toThrow('Wrong type for "number": 1. Expects Number');
  });
});
