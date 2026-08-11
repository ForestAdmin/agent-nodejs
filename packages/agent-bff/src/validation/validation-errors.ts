import { BffHttpError } from '../http/bff-http-error';

export function unknownField(field: string): BffHttpError {
  return new BffHttpError(422, 'unknown_field', `Unknown field: ${field}`, {
    details: { field },
  });
}

export function fieldNotFilterable(field: string): BffHttpError {
  return new BffHttpError(422, 'field_not_filterable', `Field is not filterable: ${field}`, {
    details: { field },
  });
}

export function filterTooDeep(maxDepth: number): BffHttpError {
  return new BffHttpError(
    400,
    'filter_too_deep',
    `Filter nesting exceeds the maximum depth of ${maxDepth}`,
    { details: { maxDepth } },
  );
}

export function invalidFilterOperator(field: string, validOperators: string[]): BffHttpError {
  return new BffHttpError(
    400,
    'invalid_filter_operator',
    `Unsupported operator for field: ${field}`,
    { details: { field, validOperators } },
  );
}
