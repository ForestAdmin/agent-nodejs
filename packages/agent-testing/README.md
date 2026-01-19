# @forestadmin/agent-testing

Testing utilities for Forest Admin agents. This package enables you to write integration tests for your agent customizations (computed fields, actions, segments, hooks, etc.) without needing a running Forest Admin server.

## Installation

```bash
npm install --save-dev @forestadmin/agent-testing
# or
yarn add --dev @forestadmin/agent-testing
```

## Testing Modes

This package provides two approaches for testing your agent:

| Mode | Use Case | Recommended |
|------|----------|-------------|
| **Sandbox Mode** | Production-like testing with a mock Forest Admin server | ✅ Yes |
| **Simple Mode** | Quick tests with internal mocking | For simple cases |

**Sandbox mode is recommended** because it:
- Tests your agent in conditions closer to production (agent ↔ server communication)
- Supports permission testing with realistic server responses
- Works with any agent (Node.js, Python, Ruby, etc.)

## Quick Start (Sandbox Mode - Recommended)

The recommended way to test your agent is using the sandbox mode with `createForestServerSandbox` and `createForestAgentClient`:

```typescript
import {
  createForestAgentClient,
  createForestServerSandbox,
  ForestServerSandbox,
  ForestAgentClient,
} from '@forestadmin/agent-testing';

describe('My Agent Tests', () => {
  let sandbox: ForestServerSandbox;
  let client: ForestAgentClient;

  beforeAll(async () => {
    // 1. Start the sandbox server (mocks Forest Admin server)
    sandbox = await createForestServerSandbox(3001);

    // 2. Start your agent configured to connect to the sandbox
    //    (your agent should use FOREST_SERVER_URL=http://localhost:3001)

    // 3. Create client to communicate with your agent
    client = await createForestAgentClient({
      agentUrl: 'http://localhost:3310',              // Your agent URL
      serverUrl: 'http://localhost:3001',             // Sandbox server URL
      agentSchemaPath: './.forestadmin-schema.json',  // Path to schema file
      agentForestEnvSecret: 'your-env-secret',
      agentForestAuthSecret: 'your-auth-secret',
    });
  });

  afterAll(async () => {
    await sandbox?.close();
    // Stop your agent here if needed
  });

  it('should list users', async () => {
    const users = await client.collection('users').list<{ fullName: string }>();
    expect(users.length).toBeGreaterThan(0);
  });

  it('should test permissions', async () => {
    // Override permissions for testing
    await client.overrideCollectionPermission('users', {
      browseEnabled: false,
    });

    // Test that browsing is denied
    await expect(client.collection('users').list()).rejects.toThrow();

    // Reset permissions
    await client.clearPermissionOverride();
  });
});
```

### Agent Configuration for Sandbox Mode

Your agent must be configured to connect to the sandbox server:

```typescript
// agent.ts
import { createAgent } from '@forestadmin/agent';

const agent = createAgent({
  envSecret: process.env.FOREST_ENV_SECRET,
  authSecret: process.env.FOREST_AUTH_SECRET,
  forestServerUrl: process.env.FOREST_SERVER_URL, // Point to sandbox in tests
  // ... other options
});
```

When running tests, set `FOREST_SERVER_URL` to your sandbox URL (e.g., `http://localhost:3001`).

## Simple Mode (Alternative)

For quick tests without setting up a separate agent process, use `createTestableAgent`:

```typescript
import { Agent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { createTestableAgent, TestableAgent } from '@forestadmin/agent-testing';

describe('My Agent Tests', () => {
  let testableAgent: TestableAgent;

  beforeAll(async () => {
    testableAgent = await createTestableAgent((agent: Agent) => {
      // Add your datasource
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: ':memory:' }));

      // Add your customizations
      agent.customizeCollection('users', collection => {
        collection.addField('fullName', {
          columnType: 'String',
          dependencies: ['firstName', 'lastName'],
          getValues: records => records.map(r => `${r.firstName} ${r.lastName}`),
        });
      });
    });

    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
  });

  it('should compute fullName correctly', async () => {
    const [user] = await testableAgent.collection('users').list<{ fullName: string }>();
    expect(user.fullName).toEqual('John Doe');
  });
});
```

> **Note:** Simple mode uses internal mocking and doesn't test the full agent-server communication. Use sandbox mode for more realistic testing.

## API Reference

### `createTestableAgent(customizer, options?)`

Creates a testable agent instance with your customizations.

**Parameters:**
- `customizer`: `(agent: Agent) => void` - Function to configure your agent
- `options?`: `TestableAgentOptions` - Optional configuration

**Returns:** `Promise<TestableAgent>`

