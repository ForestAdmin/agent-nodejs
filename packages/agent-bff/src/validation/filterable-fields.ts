import type { Logger } from '../ports/logger-port';
import type { CapabilitiesResult } from '../read-model/capabilities-cache';
import type { Operator } from '@forestadmin/datasource-toolkit';

import { normalizeOperator, toCanonicalOperatorSet } from './operator-normalizer';

/**
 * A field the agent reports at least one operator for, with that operator set — the very set the
 * runtime validates a filter leaf against. Normalized to canonical PascalCase and to the
 * `allOperators` order at collect time, so the same capabilities answer always yields the same
 * document whatever order the agent serialized the operators in.
 */
export interface FilterableField {
  name: string;
  operators: Operator[];
}

/**
 * The operators to document for one field, or null to leave the field out of the filterable set.
 *
 * An operator with no canonical mapping means the agent runs a newer operator set than this package.
 * The field is dropped rather than widened, because `capabilities-validator` normalizes a field's
 * WHOLE operator list before comparing the one that was sent: a skewed field answers 500
 * `mapping_error` on ANY filter, even a plain `Equal`. Documenting it as filterable would promise a
 * call the BFF never honours, and a raw snake_case operator must never reach the public document. The
 * skew is surfaced in the log instead — dropping the field keeps the document truthful, so it stays
 * cacheable.
 */
function documentedOperators(
  collection: string,
  field: string,
  operators: string[],
  logger: Logger,
): Operator[] | null {
  const normalized: Operator[] = [];

  for (const operator of operators) {
    const canonical = normalizeOperator(operator);

    if (!canonical) {
      logger('Warn', 'Documenting a field as not filterable: one of its operators has no mapping', {
        collection,
        field,
        operator,
      });

      return null;
    }

    normalized.push(canonical);
  }

  return toCanonicalOperatorSet(normalized);
}

/**
 * The filterable subset, plus whether a field was dropped as undocumentable rather than as genuinely
 * not filterable. The caller needs the two apart: a field with no operator is an ANSWER the document
 * can state, while a field dropped for operator skew leaves the filterable set incomplete, and an
 * incomplete set that ends up empty must not be documented as "nothing is filterable".
 */
export default function collectFilterableFields(
  collection: string,
  capabilities: CapabilitiesResult,
  logger: Logger,
): { fields: FilterableField[]; undocumentable: boolean } {
  const fields: FilterableField[] = [];
  let undocumentable = false;

  for (const field of capabilities.fields) {
    if ((field.operators?.length ?? 0) > 0) {
      const operators = documentedOperators(
        collection,
        field.name,
        field.operators as string[],
        logger,
      );

      if (operators === null) undocumentable = true;
      else fields.push({ name: field.name, operators });
    }
  }

  return { fields, undocumentable };
}
