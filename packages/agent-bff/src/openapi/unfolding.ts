import type { FieldType } from '../read-model/capabilities-cache';
import type { PrimaryKeyField } from '../read-model/read-model';

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
 * works while filtering on it answers 400 field_not_filterable.
 *
 * `degraded` is set when the field set could not be established. The collection keeps its paths, but
 * their field schemas stay free-form strings — an empty enum would forbid every valid call.
 */
export interface CollectionFields {
  projectable: string[];
  filterable: string[];
  degraded: DegradedReason | null;
}

export type DegradedReason = 'capabilities_unavailable' | 'no_fields';

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
