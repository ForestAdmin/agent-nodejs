import type { ActionEndpointsByCollection } from '@forestadmin/agent-client';
import type { ForestSchemaCollection, ForestSchemaField } from '@forestadmin/forestadmin-client';

export type RelationshipType = 'BelongsTo' | 'HasOne' | 'HasMany' | 'BelongsToMany';

export type RelationTarget =
  | { type: RelationshipType; polymorphic: false; target: string }
  | { type: RelationshipType; polymorphic: true; targets: string[] };

export type PrimaryKeyField = { name: string; type: string };

export type ListableRelation = { name: string; foreignCollection: string };

// Only to-many relations expose list/count on the agent; to-one relations get update-relation only.
// A polymorphic relation carrying multiple targets is always the to-one (PolymorphicManyToOne) side.
// The data routes and the OpenAPI unfolding both resolve listability here, so a relation can never be
// documented as listable while the runtime 404s it, or the reverse.
function toListableTarget(target: RelationTarget): string | null {
  if (!('target' in target)) return null;
  if (target.type !== 'HasMany' && target.type !== 'BelongsToMany') return null;

  return target.target;
}

function toRelationTarget(field: ForestSchemaField): RelationTarget | null {
  if (!field.relationship) return null;

  const type = field.relationship;

  if (field.polymorphicReferencedModels && field.polymorphicReferencedModels.length > 0) {
    return { type, polymorphic: true, targets: [...field.polymorphicReferencedModels] };
  }

  if (field.reference) {
    // reference is `${foreignCollection}.${key}`; the collection name may itself contain dots
    // (e.g. mongoose nested collections like `User.address`), so drop only the trailing key.
    return { type, polymorphic: false, target: field.reference.split('.').slice(0, -1).join('.') };
  }

  return null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }

  return value;
}

/**
 * The agent read-model derived from a schema. Names are collection-scoped: relations and actions
 * are keyed by `(collection, name)` so the same relation/action name on two collections stays
 * distinct. The action allow-list is exactly the endpoint-map keys — endpoint-less actions are
 * not exposed.
 */
export default class ReadModel {
  private readonly collections: Set<string>;
  private readonly relations: Map<string, Map<string, RelationTarget>>;
  private readonly listableRelations: Map<string, Map<string, string>>;
  private readonly actionEndpoints: ActionEndpointsByCollection;
  private readonly primaryKeys: Map<string, PrimaryKeyField[]>;

  constructor(collections: ForestSchemaCollection[]) {
    this.collections = new Set();
    this.relations = new Map();
    this.listableRelations = new Map();
    // Null-prototype so an action/collection named like an Object.prototype member
    // (`toString`, `constructor`, `__proto__`, …) can't falsely pass the allow-list.
    this.actionEndpoints = Object.create(null) as ActionEndpointsByCollection;
    this.primaryKeys = new Map();

    for (const collection of collections) {
      this.collections.add(collection.name);
      this.buildRelations(collection);
      this.buildActionEndpoints(collection);
      this.buildPrimaryKeys(collection);
    }

    // Freeze the exposed structures so a consumer cannot mutate the shared cached read-model.
    deepFreeze(this.actionEndpoints);
    this.relations.forEach(byRelation => byRelation.forEach(deepFreeze));
    this.primaryKeys.forEach(deepFreeze);
  }

  private buildRelations(collection: ForestSchemaCollection): void {
    const relations = new Map<string, RelationTarget>();
    const listable = new Map<string, string>();

    for (const field of collection.fields ?? []) {
      const target = toRelationTarget(field);

      if (target) {
        relations.set(field.field, target);
        const foreignCollection = toListableTarget(target);
        if (foreignCollection) listable.set(field.field, foreignCollection);
      }
    }

    this.relations.set(collection.name, relations);
    this.listableRelations.set(collection.name, listable);
  }

  private buildActionEndpoints(collection: ForestSchemaCollection): void {
    const actions = collection.actions ?? [];
    const withEndpoint = actions.filter(action => Boolean(action.endpoint));

    if (withEndpoint.length === 0) return;

    this.actionEndpoints[collection.name] = Object.create(null);

    for (const action of withEndpoint) {
      // Copy fields/hooks so a mutating consumer can't corrupt the shared cached schema, and
      // default them defensively: the schema is cast from `Record<string, unknown>`, so a
      // malformed action could omit them at runtime despite the declared type.
      this.actionEndpoints[collection.name][action.name] = {
        id: action.id,
        name: action.name,
        endpoint: action.endpoint,
        hooks: { load: action.hooks?.load ?? false, change: [...(action.hooks?.change ?? [])] },
        fields: (action.fields ?? []).map(field => ({ ...field })),
      };
    }
  }

  private buildPrimaryKeys(collection: ForestSchemaCollection): void {
    const keys: PrimaryKeyField[] = [];

    for (const field of collection.fields ?? []) {
      if (field.isPrimaryKey) keys.push({ name: field.field, type: field.type });
    }

    this.primaryKeys.set(collection.name, keys);
  }

  isCollectionAllowed(collection: string): boolean {
    return this.collections.has(collection);
  }

  /** A fresh copy per call, so a consumer cannot mutate the shared cached read-model. */
  getAllowedCollections(): string[] {
    return [...this.collections];
  }

  /**
   * The to-many, non-polymorphic relations of a collection — the only ones with a list/count route.
   * The foreign collection is NOT checked against the allow-list here: the data routes must keep
   * telling a non-listable relation (404 unknown_relation) from a listable one pointing at a hidden
   * collection (404 unknown_collection), so that filter belongs to each caller.
   */
  getListableRelations(collection: string): ListableRelation[] {
    const listable = this.listableRelations.get(collection);
    if (!listable) return [];

    return [...listable].map(([name, foreignCollection]) => ({ name, foreignCollection }));
  }

  getListableRelationTarget(collection: string, relation: string): string | undefined {
    return this.listableRelations.get(collection)?.get(relation);
  }

  isRelationAllowed(collection: string, relation: string): boolean {
    return this.relations.get(collection)?.has(relation) ?? false;
  }

  getRelationTarget(collection: string, relation: string): RelationTarget | undefined {
    return this.relations.get(collection)?.get(relation);
  }

  isActionAllowed(collection: string, action: string): boolean {
    return this.actionEndpoints[collection]?.[action] !== undefined;
  }

  getActionEndpoints(): ActionEndpointsByCollection {
    return this.actionEndpoints;
  }

  getPrimaryKeys(collection: string): PrimaryKeyField[] {
    return this.primaryKeys.get(collection) ?? [];
  }
}
