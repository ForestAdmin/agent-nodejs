import type { ConditionTree, Operator } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

import Serializer from './serializer';

/** DynamoDB accepts at most 100 operands in an IN. */
const MAX_IN_OPERANDS = 100;
const NULL_TYPE = 'NULL';

const COMPARISONS: Partial<Record<Operator, string>> = {
  NotEqual: '<>',
  LessThan: '<',
  LessThanOrEqual: '<=',
  GreaterThan: '>',
  GreaterThanOrEqual: '>=',
  Before: '<',
  After: '>',
};

/** What DynamoDB evaluates itself; any other operator is applied on the items it returns. */
export const PUSHABLE_OPERATORS = new Set<Operator>([
  'Equal',
  'In',
  'NotIn',
  'Present',
  'Missing',
  'Blank',
  'StartsWith',
  'Contains',
  'NotContains',
  'IncludesAll',
  'IncludesNone',
  ...(Object.keys(COMPARISONS) as Operator[]),
]);

type LeafFilter = (leaf: ConditionTreeLeaf) => boolean;

function isPushable(leaf: ConditionTreeLeaf, accept: LeafFilter): boolean {
  return PUSHABLE_OPERATORS.has(leaf.operator) && !leaf.field.includes(':') && accept(leaf);
}

function intersect(trees: ConditionTree[]): ConditionTree | undefined {
  return trees.length ? ConditionTreeFactory.intersect(...trees) : undefined;
}

/**
 * Splits a condition tree between what DynamoDB can evaluate and what must be applied on the
 * returned items. An OR can only be pushed whole: half of it evaluated server-side would drop
 * items the other half still matches.
 */
export function splitCondition(
  tree?: ConditionTree,
  accept: LeafFilter = () => true,
): {
  pushable?: ConditionTree;
  residual?: ConditionTree;
} {
  if (!tree) return { pushable: undefined, residual: undefined };

  if (tree instanceof ConditionTreeLeaf) {
    return isPushable(tree, accept) ? { pushable: tree } : { residual: tree };
  }

  const branch = tree as ConditionTreeBranch;

  if (branch.aggregator === 'Or') {
    return branch.conditions.every(
      condition => splitCondition(condition, accept).residual === undefined,
    )
      ? { pushable: tree }
      : { residual: tree };
  }

  const parts = branch.conditions.map(condition => splitCondition(condition, accept));
  const pushable = parts.map(part => part.pushable).filter(Boolean);
  const residual = parts.map(part => part.residual).filter(Boolean);

  if (residual.length === 0) return { pushable: tree };
  if (pushable.length === 0) return { residual: tree };

  return { pushable: intersect(pushable), residual: intersect(residual) };
}

/**
 * Builds expressions that reference attributes and values by alias, which is both what
 * DynamoDB's reserved words require and what keeps user values out of the expression text.
 */
export default class ExpressionBuilder {
  readonly names: Record<string, string> = {};
  readonly values: Record<string, unknown> = {};
  private readonly nameAliases = new Map<string, string>();

  constructor(private readonly namePrefix = 'n', private readonly valuePrefix = 'v') {}

  /** Alias of an attribute path: `a->b` becomes `#n0.#n1`. */
  attribute(field: string): string {
    if (field.includes(':')) {
      throw new ValidationError(`Filtering on the relation field "${field}" is not supported`);
    }

    return Serializer.toPathSegments(field)
      .map(segment => this.name(segment))
      .join('.');
  }

  name(attributeName: string): string {
    let alias = this.nameAliases.get(attributeName);

    if (!alias) {
      alias = `#${this.namePrefix}${this.nameAliases.size}`;
      this.nameAliases.set(attributeName, alias);
      this.names[alias] = attributeName;
    }

    return alias;
  }

  value(value: unknown): string {
    const alias = `:${this.valuePrefix}${Object.keys(this.values).length}`;
    this.values[alias] = value instanceof Date ? value.toISOString() : value;

    return alias;
  }

