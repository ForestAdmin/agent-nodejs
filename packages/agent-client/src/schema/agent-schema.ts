import type { SchemaCollectionWithActions } from './action-endpoints';
import type { RelationTarget } from './relation-target';
import type { ActionEndpointsByCollection } from '../domains/action';
import type { ForestSchemaField } from '@forestadmin/forestadmin-client';

import actionEndpointsFromSchema from './action-endpoints';
import relationTargetOf from './relation-target';

export type SchemaField = Pick<
  ForestSchemaField,
  'field' | 'reference' | 'polymorphicReferencedModels'
>;

export interface SchemaCollection extends SchemaCollectionWithActions {
  fields?: readonly SchemaField[];
}

export type SchemaActions = ActionEndpointsByCollection[string];

export interface AgentSchemaCollection {
  readonly actions: SchemaActions;
  relation(name: string): RelationTarget | null;
}

export class AgentSchema {
  readonly actionEndpoints: ActionEndpointsByCollection;

  private readonly fields = new Map<string, Map<string, SchemaField>>();

  constructor(collections: readonly SchemaCollection[]) {
    this.actionEndpoints = actionEndpointsFromSchema(collections);

    for (const collection of collections) {
      this.fields.set(
        collection.name,
        new Map((collection.fields ?? []).map(field => [field.field, field])),
      );
    }
  }

  collection(name: string): AgentSchemaCollection {
    const fields = this.fields.get(name);

    return {
      actions: this.actionEndpoints[name] ?? Object.create(null),
      relation: relation => {
        const field = fields?.get(relation);

        return field ? relationTargetOf(field) : null;
      },
    };
  }
}

const schemas = new WeakMap<readonly SchemaCollection[], AgentSchema>();

export default function agentSchemaOf(collections: readonly SchemaCollection[]): AgentSchema {
  if (!schemas.has(collections)) schemas.set(collections, new AgentSchema(collections));

  return schemas.get(collections);
}
