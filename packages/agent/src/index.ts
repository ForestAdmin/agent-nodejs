import { TSchema } from '@forestadmin/datasource-toolkit';

import { BuilderOptions } from './types';
import Agent from './builder/agent';

export { default as Collection } from './builder/collection';
export { Agent };
export * from './types';

export function createAgent<S extends TSchema = TSchema>(options: BuilderOptions): Agent<S> {
  return new Agent<S>(options);
}
