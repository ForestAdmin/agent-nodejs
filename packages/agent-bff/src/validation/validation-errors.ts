import { BffHttpError } from '../http/bff-http-error';

export function unknownField(field: string): BffHttpError {
  return new BffHttpError(422, 'unknown_field', `Unknown field: ${field}`, { field });
}

export function fieldNotFilterable(field: string): BffHttpError {
  return new BffHttpError(422, 'field_not_filterable', `Field is not filterable: ${field}`, {
    field,
  });
}

export function invalidFilterOperator(field: string, validOperators: string[]): BffHttpError {
  return new BffHttpError(
    400,
    'invalid_filter_operator',
    `Unsupported operator for field: ${field}`,
    { field, validOperators },
  );
}
