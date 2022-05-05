import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import FilterOperatorBuilder from '../../dist/utils/filter-operator-builder';

describe('FilterOperatorBuilder > getSupportedOperators', () => {
  const cases: Array<[PrimitiveTypes, Partial<Operator[]>]> = [
    ['Boolean', ['Blank', 'Equal', 'NotEqual', 'Present']],
    ['Date', ['Blank', 'Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    [
      'Dateonly',
      ['Blank', 'Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan'],
    ],
    ['Enum', ['Blank', 'Equal', 'NotEqual', 'Present', 'In', 'NotIn']],
    ['Number', ['Blank', 'Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    [
      'String',
      [
        'Blank',
        'Equal',
        'NotEqual',
        'Present',
        'In',
        'NotIn',
        'Like',
        'Contains',
        'NotContains',
        'StartsWith',
        'EndsWith',
        'LongerThan',
        'ShorterThan',
      ],
    ],
    [
      'Uuid',
      [
        'Blank',
        'Equal',
        'NotEqual',
        'Present',
        'Like',
        'Contains',
        'NotContains',
        'StartsWith',
        'EndsWith',
        'LongerThan',
        'ShorterThan',
      ],
    ],
    ['Json', ['Blank', 'Equal', 'NotEqual', 'Present']],
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
