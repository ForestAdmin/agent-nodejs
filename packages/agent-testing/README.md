# @forestadmin/agent-testing

Testing utilities for Forest Admin agents. This package enables you to write integration tests for your agent customizations (computed fields, actions, segments, hooks, etc.) without needing a running Forest Admin server.

## Installation

```bash
npm install --save-dev @forestadmin/agent-testing
# or
yarn add --dev @forestadmin/agent-testing
```

## Quick Start

Test your agent using `createForestServerSandbox` and `createForestAgentClient`:

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

## API Reference

### `createForestServerSandbox(port)`

Creates a sandbox server that mocks Forest Admin server.

**Parameters:**
- `port`: `number` - Port to run the sandbox server on

**Returns:** `Promise<ForestServerSandbox>`

```typescript
const sandbox = await createForestServerSandbox(3001);
// ... run tests
await sandbox.close();
```

### `createForestAgentClient(options)`

Creates a client to communicate with your agent.

**Parameters:**
- `agentUrl`: `string` - URL where your agent is running
- `serverUrl`: `string` - URL of the sandbox server
- `agentSchemaPath`: `string` - Path to `.forestadmin-schema.json`
- `agentForestEnvSecret`: `string` - Your agent's env secret
- `agentForestAuthSecret`: `string` - Your agent's auth secret

**Returns:** `Promise<ForestAgentClient>`

```typescript
const client = await createForestAgentClient({
  agentUrl: 'http://localhost:3310',
  serverUrl: 'http://localhost:3001',
  agentSchemaPath: './.forestadmin-schema.json',
  agentForestEnvSecret: 'your-env-secret',
  agentForestAuthSecret: 'your-auth-secret',
});
```

### Collection Methods

#### `collection(name)`
Returns a collection client for querying and testing.

```typescript
const collection = client.collection('users');
```

#### `list<T>(options?)`
Retrieves records from the collection.

```typescript
const users = await client.collection('users').list<{ id: number; name: string }>({
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
const users = await client.collection('users').search<{ name: string }>('John');
```

#### `count(options?)`
Counts records in the collection.

```typescript
const count = await client.collection('users').count({
  filters: { conditionTree: { field: 'active', operator: 'Equal', value: true } },
});
```

#### `create<T>(attributes)`
Creates a new record.

```typescript
const user = await client.collection('users').create<{ id: number }>({
  firstName: 'John',
  lastName: 'Doe',
});
```

#### `update<T>(id, attributes)`
Updates an existing record.

```typescript
await client.collection('users').update(userId, { firstName: 'Jane' });
```

#### `delete(ids)`
Deletes records by their IDs.

```typescript
await client.collection('users').delete([1, 2, 3]);
```

#### `segment(name)`
Accesses a named segment.

```typescript
const minorUsers = await client
  .collection('users')
  .segment('minorUsers')
  .list<{ age: number }>();
```

#### `liveQuerySegment(options)`
Accesses a live query segment.

```typescript
const users = await client
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
const orders = await client
  .collection('users')
  .relation('orders', userId)
  .list<{ total: number }>();
```

#### `exportCsv(stream, options?)`
Exports collection data to CSV.

```typescript
import { createWriteStream } from 'fs';

const stream = createWriteStream('export.csv');
await client.collection('users').exportCsv(stream, {
  projection: ['id', 'name', 'email'],
});
```

### Testing Actions

#### `action(name, context?)`
Retrieves an action form for testing.

```typescript
const action = await client
  .collection('restaurants')
  .action('Leave a review', { recordId: restaurantId });
// or for multiple records
const action = await client
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
const value = await client.chart('Total Revenue').getValue();
expect(value).toBe(50000);

// Objective chart
const objective = await client.chart('Monthly Goal').getObjective();
expect(objective.value).toBe(80);
expect(objective.objective).toBe(100);

// Distribution/Pie chart
const distribution = await client.chart('Users by Country').getDistribution();
expect(distribution).toEqual([
  { key: 'USA', value: 500 },
  { key: 'France', value: 300 },
]);

// Leaderboard chart
const leaderboard = await client.chart('Top Sellers').getLeaderboard();
expect(leaderboard).toEqual([
  { key: 'Product A', value: 1000 },
  { key: 'Product B', value: 800 },
]);

// Time-based chart
const timeSeries = await client.chart('Sales Over Time').getTimeBased();
expect(timeSeries).toEqual([
  { label: '2024-01', values: { value: 5000 } },
  { label: '2024-02', values: { value: 6000 } },
]);

// Percentage chart
const percentage = await client.chart('Completion Rate').getPercentage();
expect(percentage).toBe(75);
```

#### Collection Charts

```typescript
const chart = await client
  .collection('orders')
  .chart('Revenue by Status')
  .getDistribution();
```

### Permission Testing

Override permissions for testing authorization scenarios:

```typescript
// Override collection permissions
await client.overrideCollectionPermission('users', {
  browseEnabled: true,
  deleteEnabled: false,
  editEnabled: true,
});

// Override action permissions
await client.overrideActionPermission('users', 'Delete User', {
  triggerEnabled: false,
  approvalRequired: true,
});

// Clear all permission overrides
await client.clearPermissionOverride();
```

## Advanced Usage

### Benchmarking

The package includes utilities for performance testing:

```typescript
const benchmark = client.benchmark();

// Run your operations
const results = await benchmark.measure(async () => {
  await client.collection('users').list();
});

console.log(`Duration: ${results.duration}ms`);
```

## Complete Example

```typescript
import {
  createForestAgentClient,
  createForestServerSandbox,
  ForestServerSandbox,
  ForestAgentClient,
} from '@forestadmin/agent-testing';

describe('Restaurant Reviews', () => {
  let sandbox: ForestServerSandbox;
  let client: ForestAgentClient;

  beforeAll(async () => {
    // 1. Start the sandbox server
    sandbox = await createForestServerSandbox(3001);

    // 2. Start your agent (configured with FOREST_SERVER_URL=http://localhost:3001)
    //    This step depends on your agent setup

    // 3. Create the client
    client = await createForestAgentClient({
      agentUrl: 'http://localhost:3310',
      serverUrl: 'http://localhost:3001',
      agentSchemaPath: './.forestadmin-schema.json',
      agentForestEnvSecret: 'your-env-secret',
      agentForestAuthSecret: 'your-auth-secret',
    });
  });

  afterAll(async () => {
    await sandbox?.close();
    // Stop your agent here
  });

  it('should show comment field only for high ratings', async () => {
    const [restaurant] = await client.collection('restaurants').list<{ id: number }>();

    const action = await client
      .collection('restaurants')
      .action('Leave a review', { recordId: restaurant.id });

    // Comment field should not exist initially
    expect(action.doesFieldExist('comment')).toBe(false);

    // Fill rating with high value
    await action.getFieldNumber('rating').fill(5);

    // Comment field should now be visible
    expect(action.doesFieldExist('comment')).toBe(true);
  });

  it('should save review to database', async () => {
    const [restaurant] = await client.collection('restaurants').list<{ id: number }>();

    const action = await client
      .collection('restaurants')
      .action('Leave a review', { recordId: restaurant.id });

    await action.getFieldNumber('rating').fill(5);
    await action.getFieldString('comment').fill('Excellent!');
    await action.execute();

    const [updated] = await client
      .collection('restaurants')
      .list<{ rating: number; comment: string }>({
        filters: { conditionTree: { field: 'id', value: restaurant.id, operator: 'Equal' } },
      });

    expect(updated.rating).toBe(5);
    expect(updated.comment).toBe('Excellent!');
  });
});
```

## License

GPL-3.0
