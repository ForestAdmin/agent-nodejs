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

  test('should work with supported handlers (numbers)', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'Number',
        validation: [
          { operator: 'Present' },
          { operator: 'LessThan', value: 34 },
          { operator: 'GreaterThan', value: 60 },
        ],
      }),
    );

    expect(validationList).toStrictEqual([
      {
        message: 'Field is required',
        type: 'is present',
      },
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

  test('should work with supported handlers (date)', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'Date',
        validation: [
          { operator: 'Before', value: '2010-01-01T00:00:00Z' },
          { operator: 'After', value: '2010-01-01T00:00:00Z' },
        ],
      }),
    );

    expect(validationList).toStrictEqual([
      {
        message: 'Value must be before 2010-01-01T00:00:00Z',
        type: 'is before',
        value: '2010-01-01T00:00:00Z',
      },
      {
        message: 'Value must be after 2010-01-01T00:00:00Z',
        type: 'is after',
        value: '2010-01-01T00:00:00Z',
      },
    ]);
  });

  test('should work with supported handlers (string)', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'Number',
        validation: [
          { operator: 'LongerThan', value: 34 },
          { operator: 'ShorterThan', value: 60 },
          { operator: 'Contains', value: 'abc' },
          { operator: 'Match', value: /abc/ },
        ],
      }),
    );

    expect(validationList).toStrictEqual([
      {
        message: 'Value must be longer than 34 characters',
        type: 'is longer than',
        value: 34,
      },
      {
        message: 'Value must be shorter than 60 characters',
        type: 'is shorter than',
        value: 60,
      },
      {
        message: "Value must contain 'abc'",
        type: 'contains',
        value: 'abc',
      },
      {
        message: 'Value must match /abc/',
        type: 'is like',
        value: '/abc/',
      },
    ]);
  });

  test('should perform replacements (fake enum)', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'String',
        validation: [{ operator: 'In', value: ['a', 'b', 'c'] }],
      }),
    );

    expect(validationList).toStrictEqual([
      {
        message: 'Value must match /^a|b|c$/g',
        type: 'is like',
        value: '/^a|b|c$/g',
      },
    ]);
  });

  test('should handle duplication', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'Number',
        validation: [
          { operator: 'Present' },
          { operator: 'Present' },
          { operator: 'LessThan', value: 34 },
          { operator: 'LessThan', value: 40 },
          { operator: 'GreaterThan', value: 60 },
          { operator: 'GreaterThan', value: 80 },
          { operator: 'Match', value: /a/ },
          { operator: 'Match', value: /b/ },
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
        message: 'Value must be greater than 80',
        type: 'is greater than',
        value: 80,
      },
      {
        message: 'Value must match /^(?=a)(?=b).*$/',
        type: 'is like',
        value: '/^(?=a)(?=b).*$/',
      },
    ]);
  });

  test('should handle rule expansion (not in with null)', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'String',
        validation: [{ operator: 'NotIn', value: ['a', 'b', null] }],
      }),
    );

    expect(validationList).toStrictEqual([
      {
        message: 'Value must match /(?!a|b)/g',
        type: 'is like',
        value: '/(?!a|b)/g',
      },
    ]);
  });

  test('should skip validation which cannot be translated (depends on current time)', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'Date',
        validation: [{ operator: 'PreviousQuarter' }],
      }),
    );

    expect(validationList).toHaveLength(0);
  });

  test('should skip validation which cannot be translated (fake enum with null)', () => {
    const validationList = FrontendValidationUtils.convertValidationList(
      factories.columnSchema.build({
        columnType: 'String',
        validation: [{ operator: 'In', value: ['a', 'b', null] }],
      }),
    );

    expect(validationList).toStrictEqual([]);
  });
});
