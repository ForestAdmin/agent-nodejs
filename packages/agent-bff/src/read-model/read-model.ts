import type { ActionEndpointsByCollection } from '@forestadmin/agent-client';
import type { ForestSchemaCollection, ForestSchemaField } from '@forestadmin/forestadmin-client';

export type RelationshipType = 'BelongsTo' | 'HasOne' | 'HasMany' | 'BelongsToMany';

export type RelationTarget =
  | { type: RelationshipType; polymorphic: false; target: string }
  | { type: RelationshipType; polymorphic: true; targets: string[] };

function toRelationTarget(field: ForestSchemaField): RelationTarget | null {
  if (!field.relationship) return null;

  const type = field.relationship;

  if (field.polymorphicReferencedModels && field.polymorphicReferencedModels.length > 0) {
    return { type, polymorphic: true, targets: [...field.polymorphicReferencedModels] };
  }

  if (field.reference) {
    return { type, polymorphic: false, target: field.reference.split('.')[0] };
  }

  return null;
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
  private readonly actionEndpoints: ActionEndpointsByCollection;

  constructor(collections: ForestSchemaCollection[]) {
    this.collections = new Set();
    this.relations = new Map();
    this.actionEndpoints = {};

    for (const collection of collections) {
      this.collections.add(collection.name);
      this.buildRelations(collection);
      this.buildActionEndpoints(collection);
    }
  }

  private buildRelations(collection: ForestSchemaCollection): void {
    const relations = new Map<string, RelationTarget>();

    for (const field of collection.fields) {
      const target = toRelationTarget(field);
      if (target) relations.set(field.field, target);
    }

    this.relations.set(collection.name, relations);
  }

  private buildActionEndpoints(collection: ForestSchemaCollection): void {
    const actions = collection.actions ?? [];
    const withEndpoint = actions.filter(action => Boolean(action.endpoint));

    if (withEndpoint.length === 0) return;

    this.actionEndpoints[collection.name] = {};

    for (const action of withEndpoint) {
      this.actionEndpoints[collection.name][action.name] = {
        id: action.id,
        name: action.name,
        endpoint: action.endpoint,
        hooks: action.hooks,
        fields: action.fields,
      };
    }
  }

  isCollectionAllowed(collection: string): boolean {
    return this.collections.has(collection);
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
}
