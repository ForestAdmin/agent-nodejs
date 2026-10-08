# 🚀 Quick Start Guide

## Installation & Build

```bash
# From monorepo root
cd /Users/slim/repos/agent-nodejs

# Install dependencies
yarn install

# Build the plugin
cd packages/plugin-schema-manager
yarn build

# Run tests
yarn test

# Run integration tests (requires Docker)
docker-compose -f docker-compose.test.yml up -d
yarn test:integration
docker-compose -f docker-compose.test.yml down
```

## Usage in Your Agent

### 1. Import the Plugin

```typescript
// src/index.ts
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { addSchemaManager } from '@forestadmin/plugin-schema-manager';

const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
});

agent
  .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
  .use(addSchemaManager, {
    restrictTo: ['admin'],
    dryRunMode: false,  // Set to true for testing
  })
  .start();
```

### 2. Available Actions

Once installed, these actions appear in Forest Admin:

- **Schema: Create Table**
- **Schema: Drop Table** ⚠️
- **Schema: Add Column**
- **Schema: Drop Column** ⚠️
- **Schema: Modify Column**
- **Schema: Create Index**
- **Schema: Drop Index**
- **Schema: Create Foreign Key**

### 3. Test in Dry-Run Mode

```typescript
.use(addSchemaManager, {
  dryRunMode: true,  // Only shows DDL, doesn't execute
})
```

### 4. Add Callbacks

```typescript
.use(addSchemaManager, {
  beforeSchemaChange: async (operation) => {
    console.log(`⚠️  About to execute: ${operation.type}`);
    return true;  // Return false to cancel
  },

  afterSchemaChange: async (operation) => {
    console.log(`✅ Completed: ${operation.type}`);
  },
})
```

## Examples

### Add a Column

1. Go to any collection in Forest Admin
2. Click "Actions" → "Schema: Add Column"
3. Fill form:
   - Column Name: `status`
   - Data Type: `STRING`
   - Allow Null: `false`
   - Default Value: `active`
4. Execute

Result: `ALTER TABLE "table_name" ADD COLUMN "status" VARCHAR(255) NOT NULL DEFAULT 'active';`

### Create an Index

1. Actions → "Schema: Create Index"
2. Fill form:
   - Columns: `email, created_at`
   - Unique: `true`
3. Execute

Result: `CREATE UNIQUE INDEX "idx_table_email_created_at" ON "table" ("email", "created_at");`

## Configuration Presets

### Development

```typescript
.use(addSchemaManager, {
  dryRunMode: true,
  enableTableDeletion: true,
  restrictTo: ['admin', 'developer'],
})
```

### Staging

```typescript
.use(addSchemaManager, {
  dryRunMode: false,
  enableTableDeletion: false,
  restrictTo: ['admin'],

  beforeSchemaChange: async (operation) => {
    await sendSlackNotification(operation);
    return true;
  },
})
```

### Production

```typescript
.use(addSchemaManager, {
  dryRunMode: false,
  enableTableDeletion: false,
  enableColumnDeletion: false,
  restrictTo: ['admin'],

  forbiddenTables: ['users', 'payments', 'sessions'],

  beforeSchemaChange: async (operation) => {
    // Require manual approval
    await sendSlackAlert(operation);

    // Log to audit
    await logToDatabase(operation);

    return true;
  },

  onError: async (error, operation) => {
    await sendPagerDutyAlert(error, operation);
  },
})
```

## Troubleshooting

### Actions don't appear

Check that your datasource has a nativeDriver:

```typescript
.customizeCollection('users', collection => {
  console.log('Native driver:', (collection as any).nativeDriver);
})
```

### Permission errors

```typescript
{
  restrictTo: ['admin', 'developer', 'editor'],  // Add your role
}
```

### Build errors

```bash
# Clean and rebuild
yarn clean
yarn build

# Check for TypeScript errors
yarn tsc --noEmit
```

## File Structure

```
plugin-schema-manager/
├── src/
│   ├── index.ts                 # Main plugin export
│   ├── types.ts                 # TypeScript interfaces
│   ├── executors/               # Database executors
│   ├── validators/              # Input validators
│   ├── actions/                 # Forest Admin actions
│   └── utils/                   # Helper functions
│
├── test/
│   ├── integration/             # Integration tests
│   └── executors/               # Unit tests
│
├── README.md                    # Full documentation
├── EXAMPLE.md                   # Detailed tutorial
├── QUICKSTART.md               # This file
└── docker-compose.test.yml     # Test databases
```

## Next Steps

1. **Read** [README.md](./README.md) for full documentation
2. **Try** [EXAMPLE.md](./EXAMPLE.md) for step-by-step tutorial
3. **Test** in development with `dryRunMode: true`
4. **Deploy** to staging/production

## Support

- 📚 [Forest Admin Docs](https://docs.forestadmin.com)
- 💬 [Community Forum](https://community.forestadmin.com)
- 🐛 [Issue Tracker](https://github.com/ForestAdmin/agent-nodejs/issues)

---

**Happy Schema Managing! 🛠️**
