import { createForestAgentClient } from '../../src';

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('test any agent setup', () => {
  const serverSandboxPort = 3456;
  const agentNodeJsPort = 3357;
  const agentPythonPort = 8000;

  beforeAll(async () => {
    // you can start the server where you want. The best practice is to start before all tests
    // await createForestServerSandbox(serverSandboxPort);
    // your agents can be started in the beforeAll, or everywhere you want
    // DON'T FORGET TO START THE SERVER BEFORE THE AGENTS
    // SET TO YOUR AGENT URL THE URL OF THE SERVER TO MOCK THE SERVER RESPONSE
  });

  it('can call several agents with several stacks', async () => {
    const pythonAgent = await createForestAgentClient({
      agentForestEnvSecret: 'ceba742f5bc73946b34da192816a4d7177b3233fee7769955c29c0e90fd584f2',
      agentForestAuthSecret: 'aeba742f5bc73946b34da192816a4d7177b3233fee7769955c29c0e90fd584f2',
      agentUrl: `http://127.0.0.1:${agentPythonPort}`,
      serverUrl: `http://127.0.0.1:${serverSandboxPort}`,
      agentSchemaPath: 'python-schema-path/.forestadmin-schema.json',
    });

    const nodeJsAgent = await createForestAgentClient({
      agentForestEnvSecret: 'e2b3ad263d5a0e0eea6b373d27696dc7c52919b4c76d09c4ec776d09f12b2a48',
      agentForestAuthSecret: 'b0bdf0a639c16bae8851dd24ee3d79ef0a352e957c5b86cb',
      agentUrl: `http://127.0.0.1:${agentNodeJsPort}`,
      serverUrl: `http://127.0.0.1:${serverSandboxPort}`,
      agentSchemaPath: 'nodejs-schema-path/.forestadmin-schema.json',
    });

    const address = await pythonAgent.collection('address').list();
    const users = await nodeJsAgent.collection('customer').list();

    expect(address.length).toEqual(15);
    expect(users.length).toEqual(15);
  });
});
