import { ValidationType } from '../../../src/utils/forest-schema/types';
import FrontendValidationUtils from '../../../src/utils/forest-schema/validation';

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
      { operator: 'LessThan', value: 34 },
      { operator: 'GreaterThan', value: 60 },
    ]);

    expect(validationList).toStrictEqual([
      {
        message: "Failed validation rule: 'LessThan(34)'",
        type: ValidationType.LessThan,
        value: 34,
      },
      {
        message: "Failed validation rule: 'GreaterThan(60)'",
        type: ValidationType.GreaterThan,
        value: 60,
      },
    ]);
  });

  test('should skip validation which cannot be translated', () => {
    const validationList = FrontendValidationUtils.convertValidationList([
      { operator: 'PreviousQuarter' },
    ]);

    expect(validationList).toHaveLength(0);
  });
});
