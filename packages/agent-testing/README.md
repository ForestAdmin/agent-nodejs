# @forestadmin/agent-testing

Testing utilities for Forest Admin agents. Test your customizations (actions, hooks, segments, charts) locally without connecting to Forest Admin servers.

## Installation

```bash
npm install --save-dev @forestadmin/agent-testing
```

## Quick Start

```typescript
import {
  createAgentTestClient,
  createForestServerSandbox,
} from '@forestadmin/agent-testing';

describe('My Agent', () => {
  let sandbox, client;

  beforeAll(async () => {
    // 1. Start a local sandbox that replaces Forest Admin servers
    sandbox = await createForestServerSandbox(3001);

    // 2. Start your agent pointing to the sandbox
    // FOREST_SERVER_URL=http://localhost:3001 node your-agent.js

    // 3. Connect the test client
    client = await createAgentTestClient({
      serverUrl: 'http://localhost:3001',
      agentUrl: 'http://localhost:3310',
      agentSchemaPath: './.forestadmin-schema.json',
      agentForestEnvSecret: process.env.FOREST_ENV_SECRET,
      agentForestAuthSecret: process.env.FOREST_AUTH_SECRET,
    });
  });

  afterAll(async () => {
    await sandbox?.close();
  });

  it('should list users', async () => {
    const users = await client.collection('users').list();
    expect(users.length).toBeGreaterThan(0);
  });
});
```

## License

GPL-3.0
