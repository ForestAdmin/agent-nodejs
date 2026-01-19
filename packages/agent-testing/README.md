# @forestadmin/agent-testing

Testing utilities for Forest Admin agents. Write integration tests for your agent customizations (actions, computed fields, segments, hooks) without needing a running Forest Admin server.

## Installation

```bash
npm install --save-dev @forestadmin/agent-testing
```

## Setup

### 1. Configure your agent for testing

Your agent must accept a configurable `forestServerUrl`:

```typescript
// agent.ts
import { createAgent } from '@forestadmin/agent';

const agent = createAgent({
  envSecret: process.env.FOREST_ENV_SECRET,
  authSecret: process.env.FOREST_AUTH_SECRET,
  forestServerUrl: process.env.FOREST_SERVER_URL, // Use sandbox URL in tests
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

  it('should execute an action', async () => {
    const action = await client
      .collection('users')
      .action('My Action', { recordId: 1 });

    await action.getFieldString('comment').fill('Hello');
    await action.execute();
  });
});
```

## API

### Collection operations

```typescript
// List
const users = await client.collection('users').list();

// Search
const users = await client.collection('users').search('john');

// Count
const count = await client.collection('users').count();

// Create
const user = await client.collection('users').create({ name: 'John' });

// Update
await client.collection('users').update(1, { name: 'Jane' });

// Delete
await client.collection('users').delete([1, 2]);

// Segment
const users = await client.collection('users').segment('active').list();

// Relation
const orders = await client.collection('users').relation('orders', 1).list();
```

### Actions

```typescript
const action = await client
  .collection('users')
  .action('My Action', { recordId: 1 });

// Fill fields
await action.getFieldString('name').fill('John');
await action.getFieldNumber('age').fill(25);
await action.getFieldJson('metadata').fill({ key: 'value' });

// Enum/Radio/Checkbox
await action.getEnumField('status').select('active');
await action.getRadioGroupField('confirm').check('Yes');
await action.getCheckboxGroupField('options').check('Option A');

// Execute
await action.execute();
```

### Charts

```typescript
// Dashboard chart
const value = await client.chart('Total Revenue').getValue();

// Collection chart
const data = await client.collection('orders').chart('By Status').getDistribution();
```

## License

GPL-3.0
