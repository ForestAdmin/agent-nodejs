# Example Usage

## Complete Example with All Features

```typescript
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { addSchemaManager } from '@forestadmin/plugin-schema-manager';

// Initialize Forest Admin Agent
const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
  loggerLevel: 'Info',
});

// Add your datasource
agent.addDataSource(
  createSqlDataSource({
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'user',
    password: 'pass',
  })
);

// Add Schema Manager with full configuration
agent.use(addSchemaManager, {
  // Security
  restrictTo: ['admin'],
  requireConfirmation: true,
  dryRunMode: false,

  // Features
  enableTableCreation: true,
  enableTableDeletion: false,        // Disabled for safety
  enableColumnModification: true,
  enableColumnDeletion: true,
  enableIndexManagement: true,
  enableForeignKeyManagement: true,

  // Restrictions
  forbiddenTables: ['users', 'sessions', 'migrations'],
  forbiddenColumns: ['id', 'created_at', 'updated_at'],

  // Callbacks
  beforeSchemaChange: async (operation) => {
    console.log(`⚠️  Schema change requested:`, {
      type: operation.type,
      collection: operation.collection,
      caller: operation.caller.email,
      timestamp: operation.timestamp,
    });

    // Send Slack notification
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🛠️ Schema Change by ${operation.caller.email}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Operation:* ${operation.type}\n*Collection:* ${operation.collection}\n*Caller:* ${operation.caller.email}`,
              },
            },
          ],
        }),
      });
    }

    // Always allow (return false to block)
    return true;
  },

  afterSchemaChange: async (operation) => {
    console.log(`✅ Schema change completed:`, operation.type);

    // Log to audit table
    const { createSqlDataSource } = await import('@forestadmin/datasource-sql');
    // Log audit...
  },

  onError: async (error, operation) => {
    console.error(`❌ Schema change failed:`, {
      error: error.message,
      operation: operation.type,
      collection: operation.collection,
    });

    // Send error notification
    if (process.env.SENTRY_DSN) {
      // Report to Sentry...
    }
  },
});

// Start the agent
await agent.start();

console.log('🌲 Forest Admin Agent started with Schema Manager enabled');
```

## Step-by-Step Tutorial

### 1. Add a Column

Go to any collection → Actions → "Schema: Add Column"

```
Column Name: phone_number
Data Type: STRING
Allow Null: true
Default Value: (empty)
Comment: User's phone number
Unique: false
```

Result: `ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(255) NULL;`

### 2. Create an Index

Actions → "Schema: Create Index"

```
Index Name: (leave empty for auto-generated)
Columns: email, status
Unique: true
Index Type: BTREE
```

Result: `CREATE UNIQUE INDEX "idx_users_email_status" ON "users" ("email", "status");`

### 3. Add Foreign Key

Actions → "Schema: Create Foreign Key"

```
FK Name: (leave empty)
Columns: user_id
Referenced Table: users
Referenced Columns: id
On Delete: CASCADE
On Update: NO ACTION
```

Result: `ALTER TABLE "posts" ADD CONSTRAINT "fk_posts_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;`

### 4. Create a Table

Actions → "Schema: Create Table"

```
Table Name: analytics_events
Columns (JSON):
[
  {
    "name": "id",
    "type": "UUID",
    "primaryKey": true,
    "allowNull": false
  },
  {
    "name": "event_name",
    "type": "STRING",
    "allowNull": false
  },
  {
    "name": "user_id",
    "type": "INTEGER",
    "allowNull": true
  },
  {
    "name": "metadata",
    "type": "JSON",
    "allowNull": true
  },
  {
    "name": "created_at",
    "type": "DATE",
    "allowNull": false,
    "defaultValue": "NOW()"
  }
]
```

Result: Complete CREATE TABLE statement with all columns

### 5. Dry-Run Mode (Test First!)

Set `dryRunMode: true` in config:

```typescript
.use(addSchemaManager, {
  dryRunMode: true,  // Only preview, don't execute
})
```

Now when you execute any action, you'll see:

```
DRY RUN - The following DDL would be executed:

ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(255) NULL;

No changes were made.
```

Perfect for testing before making real changes!

## Real-World Scenarios

### Scenario 1: Add Audit Columns to All Tables

```typescript
// Custom script using the executor directly
import { SequelizeSchemaExecutor } from '@forestadmin/plugin-schema-manager';

const executor = new SequelizeSchemaExecutor({ sequelize });
const tables = await executor.listTables();

for (const table of tables) {
  // Add created_at if doesn't exist
  const desc = await executor.describeTable(table);
  if (!desc.columns.find(c => c.name === 'created_at')) {
    await executor.createColumn(table, {
      name: 'created_at',
      type: 'DATE',
      allowNull: true,
      defaultValue: 'NOW()',
    });
  }

  // Add updated_at if doesn't exist
  if (!desc.columns.find(c => c.name === 'updated_at')) {
    await executor.createColumn(table, {
      name: 'updated_at',
      type: 'DATE',
      allowNull: true,
      defaultValue: 'NOW()',
    });
  }
}
```

