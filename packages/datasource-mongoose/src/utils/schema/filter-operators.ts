import { ColumnType, Operator } from '@forestadmin/datasource-toolkit';

export default class FilterOperatorsGenerator {
  static readonly defaultOperators: Partial<Operator[]> = ['Equal', 'NotEqual', 'Present'];
  static readonly inOperators: Partial<Operator[]> = ['In', 'NotIn'];
  static readonly stringOperators: Partial<Operator[]> = ['Match', 'NotContains'];
  static readonly comparisonOperators: Partial<Operator[]> = ['GreaterThan', 'LessThan'];

  static getSupportedOperators(type: ColumnType): Set<Operator> {
    if (!(type instanceof Array) && type instanceof Object) {
      return new Set<Operator>(FilterOperatorsGenerator.defaultOperators);
    }

    switch (type) {
      case 'Boolean':
        return new Set<Operator>(FilterOperatorsGenerator.defaultOperators);
      case 'Date':
      case 'Dateonly':
        return new Set<Operator>([
          ...FilterOperatorsGenerator.defaultOperators,
          ...FilterOperatorsGenerator.inOperators,
          ...FilterOperatorsGenerator.comparisonOperators,
        ]);
      case 'Enum':
        return new Set<Operator>([
          ...FilterOperatorsGenerator.defaultOperators,
          ...FilterOperatorsGenerator.inOperators,
        ]);
      case 'Number':
        return new Set<Operator>([
          ...FilterOperatorsGenerator.defaultOperators,
          ...FilterOperatorsGenerator.inOperators,
          ...FilterOperatorsGenerator.comparisonOperators,
        ]);
      case 'String':
        return new Set<Operator>([
          ...FilterOperatorsGenerator.defaultOperators,
          ...FilterOperatorsGenerator.inOperators,
          ...FilterOperatorsGenerator.stringOperators,
        ]);
      case 'Uuid':
        return new Set<Operator>([
          ...FilterOperatorsGenerator.defaultOperators,
          ...FilterOperatorsGenerator.stringOperators,
        ]);
      case 'Json':
        return new Set<Operator>(FilterOperatorsGenerator.defaultOperators);
      default:
        return new Set<Operator>();
    }
  }
}
