import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('on field of type point', () => {
  test('valid value type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'point',
        factories.columnSchema.build({
          columnType: 'Point',
        }),
        '1,2',
      ),
    ).not.toThrow();
  });

  test('invalid value type should throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'point',
        factories.columnSchema.build({
          columnType: 'Point',
        }),
        'd,a',
      ),
    ).toThrow('Wrong type for "point": d,a. Expects Point');
  });
});
