import type { TSchema } from '@forestadmin/datasource-customizer';

import { RemoteAgentClient } from '@forestadmin/agent-client';

import Benchmark from './benchmark';

export default class TestableAgentBase<
  TypingsSchema extends TSchema = TSchema,
> extends RemoteAgentClient<TypingsSchema> {
  benchmark(): Benchmark {
    return new Benchmark();
  }
}
