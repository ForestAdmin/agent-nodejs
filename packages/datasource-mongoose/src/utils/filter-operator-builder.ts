import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

const defaultOperators: Partial<Operator[]> = ['Blank', 'Equal', 'NotEqual', 'Present'];
const inOperators: Partial<Operator[]> = ['In', 'NotIn'];
const stringOperators: Partial<Operator[]> = ['Contains', 'NotContains', 'StartsWith', 'EndsWith'];
const comparisonOperators: Partial<Operator[]> = ['GreaterThan', 'LessThan'];

export default class FilterOperatorBuilder {
  static getSupportedOperators(type: PrimitiveTypes): Set<Operator> {
    switch (type) {
      case 'Boolean':
        return new Set<Operator>(defaultOperators);
      case 'Date':
        return new Set<Operator>([...defaultOperators, ...inOperators, ...comparisonOperators]);
      case 'Enum':
        return new Set<Operator>([...defaultOperators, ...inOperators, ...stringOperators]);
      case 'Json':
        return new Set<Operator>();
      case 'Number':
        return new Set<Operator>([...defaultOperators, ...inOperators, ...comparisonOperators]);
      case 'String':
        return new Set<Operator>([...defaultOperators, ...inOperators, ...stringOperators]);
      default:
        return new Set<Operator>();
    }
  }
}
