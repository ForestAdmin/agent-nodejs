import { TSchema } from '@forestadmin/datasource-customizer';

import Agent from './agent';
import { AgentOptions } from './types';

export function createAgent<S extends TSchema = TSchema>(options: AgentOptions): Agent<S> {
  return new Agent<S>(options);
}

export { Agent };
export { AgentOptions, AgentOptionsWithDefaults, HttpCode, RouteType } from './types';
export * from '@forestadmin/datasource-customizer';

// export is necessary for the agent-generator package
export { default as SchemaGenerator } from './utils/forest-schema/generator';

// export for rpc agent
export { ForestAdminHttpDriverServices } from './services';
export { default as BaseRoute } from './routes/base-route';
export { default as CollectionRoute } from './routes/collection-route';
export { default as QueryStringParser } from './utils/query-string';
export { ROOT_ROUTES_CTOR } from './routes';
