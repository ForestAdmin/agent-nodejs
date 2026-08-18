import type { FieldType } from '../read-model/capabilities-cache';
import type { PrimaryKeyField } from '../read-model/read-model';
import type { Operator } from '@forestadmin/datasource-toolkit';

/**
 * The snapshot the OpenAPI generator unfolds. It is plain data on purpose: collecting it hits the
 * network (schema + capabilities per collection), generating from it does not, so the route and the
 * CLI can be proven to emit the same document by feeding them one snapshot.
 */
export interface Unfolding {
  collections: UnfoldedCollection[];
}

export interface UnfoldedCollection {
  name: string;
  fields: CollectionFields;
  primaryKeys: PrimaryKeyField[];
  /** To-many relations whose foreign collection is exposed too — the only ones with a route. */
  relations: UnfoldedRelation[];
  actions: UnfoldedAction[];
}

export interface UnfoldedRelation {
  name: string;
  foreignCollection: string;
}

/**
 * `projectable` is every capability field; `filterable` is the subset carrying operators. They
 * differ: a `ManyToOne` is reported by the agent without operators, so projecting or sorting on it
 * works while filtering on it answers 422 field_not_filterable.
 *
 * `degraded` is set when the field set could not be established. The collection keeps its paths, but
 * their field schemas stay free-form strings — an empty enum would forbid every valid call.
 */
export interface CollectionFields {
  projectable: string[];
  filterable: FilterableField[];
  degraded: DegradedReason | null;
}

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

export type DegradedReason = 'capabilities_unavailable' | 'no_fields';

/** True when at least one collection went out without its field set. */
export function hasDegradedCollection(unfolding: Unfolding): boolean {
  return unfolding.collections.some(collection => collection.fields.degraded !== null);
}

/**
 * True when NO collection got its field set — the signature of an unreachable agent rather than of
 * one odd collection. An empty schema is not degraded: there was nothing to enumerate.
 */
export function isFullyDegraded(unfolding: Unfolding): boolean {
  return (
    unfolding.collections.length > 0 &&
    unfolding.collections.every(collection => collection.fields.degraded !== null)
  );
}

export interface UnfoldedAction {
  name: string;
  fields: UnfoldedActionField[];
}

export interface UnfoldedActionField {
  name: string;
  type: FieldType;
  isRequired: boolean;
  enums: string[] | null;
}

export type { FieldType };
