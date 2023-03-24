import FrontendValidationUtils from '../../../src/utils/forest-schema/validation';
import * as factories from '../../__factories__';

describe('FrontendValidationUtils', () => {
  test('shoud work with null validation', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: testing wrong type
      factories.columnSchema.build({ validation: null }),
    );

    expect(validationList).toHaveLength(0);
  });

  test('shoud work with empty validation', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({ validation: [] }),
    );

    expect(validationList).toHaveLength(0);
  });

  test('should work with bounds', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'Number',
        validation: [
          { operator: 'LessThan', value: 34 },
          { operator: 'GreaterThan', value: 60 },
        ],
      }),
    );

    expect(validationList).toStrictEqual([
      {
        message: 'Value must be lower than 34',
        type: 'is less than',
        value: 34,
      },
      {
        message: 'Value must be greater than 60',
        type: 'is greater than',
        value: 60,
      },
    ]);
  });

  test('should skip validation which cannot be translated', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'Date',
        validation: [{ operator: 'PreviousQuarter' }],
      }),
    );

    expect(validationList).toHaveLength(0);
  });
});
