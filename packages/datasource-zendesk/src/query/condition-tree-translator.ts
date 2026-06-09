import type { CustomFieldMapping, ZendeskResource } from '../types';
import type { ConditionTree, Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeBranch, ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import { UnsupportedOperatorError } from '../errors';

export type TranslateOptions = {
  resource: ZendeskResource;
  customFieldMapping?: CustomFieldMapping;
  timezone?: string;
};

const SPECIAL_CHARS_PATTERN = /[\s"():-]/;

function ensureNonEmptyArray(value: unknown, operator: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new UnsupportedOperatorError(`Operator '${operator}' requires a non-empty array value.`);
  }

  return value;
}

function formatValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') return String(value);

  const stringValue = String(value);

  if (SPECIAL_CHARS_PATTERN.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '\\"')}"`;
  }

  return stringValue;
}

function mapFieldName(field: string, operator: Operator, options: TranslateOptions): string {
  // Tickets expose `requester_email` as a derived field; on the Zendesk Search side it is
  // queried through the `requester` shortcut, but only with an equality match.
  if (options.resource === 'ticket' && field === 'requester_email') {
    if (operator !== 'Equal') {
      throw new UnsupportedOperatorError(
        `'requester_email' on tickets only supports the 'Equal' operator (got '${operator}').`,
      );
    }

    return 'requester';
  }

  return options.customFieldMapping?.get(field) ?? field;
}

function translateLeaf(leaf: ConditionTreeLeaf, options: TranslateOptions): string {
  const fieldName = mapFieldName(leaf.field, leaf.operator, options);
  const { operator, value } = leaf;

  if (operator === 'Present') return `${fieldName}:*`;
  if (operator === 'Blank') return `-${fieldName}:*`;

  if (value === null || value === undefined) {
    throw new UnsupportedOperatorError(
      `Operator '${operator}' with null/undefined value is not supported by Zendesk Search.`,
    );
  }

  switch (operator) {
    case 'Equal':
      return `${fieldName}:${formatValue(value)}`;
    case 'NotEqual':
      return `-${fieldName}:${formatValue(value)}`;

    case 'In': {
      const list = ensureNonEmptyArray(value, operator);

      return list.map(v => `${fieldName}:${formatValue(v)}`).join(' ');
    }

    case 'NotIn': {
      const list = ensureNonEmptyArray(value, operator);

      return list.map(v => `-${fieldName}:${formatValue(v)}`).join(' ');
    }

    case 'GreaterThan':
    case 'After':
      return `${fieldName}>${formatValue(value)}`;
    case 'LessThan':
    case 'Before':
      return `${fieldName}<${formatValue(value)}`;
    default:
      throw new UnsupportedOperatorError(
        `Operator '${operator}' is not supported by Zendesk Search.`,
      );
  }
}

function translateNode(tree: ConditionTree, options: TranslateOptions): string {
  if (tree instanceof ConditionTreeBranch) {
    if (tree.aggregator !== 'And') {
      throw new UnsupportedOperatorError(
        `Zendesk Search does not support the '${tree.aggregator}' aggregator. Only 'And' is supported.`,
      );
    }

    return tree.conditions
      .map(condition => translateNode(condition, options))
      .filter(part => part.length > 0)
      .join(' ');
  }

  if (tree instanceof ConditionTreeLeaf) {
    return translateLeaf(tree, options);
  }

  throw new UnsupportedOperatorError(`Unknown condition tree node: ${tree.constructor.name}`);
}

export function translateConditionTree(
  tree: ConditionTree | undefined,
  options: TranslateOptions,
): string {
  if (!tree) return '';

  return translateNode(tree, options).trim();
}
