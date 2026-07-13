import type { Operator } from '@forestadmin/datasource-toolkit';

import { allOperators } from '@forestadmin/datasource-toolkit';

/**
 * Mirrors the agent's capabilities serialization (`packages/agent/src/routes/capabilities.ts`),
 * which converts each PascalCase operator to snake_case before returning it. Kept identical so the
 * inverse map below round-trips every operator the agent can emit.
 */
export function toSnakeCaseOperator(operator: string): string {
  return operator
    .split(/\.?(?=[A-Z])/)
    .join('_')
    .toLowerCase();
}

const SNAKE_TO_PASCAL: Record<string, Operator> = Object.fromEntries(
  allOperators.map(operator => [toSnakeCaseOperator(operator), operator]),
);

/**
 * Maps an agent snake_case capabilities operator to the canonical PascalCase operator from
 * datasource-toolkit `allOperators`. Returns undefined when no canonical operator matches, which
 * only happens when the agent runs a newer operator set than this package (a version skew).
 */
export function normalizeOperator(snakeCaseOperator: string): Operator | undefined {
  return SNAKE_TO_PASCAL[snakeCaseOperator];
}
