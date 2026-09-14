import type { Operator } from '@forestadmin/datasource-toolkit';

import { toWireOperator } from '@forestadmin/agent-client';
import { allOperators } from '@forestadmin/datasource-toolkit';

// `toWireOperator` is the one PascalCase -> snake_case mapping in the monorepo, and it is the same
// spelling the agent's capabilities route emits, so the inverse map round-trips every operator the
// agent can announce.
const SNAKE_TO_PASCAL = new Map<string, Operator>(
  allOperators.map(operator => [toWireOperator(operator), operator]),
);

/**
 * Maps an agent snake_case capabilities operator to the canonical PascalCase operator from
 * datasource-toolkit `allOperators`. Returns undefined when no canonical operator matches, which
 * only happens when the agent runs a newer operator set than this package (a version skew).
 */
export function normalizeOperator(snakeCaseOperator: string): Operator | undefined {
  return SNAKE_TO_PASCAL.get(snakeCaseOperator);
}

const CANONICAL_ORDER = new Map<Operator, number>(
  allOperators.map((operator, index) => [operator, index]),
);

/**
 * Deduplicates and reorders an operator set to the `allOperators` order. The agent serializes a
 * field's operators from a set, so their order is not contractual: putting them in a canonical order
 * is what lets two fields sharing an operator set be recognized as sharing it.
 */
export function toCanonicalOperatorSet(operators: Operator[]): Operator[] {
  return [...new Set(operators)].sort(
    (left, right) => (CANONICAL_ORDER.get(left) as number) - (CANONICAL_ORDER.get(right) as number),
  );
}
