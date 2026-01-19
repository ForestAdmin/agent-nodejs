# @forestadmin/agent-testing

Integration testing utilities for Forest Admin agents.

## Installation

```bash
npm install --save-dev @forestadmin/agent-testing
```

## Setup

### 1. Configure your agent

Your agent must accept a configurable `forestServerUrl`:

```typescript
// agent.ts
const agent = createAgent({
  envSecret: process.env.FOREST_ENV_SECRET,
  authSecret: process.env.FOREST_AUTH_SECRET,
  forestServerUrl: process.env.FOREST_SERVER_URL,
});
```

### 2. Write your test

```typescript
import {
  createAgentTestClient,
  createForestServerSandbox,
} from '@forestadmin/agent-testing';

describe('My Agent', () => {
  let sandbox, client;

  beforeAll(async () => {
    // Start sandbox (mocks Forest Admin server)
    sandbox = await createForestServerSandbox(3001);

    // Start your agent with FOREST_SERVER_URL=http://localhost:3001

    // Create test client
    client = await createAgentTestClient({
      agentUrl: 'http://localhost:3310',
      serverUrl: 'http://localhost:3001',
      agentSchemaPath: './.forestadmin-schema.json',
      agentForestEnvSecret: 'your-env-secret',
      agentForestAuthSecret: 'your-auth-secret',
    });
  });

  afterAll(async () => {
    await sandbox?.close();
  });

  it('should list records', async () => {
    const users = await client.collection('users').list();
    expect(users.length).toBeGreaterThan(0);
  });
});
```

## License

GPL-3.0