  /** The top-level attributes a projection needs. */
  projection(fields: string[]): string {
    return [...new Set(fields.map(field => Serializer.toPathSegments(field)[0]))]
      .map(attribute => this.name(attribute))
      .join(', ');
  }

  result(): {
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, unknown>;
  } {
    return {
      ...(Object.keys(this.names).length ? { ExpressionAttributeNames: { ...this.names } } : {}),
      ...(Object.keys(this.values).length ? { ExpressionAttributeValues: { ...this.values } } : {}),
    };
  }

  condition(tree: ConditionTree): string {
    if (tree instanceof ConditionTreeLeaf) return this.leaf(tree);

    const { aggregator, conditions } = tree as ConditionTreeBranch;
    const expressions = conditions.map(condition => this.condition(condition));

    if (expressions.length === 1) return expressions[0];

    return `(${expressions.join(aggregator === 'And' ? ' AND ' : ' OR ')})`;
  }

  private isNull(path: string): string {
    return `attribute_type(${path}, ${this.value(NULL_TYPE)})`;
  }

  private missing(path: string): string {
    return `(attribute_not_exists(${path}) OR ${this.isNull(path)})`;
  }

  private never(path: string): string {
    return `(attribute_exists(${path}) AND attribute_not_exists(${path}))`;
  }

  private always(path: string): string {
    return `(attribute_exists(${path}) OR attribute_not_exists(${path}))`;
  }

  private in(path: string, values: unknown[]): string {
    const nonNull = values.filter(value => value !== null && value !== undefined);
    const hasNull = nonNull.length !== values.length;

    if (nonNull.length === 0) return hasNull ? this.missing(path) : this.never(path);

    const groups: string[] = [];

    for (let i = 0; i < nonNull.length; i += MAX_IN_OPERANDS) {
      const operands = nonNull.slice(i, i + MAX_IN_OPERANDS).map(value => this.value(value));
      groups.push(`${path} IN (${operands.join(', ')})`);
    }

    const matches = groups.length === 1 ? groups[0] : `(${groups.join(' OR ')})`;

    return hasNull ? `(${matches} OR ${this.missing(path)})` : matches;
  }

  private leaf(leaf: ConditionTreeLeaf): string {
    const path = this.attribute(leaf.field);
    const { operator, value } = leaf;
    const values = Array.isArray(value) ? value : [value];

    switch (operator) {
      case 'Equal':
        return value === null || value === undefined
          ? this.missing(path)
          : `${path} = ${this.value(value)}`;
      case 'Present':
        return `(attribute_exists(${path}) AND NOT ${this.isNull(path)})`;
      case 'Missing':
        return this.missing(path);
      case 'Blank':
        return `(attribute_not_exists(${path}) OR ${this.isNull(path)} OR ${path} = ${this.value(
          '',
        )})`;
      case 'In':
        return values.length === 0 ? this.never(path) : this.in(path, values);
      case 'NotIn': {
        if (values.length === 0) return this.always(path);
        const matches = this.in(path, values);

        return matches.startsWith('(') ? `NOT ${matches}` : `NOT (${matches})`;
      }
      case 'StartsWith':
        return `begins_with(${path}, ${this.value(value)})`;
      case 'Contains':
        return `contains(${path}, ${this.value(value)})`;
      case 'NotContains':
        return `NOT contains(${path}, ${this.value(value)})`;
      case 'IncludesAll':
        if (values.length === 0) return this.always(path);

        return `(${values.map(item => `contains(${path}, ${this.value(item)})`).join(' AND ')})`;
      case 'IncludesNone':
        if (values.length === 0) return this.always(path);

        return `(${values
          .map(item => `NOT contains(${path}, ${this.value(item)})`)
          .join(' AND ')})`;
      default: {
        const comparison = COMPARISONS[operator];

        if (!comparison) {
          throw new ValidationError(`Operator "${operator}" cannot be evaluated by DynamoDB`);
        }

        return `${path} ${comparison} ${this.value(value)}`;
      }
    }
  }
}
