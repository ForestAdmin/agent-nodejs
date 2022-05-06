import { ColumnType, Operator } from '@forestadmin/datasource-toolkit';

export default class FilterOperatorBuilder {
  static readonly defaultOperators: Partial<Operator[]> = ['Blank', 'Equal', 'NotEqual', 'Present'];
  static readonly inOperators: Partial<Operator[]> = ['In', 'NotIn'];
  static readonly stringOperators: Partial<Operator[]> = [
    'Like',
    'Contains',
    'NotContains',
    'StartsWith',
    'EndsWith',
    'LongerThan',
    'ShorterThan',
  ];

  static readonly comparisonOperators: Partial<Operator[]> = ['GreaterThan', 'LessThan'];

  static getSupportedOperators(type: ColumnType): Set<Operator> {
    if (!(type instanceof Array) && type instanceof Object) {
      return new Set<Operator>(FilterOperatorBuilder.defaultOperators);
    }

    switch (type) {
      case 'Boolean':
        return new Set<Operator>(FilterOperatorBuilder.defaultOperators);
      case 'Date':
      case 'Dateonly':
        return new Set<Operator>([
          ...FilterOperatorBuilder.defaultOperators,
          ...FilterOperatorBuilder.inOperators,
          ...FilterOperatorBuilder.comparisonOperators,
        ]);
      case 'Enum':
        return new Set<Operator>([
          ...FilterOperatorBuilder.defaultOperators,
          ...FilterOperatorBuilder.inOperators,
        ]);
      case 'Number':
        return new Set<Operator>([
          ...FilterOperatorBuilder.defaultOperators,
          ...FilterOperatorBuilder.inOperators,
          ...FilterOperatorBuilder.comparisonOperators,
        ]);
      case 'String':
        return new Set<Operator>([
          ...FilterOperatorBuilder.defaultOperators,
          ...FilterOperatorBuilder.inOperators,
          ...FilterOperatorBuilder.stringOperators,
        ]);
      case 'Uuid':
        return new Set<Operator>([
          ...FilterOperatorBuilder.defaultOperators,
          ...FilterOperatorBuilder.stringOperators,
        ]);
      case 'Json':
        return new Set<Operator>(FilterOperatorBuilder.defaultOperators);
      default:
        return new Set<Operator>();
    }
  }
}
