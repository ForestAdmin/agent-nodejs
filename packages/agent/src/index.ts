import { TSchema } from '@forestadmin/datasource-toolkit';

import { AgentOptions } from './types';
import Agent from './builder/agent';

export { default as CollectionCustomizer } from './builder/collection';
export { Agent };
export * from './types';

export function createAgent<S extends TSchema = TSchema>(options: AgentOptions): Agent<S> {
  return new Agent<S>(options);
}
