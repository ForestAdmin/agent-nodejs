/**
 * Convert PascalCase to the snake_case spelling an HTTP agent parses.
 *
 * Two passes handle the two boundaries: lowercase→uppercase (`greaterThan` → `greater_than`) and a
 * capital followed by a capitalised word (`IContains` → `i_contains`, `PreviousXDays` →
 * `previous_x_days`).
 */
export function toWireOperator(operator: string): string {
  return operator
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function isBranch(node: unknown): node is { aggregator?: string; conditions: unknown[] } {
  return (
    typeof node === 'object' &&
    node !== null &&
    Array.isArray((node as { conditions?: unknown }).conditions)
  );
}

function isLeaf(node: unknown): node is { field: string; operator?: string; value?: unknown } {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as { field?: unknown }).field === 'string'
  );
}

/**
 * Rewrite a plain condition tree into the wire format every HTTP Forest agent parses, whatever its
 * generation. Three differences from the canonical in-memory shape, each measured against
 * `forest-express-sequelize 9.6.10` and `forest_liana 9.21.0`:
 *
 * - operators are snake_case: a v1 liana answers `NoMatchingOperatorError` on `Equal`, and the v2
 *   agent accepts either spelling because it PascalCases what it receives
 *   (`agent/src/utils/condition-tree-parser.ts`)
 * - aggregators likewise: `and`, not `And`
 * - every leaf carries a `value` key even when its operator takes no operand, or a v1 liana answers
 *   `InvalidFiltersFormat`. The toolkit's validator allows `null` for exactly those operators
 *   (`MAP_ALLOWED_TYPES_FOR_OPERATOR_CONDITION_TREE`), so the key is safe on both generations.
 *
 * A branch is recognised before a leaf: a node carrying both `conditions` and `field` is ambiguous,
 * and reading it as a leaf would forward its conditions untouched.
 */
export default function toWireFilter(node: unknown): unknown {
  if (isBranch(node)) {
    const { aggregator, conditions } = node;

    return {
      ...(aggregator === undefined ? {} : { aggregator: aggregator.toLowerCase() }),
      conditions: conditions.map(toWireFilter),
    };
  }

  if (isLeaf(node)) {
    const { field, operator, value } = node;

    return {
      field,
      operator: operator === undefined ? operator : toWireOperator(operator),
      value: value ?? null,
    };
  }

  return node;
}