### Scenario 2: Environment-Specific Config

```typescript
const schemaManagerConfig = {
  // Development: Full access, dry-run
  development: {
    restrictTo: ['admin', 'developer'],
    dryRunMode: true,
    enableTableDeletion: true,
  },

  // Staging: Restricted, real changes
  staging: {
    restrictTo: ['admin'],
    dryRunMode: false,
    enableTableDeletion: false,
  },

  // Production: Admin-only, very restricted
  production: {
    restrictTo: ['admin'],
    dryRunMode: false,
    enableTableDeletion: false,
    enableColumnDeletion: false,
    forbiddenTables: ['users', 'orders', 'payments'],
  },
};

agent.use(
  addSchemaManager,
  schemaManagerConfig[process.env.NODE_ENV || 'development']
);
```

### Scenario 3: Migration from Legacy Schema

```typescript
// Gradually add missing constraints

// 1. Add NOT NULL constraints
await executor.modifyColumn('users', 'email', {
  name: 'email',
  type: 'STRING',
  allowNull: false,  // Was true before
});

// 2. Add unique indexes
await executor.createIndex('users', {
  name: 'idx_users_email_unique',
  columns: ['email'],
  unique: true,
});

// 3. Add foreign keys for referential integrity
await executor.createForeignKey('posts', {
  name: 'fk_posts_user_id',
  columns: ['user_id'],
  referencedTable: 'users',
  referencedColumns: ['id'],
  onDelete: 'CASCADE',
});
```

## Tips & Best Practices

### ✅ DO

- **Always test in development first** with `dryRunMode: true`
- **Backup your database** before making schema changes
- **Use callbacks** to log all operations
- **Restrict to admin role** in production
- **Disable table deletion** unless absolutely needed
- **Use forbidden lists** for critical tables
- **Test type conversions** on sample data first

### ❌ DON'T

- Don't drop tables without multiple backups
- Don't change column types without understanding data impact
- Don't allow schema changes in production without approval process
- Don't forget to test foreign key constraints
- Don't ignore warnings about unsafe type conversions

## Monitoring & Auditing

### Log All Changes

```typescript
beforeSchemaChange: async (operation) => {
  await db.query(`
    INSERT INTO schema_audit_log (
      operation_type,
      collection,
      details,
      caller_email,
      timestamp
    ) VALUES ($1, $2, $3, $4, $5)
  `, [
    operation.type,
    operation.collection,
    JSON.stringify(operation.details),
    operation.caller.email,
    operation.timestamp,
  ]);

  return true;
},
```

### Alert on Critical Changes

```typescript
beforeSchemaChange: async (operation) => {
  const criticalOps = ['DROP_TABLE', 'DROP_COLUMN'];

  if (criticalOps.includes(operation.type)) {
    // Send PagerDuty alert
    await sendPagerDutyAlert({
      severity: 'critical',
      message: `CRITICAL: ${operation.type} on ${operation.collection}`,
      caller: operation.caller.email,
    });

    // Require manual approval
    if (process.env.NODE_ENV === 'production') {
      const approved = await promptForApproval();
      return approved;
    }
  }

  return true;
},
```

## Troubleshooting

### Issue: Actions not appearing

**Solution**: Check nativeDriver availability

```typescript
// Debug: Check if nativeDriver is present
.customizeCollection('users', collection => {
  console.log('Native driver:', (collection as any).nativeDriver);
})
```

### Issue: Permission denied

**Solution**: Adjust `restrictTo` setting

```typescript
{
  restrictTo: ['admin', 'developer'],  // Add your role here
}
```

### Issue: Type conversion fails

**Solution**: Check type compatibility first

```typescript
const typeValidator = new TypeValidator();
const result = typeValidator.validateTypeChange('TEXT', 'INTEGER');
console.log(result.warnings);  // Shows potential issues
```

## Advanced Usage

### Programmatic Schema Changes

```typescript
import { ExecutorFactory } from '@forestadmin/plugin-schema-manager';

// Get executor for a collection
const collection = dataSource.getCollection('users');
const executor = ExecutorFactory.create(collection.nativeDriver);

// Make changes programmatically
await executor.createColumn('users', {
  name: 'new_column',
  type: 'STRING',
  allowNull: true,
});

// Get DDL preview
const operation = {
  type: 'CREATE_COLUMN',
  collection: 'users',
  details: { columnName: 'new_column', type: 'STRING' },
};
const ddl = executor.buildDDL(operation);
console.log(ddl);
```

---

For more information, see the [main README](./README.md).
