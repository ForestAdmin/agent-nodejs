import type { Operator } from '@forestadmin/datasource-toolkit';

/**
 * Operator vocabularies supported by the Zendesk Search API, declared once and shared by
 * the static collection schemas and the custom-field introspector so the two can never drift.
 *
 * Zendesk Search has no `OR` operator, so multi-value membership (`In`/`NotIn`) cannot be
 * expressed for fields resolved through Search. Only the primary key advertises `In`, because
 * id lookups bypass Search entirely (see {@link BaseZendeskCollection.extractIdLookup}).
 */
export const ID_OPS = new Set<Operator>(['Equal', 'In']);

export const STRING_OPS = new Set<Operator>(['Equal', 'NotEqual', 'Present', 'Blank']);

export const NUMBER_OPS = new Set<Operator>([
  'Equal',
  'NotEqual',
  'Present',
  'Blank',
  'GreaterThan',
  'LessThan',
]);

export const DATE_OPS = new Set<Operator>(['Equal', 'Before', 'After', 'Present', 'Blank']);

export const BOOLEAN_OPS = new Set<Operator>(['Equal', 'NotEqual']);
