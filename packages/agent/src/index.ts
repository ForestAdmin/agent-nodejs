import { AgentOptions } from './types';
import Agent from './builder/agent';

export { default as Collection } from './builder/collection';
export * from './types';

export function createAgent(agentoptions: AgentOptions): Agent {
  return new Agent(agentoptions);
}
