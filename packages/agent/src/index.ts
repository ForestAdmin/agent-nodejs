import { TSchema } from '@forestadmin/datasource-toolkit';

import { AgentOptions } from './types';
import Agent from './builder/agent';
import TypingGenerator from './builder/utils/typing-generator';

export { default as Collection } from './builder/collection';
export { Agent };
export * from './types';

export { TypingGenerator }

export function createAgent<S extends TSchema = TSchema>(options: AgentOptions): Agent<S> {
  return new Agent<S>(options);
}
