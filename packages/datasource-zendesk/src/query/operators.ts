import type { Operator } from '@forestadmin/datasource-toolkit';

/**
 * Operator vocabularies supported by the Zendesk Search API, declared once and shared by
 * the static collection schemas and the custom-field introspector so the two can never drift.
 *
 * `In`/`NotIn` are advertised so the operators-equivalence decorator does not rewrite them into
 * an `Or` tree (which the translator cannot express — Zendesk Search has no `OR`). Zendesk treats
 * the resulting terms as a conjunction, so multi-value membership on Search-resolved fields is a
 * known limitation; only the primary key matches each value exactly, via the id-lookup path.
 */
export const ID_OPS = new Set<Operator>(['Equal', 'In']);

export const STRING_OPS = new Set<Operator>([
  'Equal',
  'NotEqual',
  'In',
  'NotIn',
  'Present',
  'Blank',
]);

export const NUMBER_OPS = new Set<Operator>([
  'Equal',
  'NotEqual',
  'In',
  'NotIn',
  'Present',
  'Blank',
  'GreaterThan',
  'LessThan',
]);

export const DATE_OPS = new Set<Operator>(['Equal', 'Before', 'After', 'Present', 'Blank']);

export const BOOLEAN_OPS = new Set<Operator>(['Equal', 'NotEqual']);
