import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('on field of type json', () => {
  test('valid (string) value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValueForField(
        'json',
        factories.columnSchema.build({
          columnType: 'Json',
        }),
        '{"foo": "bar"}',
      ),
    ).not.toThrow();
  });

  test('valid (json) value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValueForField(
        'json',
        factories.columnSchema.build({
          columnType: 'Json',
        }),
        { foo: 'bar' },
      ),
    ).not.toThrow();
  });

  test('valid (json array) value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValueForField(
        'json',
        factories.columnSchema.build({
          columnType: 'Json',
        }),
        ['email'],
      ),
    ).not.toThrow();
  });

  test('a failed declaration of an plain object should also be a valid a json', () => {
    expect(() =>
      FieldValidator.validateValueForField(
        'json',
        factories.columnSchema.build({
          columnType: 'Json',
        }),
        '{not:"a:" valid plain object but it is a valid json',
      ),
    ).not.toThrow();
  });
});
