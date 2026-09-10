import type { CapabilitiesResult } from './capabilities-cache';
import type { FieldType } from './field-type';
import type { Logger } from '../ports/logger-port';
import type { Operator } from '@forestadmin/datasource-toolkit';
import type { ForestSchemaCollection, ForestSchemaField } from '@forestadmin/forestadmin-client';

import { toWireOperator } from '@forestadmin/agent-client';
import { allowedOperatorsForColumnType } from '@forestadmin/datasource-toolkit';

import { normalizeFieldType } from './field-type';

/**
 * The operators every supported legacy liana honours, measured against
 * `forest-express-sequelize 9.6.10` and `forest_liana 9.21.0`: the scalar cases of their filter
 * switch plus the date family their separate date parser handles. Names are the legacy snake_case
 * wire format, which is also what a real capabilities response carries.
 *
 * This list exists because a legacy liana publishes a single `isFilterable` boolean per field, never
 * an operator list. Advertising the column type's whole operator set instead would admit operators
 * the liana rejects on its own, which the BFF maps to `422 unprocessable_entity` rather than the
 * `400 invalid_filter_operator` a caller can act on.
 *
 * It is the intersection of the two, not the union: `includes_all` sits in the column type table for
 * every array-capable type, and on a scalar column `forest-express-sequelize` answers it with a 500
 * carrying SQL while `forest_liana` rejects it outright. `i_contains` goes the other way — Rails
 * honours it, Express does not — so it stays out too.
 */
export const LEGACY_LIANA_OPERATORS: ReadonlySet<string> = new Set([
  'after',
  'after_x_hours_ago',
  'before',
  'before_x_hours_ago',
  'blank',
  'contains',
  'ends_with',
  'equal',
  'future',
  'greater_than',
  'in',
  'less_than',
  'not_contains',
  'not_equal',
  'past',
  'present',
  'previous_month',
  'previous_month_to_date',
  'previous_quarter',
  'previous_quarter_to_date',
  'previous_week',
  'previous_week_to_date',
  'previous_x_days',
  'previous_x_days_to_date',
  'previous_year',
  'previous_year_to_date',
  'starts_with',
  'today',
  'yesterday',
]);

/**
 * The lianas that never served `/forest/_internal/capabilities`, as the Forest server itself
 * enumerates them. The set is closed in practice — no new one is published — while the v2 agent
 * family grows, so listing the legacy names keeps an unlisted agent on the failing path rather than
 * silently downgrading it to the operator set above.
 */
export const LEGACY_LIANAS: ReadonlySet<string> = new Set([
  'forest-express-sequelize',
  'forest-express-mongoose',
  'forest-rails',
]);

const MANY_TO_ONE = 'ManyToOne';

/**
 * A `Map` and not the exported object: the type name is read from the apimap, and the table is a
 * frozen object literal, so a field typed `constructor` would resolve to the Object constructor —
 * truthy, and fatal on the `.map` below. A `Map` answers `undefined` for anything not a real key.
 */
const OPERATORS_BY_COLUMN_TYPE = new Map<string, readonly Operator[]>(
  Object.entries(allowedOperatorsForColumnType),
);

function primitiveNameOf(type: FieldType): string | undefined {
  const normalized = normalizeFieldType(type);

  if (typeof normalized === 'string') return normalized;
  if (Array.isArray(normalized) && typeof normalized[0] === 'string') return normalized[0];

  return undefined;
}

function operatorsFor(field: ForestSchemaField, collection: string, logger: Logger): string[] {
  if (field.isFilterable === false) return [];

  const primitive = primitiveNameOf(field.type);
  const allowed = primitive === undefined ? undefined : OPERATORS_BY_COLUMN_TYPE.get(primitive);

  if (!allowed) {
    logger(
      'Warn',
      'No operator table for a synthesized column type; field reads as not filterable',
      {
        collection,
        field: field.field,
        type: JSON.stringify(field.type),
      },
    );

    return [];
  }

  return allowed.map(toWireOperator).filter(operator => LEGACY_LIANA_OPERATORS.has(operator));
}

/**
 * Build the capabilities a v1 liana would have answered, from the apimap it already pushed.
 *
 * The three field classes mirror what the v2 agent's capabilities route emits, so the validator
 * produces the same error for the same input on both generations: a scalar carries its operators, a
 * to-one relation is present without any (so a direct filter on it is `field_not_filterable`), and
 * every other relation is omitted (so a filter on it is `unknown_field`).
 */
export default function synthesizeCapabilities(
  collection: ForestSchemaCollection,
  logger: Logger,
): CapabilitiesResult {
  const declared = (collection.fields ?? []).filter(
    (field): field is ForestSchemaField =>
      typeof field === 'object' && field !== null && typeof field.field === 'string',
  );

  const fields = declared.flatMap<CapabilitiesResult['fields'][number]>(field => {
    if (field.relationship) {
      if (field.relationship !== 'BelongsTo') return [];

      // A relation carries no operators, but it is still sortable through its target, so a sort the
      // liana denies has to be published as denied here too -- otherwise the BFF accepts the sort
      // and forwards it instead of answering field_not_sortable.
      const relation = { name: field.field, type: MANY_TO_ONE };

      return [field.isSortable === false ? { ...relation, sortable: false } : relation];
    }

    const entry: CapabilitiesResult['fields'][number] = {
      name: field.field,
      type: field.type,
      operators: operatorsFor(field, collection.name, logger),
    };

    return [field.isSortable === false ? { ...entry, sortable: false } : entry];
  });

  return { fields };
}