```typescript
const testableAgent = await createTestableAgent(
  (agent) => {
    agent.addDataSource(myDataSource);
    agent.customizeCollection('users', collection => { /* ... */ });
  },
  {
    port: 3000,        // Optional: specific port (default: random)
    envSecret: '...',  // Optional: custom env secret
    authSecret: '...', // Optional: custom auth secret
  }
);
```

### TestableAgent Methods

#### `start()`
Starts the agent server. Must be called before running tests.

```typescript
await testableAgent.start();
```

#### `stop()`
Stops the agent server and cleans up resources.

```typescript
await testableAgent.stop();
```

#### `collection(name)`
Returns a collection client for querying and testing.

```typescript
const collection = testableAgent.collection('users');
```

### Collection Methods

#### `list<T>(options?)`
Retrieves records from the collection.

```typescript
const users = await testableAgent.collection('users').list<{ id: number; name: string }>({
  filters: {
    conditionTree: { field: 'age', operator: 'GreaterThan', value: 18 },
  },
  sort: [{ field: 'name', ascending: true }],
  page: { limit: 10, skip: 0 },
});
```

#### `search<T>(content)`
Searches records in the collection.

```typescript
const users = await testableAgent.collection('users').search<{ name: string }>('John');
```

#### `count(options?)`
Counts records in the collection.

```typescript
const count = await testableAgent.collection('users').count({
  filters: { conditionTree: { field: 'active', operator: 'Equal', value: true } },
});
```

#### `create<T>(attributes)`
Creates a new record.

```typescript
const user = await testableAgent.collection('users').create<{ id: number }>({
  firstName: 'John',
  lastName: 'Doe',
});
```

#### `update<T>(id, attributes)`
Updates an existing record.

```typescript
await testableAgent.collection('users').update(userId, { firstName: 'Jane' });
```

#### `delete(ids)`
Deletes records by their IDs.

```typescript
await testableAgent.collection('users').delete([1, 2, 3]);
```

#### `segment(name)`
Accesses a named segment.

```typescript
const minorUsers = await testableAgent
  .collection('users')
  .segment('minorUsers')
  .list<{ age: number }>();
```

#### `liveQuerySegment(options)`
Accesses a live query segment.

```typescript
const users = await testableAgent
  .collection('users')
  .liveQuerySegment({
    connectionName: 'main',
    query: 'SELECT * FROM users WHERE age < 18',
  })
  .list<{ age: number }>();
```

#### `relation(name, parentId)`
Accesses a relation from a parent record.

```typescript
const orders = await testableAgent
  .collection('users')
  .relation('orders', userId)
  .list<{ total: number }>();
```

#### `exportCsv(stream, options?)`
Exports collection data to CSV.

```typescript
import { createWriteStream } from 'fs';

const stream = createWriteStream('export.csv');
await testableAgent.collection('users').exportCsv(stream, {
  projection: ['id', 'name', 'email'],
});
```

### Testing Actions

#### `action(name, context?)`
Retrieves an action form for testing.

```typescript
const action = await testableAgent
  .collection('restaurants')
  .action('Leave a review', { recordId: restaurantId });
// or for multiple records
const action = await testableAgent
  .collection('restaurants')
  .action('Bulk action', { recordIds: [1, 2, 3] });
```

#### Action Field Methods

```typescript
// Get typed field accessors
const ratingField = action.getFieldNumber('rating');
const commentField = action.getFieldString('comment');
const metadataField = action.getFieldJson('metadata');
const enumField = action.getEnumField('status');
const radioField = action.getRadioGroupField('recommend');
const checkboxField = action.getCheckboxGroupField('features');

// Fill field values
await ratingField.fill(5);
await commentField.fill('Great service!');
await metadataField.fill({ key: 'value' });

// Enum fields
await enumField.select('option1');
expect(enumField.getOptions()).toEqual(['option1', 'option2']);

// Radio group fields
await radioField.check('Yes');
expect(radioField.getValue()).toEqual('yes');

// Checkbox group fields
await checkboxField.check('Feature A');
await checkboxField.check('Feature B');
await checkboxField.uncheck('Feature A');
expect(checkboxField.getValue()).toEqual(['featureB']);

// Check field properties
expect(ratingField.getValue()).toBe(5);
expect(ratingField.isRequired()).toBe(true);
expect(action.doesFieldExist('conditionalField')).toBe(false);
```

#### Action Layout Testing

```typescript
const layout = action.getLayout();

// Navigate pages
expect(layout.page(0).nextButtonLabel).toBe('Next');
expect(layout.page(0).previousButtonLabel).toBe('Back');

// Check layout elements
expect(layout.page(0).element(0).isSeparator()).toBe(true);
expect(layout.page(0).element(1).isHTMLBlock()).toBe(true);
expect(layout.page(0).element(1).getHtmlBlockContent()).toBe('<h1>Welcome</h1>');

// Check row layouts
expect(layout.page(0).element(2).isRow()).toBe(true);
expect(layout.page(0).element(2).rowElement(0).getInputId()).toBe('fieldName');
```

