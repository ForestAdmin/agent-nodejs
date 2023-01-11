import FieldValidator from '../../../src/validation/field';
import * as factories from '../../__factories__';

describe('on field of type uuid', () => {
  test('valid value (uuid v1) type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'uuid',
        factories.columnSchema.build({
          columnType: 'Uuid',
        }),
        'a7147d1c-7d44-11ec-90d6-0242ac120003',
      ),
    ).not.toThrow();
  });

  test('valid value (uuid v4) type should not throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'uuid',
        factories.columnSchema.build({
          columnType: 'Uuid',
        }),
        '05db90e8-6e72-4278-888d-9b127c91470e',
      ),
    ).not.toThrow();
  });

  test('invalid value type should throw error', () => {
    expect(() =>
      FieldValidator.validateValue(
        'uuid',
        factories.columnSchema.build({
          columnType: 'Uuid',
        }),
        'not-a-valid-uuid',
      ),
    ).toThrow();
  });

  describe('when it is an id', () => {
    test('given null value should throw an error', () => {
      expect(() =>
        FieldValidator.validateValueForId(
          'uuid',
          factories.columnSchema.build({
            columnType: 'Uuid',
          }),
          null,
        ),
      ).toThrow();
    });

    test('given non null value should not throw an error', () => {
      expect(() =>
        FieldValidator.validateValueForId(
          'uuid',
          factories.columnSchema.build({
            columnType: 'Uuid',
          }),
          '05db90e8-6e72-4278-888d-9b127c91470e',
        ),
      ).not.toThrow();
    });
  });
});
