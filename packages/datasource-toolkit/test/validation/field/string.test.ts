import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('on field of type string', () => {
  test('valid value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'string',
        factories.columnSchema.build({
          columnType: 'String',
        }),
        'test',
      ),
    ).not.toThrow();
  });

  test('invalid value type should throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'string',
        factories.columnSchema.build({
          columnType: 'String',
        }),
        1,
      ),
    ).toThrow();
  });
});