#### Execute Action

```typescript
await action.execute();
```

### Testing Charts

#### Dashboard Charts

```typescript
// Value chart
const value = await testableAgent.chart('Total Revenue').getValue();
expect(value).toBe(50000);

// Objective chart
const objective = await testableAgent.chart('Monthly Goal').getObjective();
expect(objective.value).toBe(80);
expect(objective.objective).toBe(100);

// Distribution/Pie chart
const distribution = await testableAgent.chart('Users by Country').getDistribution();
expect(distribution).toEqual([
  { key: 'USA', value: 500 },
  { key: 'France', value: 300 },
]);

// Leaderboard chart
const leaderboard = await testableAgent.chart('Top Sellers').getLeaderboard();
expect(leaderboard).toEqual([
  { key: 'Product A', value: 1000 },
  { key: 'Product B', value: 800 },
]);

// Time-based chart
const timeSeries = await testableAgent.chart('Sales Over Time').getTimeBased();
expect(timeSeries).toEqual([
  { label: '2024-01', values: { value: 5000 } },
  { label: '2024-02', values: { value: 6000 } },
]);

// Percentage chart
const percentage = await testableAgent.chart('Completion Rate').getPercentage();
expect(percentage).toBe(75);
```

#### Collection Charts

```typescript
const chart = await testableAgent
  .collection('orders')
  .chart('Revenue by Status')
  .getDistribution();
```

### Permission Testing

Override permissions for testing authorization scenarios:

```typescript
// Override collection permissions
await testableAgent.overrideCollectionPermission('users', {
  browseEnabled: true,
  deleteEnabled: false,
  editEnabled: true,
});

// Override action permissions
await testableAgent.overrideActionPermission('users', 'Delete User', {
  triggerEnabled: false,
  approvalRequired: true,
});

// Clear all permission overrides
await testableAgent.clearPermissionOverride();
```

## Advanced Usage

### Benchmarking

The package includes utilities for performance testing:

```typescript
const benchmark = testableAgent.benchmark();

// Run your operations
const results = await benchmark.measure(async () => {
  await testableAgent.collection('users').list();
});

console.log(`Duration: ${results.duration}ms`);
```

## Complete Example

```typescript
import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';
import { createTestableAgent, TestableAgent } from '@forestadmin/agent-testing';

describe('Restaurant Reviews', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  let restaurantId: number;

  beforeAll(async () => {
    // Setup database
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage: ':memory:' });
    sequelize.define('restaurants', {
      name: { type: DataTypes.STRING },
      rating: { type: DataTypes.INTEGER },
      comment: { type: DataTypes.STRING },
    });
    await sequelize.sync({ force: true });

    // Create testable agent with customizations
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage: ':memory:' }));

      agent.customizeCollection('restaurants', collection => {
        collection.addAction('Leave a review', {
          scope: 'Single',
          form: [
            { label: 'rating', type: 'Number', isRequired: true },
            {
              label: 'comment',
              type: 'String',
              if: ctx => Number(ctx.formValues.rating) >= 4,
            },
          ],
          execute: async (context) => {
            const { id } = await context.getRecord(['id']);
            await context.dataSource.getCollection('restaurants').update(
              { conditionTree: { field: 'id', operator: 'Equal', value: id } },
              {
                rating: context.formValues.rating,
                comment: context.formValues.comment,
              },
            );
          },
        });
      });
    });

    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  beforeEach(async () => {
    const restaurant = await sequelize.models.restaurants.create({ name: 'Test Restaurant' });
    restaurantId = restaurant.dataValues.id;
  });

  it('should show comment field only for high ratings', async () => {
    const action = await testableAgent
      .collection('restaurants')
      .action('Leave a review', { recordId: restaurantId });

    // Comment field should not exist initially
    expect(action.doesFieldExist('comment')).toBe(false);

    // Fill rating with high value
    await action.getFieldNumber('rating').fill(5);

    // Comment field should now be visible
    expect(action.doesFieldExist('comment')).toBe(true);
  });

  it('should save review to database', async () => {
    const action = await testableAgent
      .collection('restaurants')
      .action('Leave a review', { recordId: restaurantId });

    await action.getFieldNumber('rating').fill(5);
    await action.getFieldString('comment').fill('Excellent!');
    await action.execute();

    const [restaurant] = await testableAgent
      .collection('restaurants')
      .list<{ rating: number; comment: string }>({
        filters: { conditionTree: { field: 'id', value: restaurantId, operator: 'Equal' } },
      });

    expect(restaurant.rating).toBe(5);
    expect(restaurant.comment).toBe('Excellent!');
  });
});
```

## License

GPL-3.0
