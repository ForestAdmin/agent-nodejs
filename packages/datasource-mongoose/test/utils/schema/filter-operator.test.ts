import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import FilterOperatorsGenerator from '../../../src/utils/schema/filter-operators';

describe('FilterOperatorBuilder > getSupportedOperators', () => {
  const cases: Array<[PrimitiveTypes, Partial<Operator[]>]> = [
    ['Boolean', ['Equal', 'NotEqual', 'Present']],
    ['Date', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    ['Dateonly', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    ['Enum', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn']],
    ['Number', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'GreaterThan', 'LessThan']],
    ['String', ['Equal', 'NotEqual', 'Present', 'In', 'NotIn', 'Like', 'ILike', 'NotContains']],
    ['Uuid', ['Equal', 'NotEqual', 'Present', 'Like', 'ILike', 'NotContains']],
    ['Json', ['Equal', 'NotEqual', 'Present']],
    ['Point', []],
    ['Timeonly', []],
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
