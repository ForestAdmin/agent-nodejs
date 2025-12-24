import type { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import FilterOperatorsGenerator from '../../../src/utils/schema/filter-operators';

const supportedOperators: Operator[] = [
  'Equal',
  'NotEqual',
  'Present',
  'In',
  'NotIn',
  'GreaterThan',
  'LessThan',
  'GreaterThanOrEqual',
  'LessThanOrEqual',
];

describe('FilterOperatorBuilder > getSupportedOperators', () => {
  const cases: Array<[PrimitiveTypes, Partial<Operator[]>]> = [
    ['Boolean', ['Equal', 'NotEqual', 'Present']],
    ['Date', supportedOperators],
    ['Dateonly', supportedOperators],
    ['Enum', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn']],
    ['Number', supportedOperators],
    [
      'String',
      ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'Match', 'NotContains', 'NotIContains'],
    ],
    ['Uuid', ['Equal', 'NotEqual', 'Present', 'Match', 'NotContains', 'NotIContains']],
    ['Json', ['Equal', 'NotEqual', 'Present']],
    ['Point', []],
    ['Time', []],
  ];

  test.each(cases)('[%p] returns the supported operators', (type, expectedTypes) => {
    expect(Array.from(FilterOperatorsGenerator.getSupportedOperators(type))).toStrictEqual(
      expectedTypes,
    );
  });

  test('should test all the primitive types', () => {
    const numberOfPrimitiveTypes = 10;
    expect(cases.length).toStrictEqual(numberOfPrimitiveTypes);
  });
});
