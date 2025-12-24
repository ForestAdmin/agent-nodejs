# Agent Testing Library

**Internally at Forest Admin, we use it to test our agents.**

This library provides a set of utilities for testing agents with any Agent stack (NodeJS, Ruby, Python, PHP).

It is in alpha version and is subject to breaking changes.
For the moment, it only provides an incomplete set of utilities for integration but it will be extended in the future.

## Installation

```bash
npm install @forestadmin-experimental/agent-nodejs-testing
```

or for Yarn users

```bash
yarn add @forestadmin-experimental/agent-nodejs-testing
```

### Integration Tests - Recommended Testing Strategy

Integration testing ensures that your agent works as expected.
It's a good way to test your agent customizations.

### For Any Agent stack (NodeJS, Ruby, Python, PHP)

```javascript
const {
  createForestServerSandbox,
  createForestAgentClient,
  ForestServerSandbox,
} = require('@forestadmin-experimental/agent-nodejs-testing');

describe('billing collection', () => {
  let serverSandbox: ForestServerSandbox;
  const agentPort = 3310;
  const serverSandboxPort = 3311;

  beforeAll(async () => {
    // 1. MUST BE DONE BEFORE STARTING THE AGENT
    // Start the server sandbox here or elsewhere
    serverSandbox = await createForestServerSandbox(serverSandboxPort);

    // 2. START THE AGENT
    // DON'T FORGET TO SET THE SERVER URL when you starting your agent to reach the server sandbox.
    // The server URL is the URL of the server sandbox
    // Agent port is the port of the agent when you start it (it can be any port)

    // If you don't use a NodeJs agent, you can use the createForestAgentClient function to call the agent
    // You must manage the agent lifecycle yourself in this case
  });

  afterAll(async () => {
    await serverSandbox?.stop();
  });

  it('should return all the records of the billing collection', async () => {
    // create records in the database
    // ... or whatever you need to do before calling the agent

    const clientAgent = await createForestAgentClient({
      agentForestEnvSecret: 'ceba742f5bc73946b34da192816a4d7177b3233fee4769955c29c0e90fd584f2',
      agentForestAuthSecret: 'aeba742f5bc73946b34da192816a4d717723233fee7769955c29c0e90fd584f2',
      agentUrl: `http://127.0.0.1:${agentPort}`,
      serverUrl: `http://127.0.0.1:${serverSandboxPort}`,
      agentSchemaPath: 'schema-path/.forestadmin-schema.json',
    });

    // call the billing collection from the agent to get the records
    const billings = await clientAgent.collection('billing').list();

    // check the result
    expect(billings).toHaveLength(2);
  });
});
```

### Agent NodeJS Only - Without Forest Server Sandbox

For Node.js agents, you can simplify tests by creating a testable agent directly without the server sandbox.

```javascript
const { createTestableAgent } = require('@forestadmin-experimental/agent-nodejs-testing');

// customizations to apply to your agent
export function addAgentCustomizations(agent) {
  agent.addDataSource(createSequelizeDataSource(connection));
}

// setup and start a testable agent
export async function setupAndStartTestableAgent() {
  // if you have a database, or a server to start, do it here
  // ...

  // create a testable agent with the customizations
  const testableAgent = await createTestableAgent(addAgentCustomizations);

  // start the testable agent
  await testableAgent.start();

  return testableAgent;
}
```

Test example:

```javascript
describe('billing collection', () => {
  let testableAgent;

  beforeAll(async () => {
    testableAgent = await setupAndStartTestableAgent();
  });

  afterAll(async () => {
    await testableAgent?.stop();
  });

  it('should return all the records of the billing collection', async () => {
    // create records in the database
    // ...

    // call the billing collection from the agent to get the records
    const billings = await testableAgent.collection('billing').list();

    // check the result
    expect(billings).toHaveLength(2);
  });
});
```

### Examples

Please check the [example](./example) folder for more examples.

### How it works

The library provides a way to test an agent with a server sandbox.
The server sandbox is a fake server that simulates the behavior of the ForestAdmin server.
It allows you to test your agent in a sandbox.
