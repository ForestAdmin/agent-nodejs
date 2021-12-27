import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

const defaultOperators = [Operator.Blank, Operator.Equal, Operator.NotEqual, Operator.Present];
const inOperators = [Operator.In, Operator.NotIn];
const stringOperators = [
  Operator.Contains,
  Operator.NotContains,
  Operator.StartsWith,
  Operator.EndsWith,
];
const comparisonOperators = [Operator.GreaterThan, Operator.LessThan];

export default class FilterOperatorBuilder {
  static getSupportedOperators(type: PrimitiveTypes): Set<Operator> {
    switch (type) {
      case PrimitiveTypes.Boolean:
        return new Set<Operator>(defaultOperators);
      case PrimitiveTypes.Date:
        return new Set<Operator>([...defaultOperators, ...inOperators, ...comparisonOperators]);
      case PrimitiveTypes.Enum:
        return new Set<Operator>([...defaultOperators, ...inOperators, ...stringOperators]);
      case PrimitiveTypes.Json:
        return new Set<Operator>();
      case PrimitiveTypes.Number:
        return new Set<Operator>([...defaultOperators, ...inOperators, ...comparisonOperators]);
      case PrimitiveTypes.String:
        return new Set<Operator>([...defaultOperators, ...inOperators, ...stringOperators]);
      default:
        return new Set<Operator>();
    }
  }
}
