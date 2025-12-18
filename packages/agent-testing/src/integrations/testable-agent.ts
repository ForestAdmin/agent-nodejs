import type { Agent } from '@forestadmin/agent';
import type { TSchema } from '@forestadmin/datasource-customizer';

import fs from 'fs/promises';

import { createHttpRequester } from './http-requester-mock';
import { SchemaPathManager, TestableAgentOptions } from './index';
import SchemaConverter from './schema-converter';
import TestableAgentBase from './testable-agent-base';

export default class TestableAgent<
  TypingsSchema extends TSchema = TSchema,
> extends TestableAgentBase<TypingsSchema> {
  private readonly agent: Agent<TypingsSchema>;
  private readonly agentOptions: TestableAgentOptions;

  constructor({
    agent,
    agentOptions,
  }: {
    agent: Agent<TypingsSchema>;
    agentOptions: TestableAgentOptions;
  }) {
    super();
    this.agent = agent;
    this.agentOptions = agentOptions;
  }

  async stop(): Promise<void> {
    await this.agent.stop();

    await SchemaPathManager.removeTemporarySchemaPath(this.agentOptions.schemaPath);
  }

  async start(): Promise<void> {
    await this.agent.mountOnStandaloneServer(this.agentOptions.port ?? 0).start();
    if (!this.agentOptions.schemaPath) throw new Error('schemaPath is required');
    this.actionEndpoints = SchemaConverter.extractActionEndpoints(
      JSON.parse(await fs.readFile(this.agentOptions.schemaPath, 'utf8')),
    );
    this.httpRequester = createHttpRequester(
      {
        url: `http://localhost:${this.agent.standaloneServerPort}`,
        authSecret: this.agentOptions.authSecret,
      },
      this.agentOptions,
    );
  }
}
