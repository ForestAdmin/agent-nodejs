import type { ActionEndpointsByCollection } from '../domains/action';
import type { ForestSchemaAction } from '@forestadmin/forestadmin-client';

export type SchemaAction = Pick<ForestSchemaAction, 'id' | 'name' | 'endpoint'> &
  Partial<Pick<ForestSchemaAction, 'hooks' | 'fields' | 'layout'>>;

export interface SchemaCollectionWithActions {
  name: string;
  actions?: readonly SchemaAction[];
}

// Null-prototype maps so a collection or action named like an Object.prototype member
// (`toString`, `__proto__`, …) cannot resolve to an inherited value. `hooks` and `fields` get no
// default: a legacy schema that omits them must keep probing /hooks/load, and coercing them to
// {load: false} / [] would render a dynamic form as an empty static one.
export default function actionEndpointsFromSchema(
  collections: readonly SchemaCollectionWithActions[],
): ActionEndpointsByCollection {
  const endpoints = Object.create(null) as ActionEndpointsByCollection;

  for (const collection of collections) {
    const callable = (collection.actions ?? []).filter(action => Boolean(action.endpoint));

    if (callable.length > 0) {
      endpoints[collection.name] = Object.create(null);

      for (const { id, name, endpoint, hooks, fields, layout } of callable) {
        endpoints[collection.name][name] = structuredClone({
          id,
          name,
          endpoint,
          hooks,
          fields,
          layout,
        }) as ActionEndpointsByCollection[string][string];
      }
    }
  }

  return endpoints;
}
