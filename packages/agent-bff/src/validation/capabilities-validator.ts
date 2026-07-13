import type { BffHttpError } from '../http/bff-http-error';
import type { CapabilitiesResult } from '../read-model/capabilities-cache';

import { mappingError } from '../http/bff-local-errors';
import { normalizeOperator } from './operator-normalizer';
import { fieldNotFilterable, invalidFilterOperator, unknownField } from './validation-errors';

export interface ValidateParams {
  filter?: unknown;
  sortFields?: string[];
  projectionFields?: string[];
}

interface FilterLeaf {
  field: string;
  operator?: string;
}

function isBranch(node: unknown): node is { conditions: unknown[] } {
  return (
    typeof node === 'object' &&
    node !== null &&
    Array.isArray((node as { conditions?: unknown }).conditions)
  );
}

function isLeaf(node: unknown): node is FilterLeaf {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as { field?: unknown }).field === 'string'
  );
}

function collectLeaves(node: unknown, acc: FilterLeaf[]): void {
  if (isBranch(node)) {
    node.conditions.forEach(condition => collectLeaves(condition, acc));
  } else if (isLeaf(node)) {
    const { operator } = node as { operator?: unknown };
    acc.push({ field: node.field, operator: typeof operator === 'string' ? operator : undefined });
  }
}

function indexOperators(capabilities: CapabilitiesResult): Map<string, string[]> {
  const index = new Map<string, string[]>();
  capabilities.fields.forEach(field => index.set(field.name, field.operators ?? []));

  return index;
}

function normalizeFieldOperators(field: string, operators: string[]): string[] {
  return operators.map(operator => {
    const normalized = normalizeOperator(operator);

    if (!normalized) {
      throw mappingError(
        `Capabilities operator "${operator}" on field "${field}" has no canonical mapping`,
      );
    }

    return normalized;
  });
}

function validateFilter(filter: unknown, index: Map<string, string[]>): BffHttpError[] {
  const leaves: FilterLeaf[] = [];
  collectLeaves(filter, leaves);

  const errors: BffHttpError[] = [];

  for (const leaf of leaves) {
    const operators = index.get(leaf.field);

    if (operators === undefined) {
      errors.push(unknownField(leaf.field));
    } else if (operators.length === 0) {
      errors.push(fieldNotFilterable(leaf.field));
    } else if (leaf.operator !== undefined) {
      const normalized = normalizeFieldOperators(leaf.field, operators);

      if (!normalized.includes(leaf.operator)) {
        errors.push(invalidFilterOperator(leaf.field, normalized));
      }
    }
  }

  return errors;
}

function validateExistence(fields: string[], index: Map<string, string[]>): BffHttpError[] {
  return fields.filter(field => !index.has(field)).map(unknownField);
}

function dedupe(errors: BffHttpError[]): BffHttpError[] {
  const seen = new Set<string>();
  const result: BffHttpError[] = [];

  for (const error of errors) {
    const key = `${error.type}:${(error.details as { field?: string }).field}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push(error);
    }
  }

  return result;
}

/**
 * Validates a request's filter, sort, and projection fields against the target collection's
 * capabilities. Returns every offending field as a structured error (empty = valid); the caller
 * surfaces the whole list or just the first. Throws a 500 mapping_error when a capabilities
 * operator has no canonical mapping (a version skew between agent and BFF).
 */
export function validateAgainstCapabilities(
  params: ValidateParams,
  capabilities: CapabilitiesResult,
): BffHttpError[] {
  const index = indexOperators(capabilities);

  return dedupe([
    ...validateFilter(params.filter, index),
    ...validateExistence(params.sortFields ?? [], index),
    ...validateExistence(params.projectionFields ?? [], index),
  ]);
}

export function assertValidAgainstCapabilities(
  params: ValidateParams,
  capabilities: CapabilitiesResult,
): void {
  const [first] = validateAgainstCapabilities(params, capabilities);

  if (first) throw first;
}
