import type { AgentOptions } from './types';
import type { TSchema } from '@forestadmin/datasource-customizer';

import Agent from './agent';

export function createAgent<S extends TSchema = TSchema>(options: AgentOptions): Agent<S> {
  return new Agent<S>(options);
}

export { Agent };
export { AgentOptions } from './types';
export * from '@forestadmin/datasource-customizer';

// export is necessary for the agent-generator package
export { default as SchemaGenerator } from './utils/forest-schema/generator';
