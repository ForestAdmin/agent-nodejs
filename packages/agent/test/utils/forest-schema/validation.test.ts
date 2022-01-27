import { Operator } from '@forestadmin/datasource-toolkit';
import { ValidationType } from '../../../dist/utils/forest-schema/types';
import FrontendValidationUtils from '../../../dist/utils/forest-schema/validation';

describe('FrontendValidationUtils', () => {
  test('shoud work with null validation', () => {
    const validationList = FrontendValidationUtils.convertValidationList(null);

    expect(validationList).toHaveLength(0);
  });

  test('shoud work with empty validation', () => {
    const validationList = FrontendValidationUtils.convertValidationList([]);

    expect(validationList).toHaveLength(0);
  });

  test('should work with bounds', () => {
    const validationList = FrontendValidationUtils.convertValidationList([
      { operator: Operator.LessThan, value: 34 },
      { operator: Operator.GreaterThan, value: 60 },
    ]);

    expect(validationList).toStrictEqual([
      { message: null, type: ValidationType.LessThan, value: 34 },
      { message: null, type: ValidationType.GreaterThan, value: 60 },
    ]);
  });

  test('should skip validation which cannot be translated', () => {
    const validationList = FrontendValidationUtils.convertValidationList([
      { operator: Operator.PreviousQuarter },
    ]);

    expect(validationList).toHaveLength(0);
  });
});
