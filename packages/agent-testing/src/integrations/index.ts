import { Agent, createAgent } from '@forestadmin/agent';
import { TSchema } from '@forestadmin/datasource-customizer';
import { ForestSchema } from '@forestadmin/forestadmin-client';
import fs from 'fs';
import superagent from 'superagent';

import ForestAdminClientMock from './forest-admin-client-mock';
import ForestServerSandbox from './forest-server-sandbox';
import { createHttpRequester } from './http-requester-mock';
import SchemaConverter from './schema-converter';
import SchemaPathManager from './schema-path-manager';
import TestableAgent from './testable-agent';
import TestableAgentBase from './testable-agent-base';
import { TestableAgentOptions } from './types';
import { PermissionsOverride } from '../remote-agent-client/domains/remote-agent-client';

export { AgentOptions, Agent } from '@forestadmin/agent';
export * from './types';

export { SchemaPathManager, ForestServerSandbox, TestableAgent };
export type ForestAgentClient = TestableAgentBase;

/**
 * Create a forest server sandbox
 * It is useful to test the agent if you use the createForestAgentClient way to test your agent
 * @param port
 */
export async function createForestServerSandbox(port: number): Promise<ForestServerSandbox> {
  return new ForestServerSandbox(port).createServer();
}

/**
 * Create a forest client to test your agent customizations
 * by sending requests to the agent like the frontend does.
 * With this client, you should start your agent by yourself.
 * You can test any agent with this client (python, ruby, nodeJs, etc.)
 * @param options
 */
export async function createForestAgentClient(options: {
  agentForestEnvSecret: string;
  agentForestAuthSecret: string;
  agentUrl: string;
  serverUrl: string;
  agentSchemaPath: string;
}): Promise<ForestAgentClient> {
  const { serverUrl, agentUrl, agentSchemaPath } = options;
  let schema: ForestSchema;

  try {
    schema = JSON.parse(fs.readFileSync(agentSchemaPath, { encoding: 'utf-8' }));
  } catch (e) {
    throw new Error('Provide a right schema path');
  }

  // send the schema to the server to allow the server to build fake answers
  await superagent
    .post(`${serverUrl}/agent-schema`)
    .set('forest-secret-key', options.agentForestEnvSecret)
    .send(schema);

  const httpRequester = createHttpRequester(
    {
      authSecret: options.agentForestAuthSecret,
      url: agentUrl,
    },
    {
      envSecret: options.agentForestEnvSecret,
      authSecret: options.agentForestAuthSecret,
      isProduction: false,
    },
  );

  const overridePermissions = async (permissions: PermissionsOverride) => {
    await superagent
      .post(`${serverUrl}/permission-override`)
      .set('forest-secret-key', options.agentForestEnvSecret)
      .send(permissions);
  };

  return new TestableAgentBase({
    actionEndpoints: SchemaConverter.extractActionEndpoints(schema),
    httpRequester,
    overridePermissions,
  });
}

/**
 * Create a testable agent
 * You can test your agentNodejs customizations by injecting your customizations.
 * It will start the agent for you. You don't need to start the agent by yourself and a server.
 * It's not compatible with the createForestAgentClient & createForestServerSandbox way.
 * It is recommended to user createForestAgentClient & createForestServerSandbox to test your agent.
 *
 * @param customizer
 * @param options
 */
export async function createTestableAgent<TypingsSchema extends TSchema = TSchema>(
  customizer: (agent: Agent<TypingsSchema>) => void,
  options?: TestableAgentOptions,
): Promise<TestableAgent<TypingsSchema>> {
  const agentOptions: TestableAgentOptions = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    logger: () => {},
    schemaPath: SchemaPathManager.generateTemporarySchemaPath(),
    isProduction: false,
    ...(options || {}),
    // 0 is a random port
    port: options?.port || 0,
    // Cast to any to avoid type mismatch when workspace has different forestadmin-client version
    forestAdminClient: new ForestAdminClientMock() as any,
    authSecret: options?.authSecret || 'b0bdf0a639c16bae8851dd24ee3d79ef0a352e957c5b86cb',
    envSecret:
      options?.envSecret || 'ceba742f5bc73946b34da192816a4d7177b3233fee7769955c29c0e90fd584f2',
  };

  const agent = createAgent<TypingsSchema>(agentOptions);
  if (!agent) throw new Error('Agent is not defined');

  customizer(agent);

  return new TestableAgent<TypingsSchema>({ agent, agentOptions });
}
