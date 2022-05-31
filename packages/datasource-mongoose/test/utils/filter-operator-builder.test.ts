import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import FilterOperatorBuilder from '../../src/utils/filter-operator-builder';

describe('FilterOperatorBuilder > getSupportedOperators', () => {
  const cases: Array<[PrimitiveTypes, Partial<Operator[]>]> = [
    ['Boolean', ['Equal', 'NotEqual', 'Present']],
    ['Date', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    ['Dateonly', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    ['Enum', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn']],
    ['Number', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    [
      'String',
      [
        'Equal',
        'NotEqual',
        'Present',
        'In',
        'NotIn',
        'Like',
        'NotContains',
        'LongerThan',
        'ShorterThan',
      ],
    ],
    ['Uuid', ['Equal', 'NotEqual', 'Present', 'Like', 'NotContains', 'LongerThan', 'ShorterThan']],
    ['Json', ['Equal', 'NotEqual', 'Present']],
    ['Point', []],
    ['Timeonly', []],
  ];
  test.each(cases)('[%p] returns the supported operators', (type, expectedTypes) => {
    expect(Array.from(FilterOperatorBuilder.getSupportedOperators(type))).toStrictEqual(
      expectedTypes,
    );
  });

  test('should test all the primitive types', () => {
    const numberOfPrimitiveTypes = 10;
    expect(cases.length).toStrictEqual(numberOfPrimitiveTypes);
  });
});
