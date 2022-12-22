import { FieldValidator } from '../../../src';
import * as factories from '../../__factories__';

describe('on field of type date|dateonly|timeonly', () => {
  test('valid value (string) type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'date',
        factories.columnSchema.build({
          columnType: 'Date',
        }),
        '2022-01-13T17:16:04.000Z',
      ),
    ).not.toThrow();
  });

  test('valid value (js date) type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'date',
        factories.columnSchema.build({
          columnType: 'Date',
        }),
        new Date('2022-01-13T17:16:04.000Z'),
      ),
    ).not.toThrow();
  });

  test('invalid value type should throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'date',
        factories.columnSchema.build({
          columnType: 'Date',
        }),
        'definitely-not-a-date',
      ),
    ).toThrow('Wrong type for "date": definitely-not-a-date. Expects Date');
  });
});
