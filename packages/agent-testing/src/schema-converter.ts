import type { ActionEndpointsByCollection } from '@forestadmin/agent-client';
import type { ForestSchema } from '@forestadmin/forestadmin-client';

export default class SchemaConverter {
  static extractActionEndpoints(schema: ForestSchema): ActionEndpointsByCollection {
    const actionEndpoints: ActionEndpointsByCollection = {};
    Object.values(schema.collections).forEach(c => {
      actionEndpoints[c.name] = c.actions.reduce(
        (acc, action) => ({
          ...acc,
          [action.name]: { name: action.name, endpoint: action.endpoint },
        }),
        {},
      );
    });

    return actionEndpoints;
  }
}
