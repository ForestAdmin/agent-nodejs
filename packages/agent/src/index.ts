import { CollectionCustomizer, TSchema } from '@forestadmin/datasource-customizer';

import { AgentOptions } from './types';
import Agent from './agent';

export function createAgent<S extends TSchema = TSchema>(options: AgentOptions): Agent<S> {
  return new Agent<S>(options);
}

export { Agent };
export { CollectionCustomizer };
export { AgentOptions } from './types';
