# @forestadmin/plugin-schema-manager

> 🛠️ Live schema management plugin for Forest Admin Agent

This plugin adds DDL (Data Definition Language) operations directly to your Forest Admin interface, allowing you to modify your database schema in real-time without writing SQL.

## ⚠️ Warning

This plugin performs **dangerous operations** that can cause data loss. Use with caution:

- ✅ **Recommended**: Use in development/staging environments
- ⚠️ **Caution**: Use in production with dry-run mode first
- 🔒 **Always**: Backup your data before making schema changes

## Features

- ✅ **Create tables** with columns, indexes, and foreign keys
- ✅ **Add columns** with types, defaults, and constraints
- ✅ **Drop columns** (with confirmation)
- ✅ **Modify columns** (change type, nullable, default)
- ✅ **Rename columns**
- ✅ **Create indexes** (simple and composite, unique)
- ✅ **Drop indexes**
- ✅ **Create foreign keys** with cascading options
- ✅ **Drop foreign keys**
- ✅ **Drop tables** (with double confirmation)
- ✅ **Dry-run mode** to preview DDL without executing
- ✅ **Permission-based restrictions** (admin/developer only)
- ✅ **Multi-database support**: PostgreSQL, MySQL, SQLite, MariaDB, MongoDB

## Installation

```bash
npm install @forestadmin/plugin-schema-manager
# or
yarn add @forestadmin/plugin-schema-manager
```

## Quick Start

```typescript
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';
import { addSchemaManager } from '@forestadmin/plugin-schema-manager';

createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
})
  .addDataSource(createSqlDataSource(process.env.DATABASE_URL))

  // Add Schema Manager to all collections
  .use(addSchemaManager, {
    restrictTo: ['admin'],           // Only admins can use it
    dryRunMode: false,                // Set to true to preview DDL only
    enableTableDeletion: false,       // Disable DROP TABLE for safety
  })

  .start();
```

## Configuration Options

```typescript
interface SchemaManagerOptions {
  // Security
  restrictTo?: Array<'admin' | 'developer' | 'editor' | 'user'>;
  requireConfirmation?: boolean;
  dryRunMode?: boolean;

  // Features (enable/disable operations)
  enableTableCreation?: boolean;
  enableTableDeletion?: boolean;      // ⚠️ Dangerous
  enableColumnModification?: boolean;
  enableColumnDeletion?: boolean;
  enableIndexManagement?: boolean;
  enableForeignKeyManagement?: boolean;

  // Restrictions
  allowedDatabases?: string[];
  forbiddenTables?: string[];         // Tables that cannot be modified
  forbiddenColumns?: string[];        // Columns that cannot be modified

  // Callbacks
  beforeSchemaChange?: (operation: SchemaOperation) => Promise<boolean>;
  afterSchemaChange?: (operation: SchemaOperation) => Promise<void>;
  onError?: (error: Error, operation: SchemaOperation) => Promise<void>;

  // Advanced
  autoRefreshSchema?: boolean;
}
```

### Default Options

```typescript
{
  restrictTo: ['admin', 'developer'],
  requireConfirmation: true,
  dryRunMode: false,
  enableTableCreation: true,
  enableTableDeletion: false,        // Disabled by default for safety
  enableColumnModification: true,
  enableColumnDeletion: true,
  enableIndexManagement: true,
  enableForeignKeyManagement: true,
  autoRefreshSchema: false,
}
```

## Usage Examples

### Basic Setup (All Collections)

```typescript
.use(addSchemaManager, {
  restrictTo: ['admin'],
  dryRunMode: false,
})
```

### Dry-Run Mode (Preview Only)

```typescript
.use(addSchemaManager, {
  dryRunMode: true,  // Only shows DDL, doesn't execute
})
```

### Specific Collection Only

```typescript
.customizeCollection('users', users => {
  // Schema manager actions will only appear on 'users' collection
})
.use(addSchemaManager)
```

### With Callbacks

```typescript
.use(addSchemaManager, {
  beforeSchemaChange: async (operation) => {
    console.log(`⚠️  About to execute: ${operation.type} on ${operation.collection}`);

    // Send Slack notification
    await sendSlackNotification({
      text: `Schema change by ${operation.caller.email}: ${operation.type}`,
    });

    // Return false to cancel the operation
    return true;
  },

  afterSchemaChange: async (operation) => {
    console.log(`✅ Successfully executed: ${operation.type}`);

    // Log to audit table
    await logAuditEvent(operation);
  },

  onError: async (error, operation) => {
    console.error(`❌ Failed: ${error.message}`);

    // Alert on-call engineer
    await sendPagerDutyAlert(error, operation);
  },
})
```

### Protected Tables

```typescript
.use(addSchemaManager, {
  forbiddenTables: ['users', 'permissions', 'sessions'],
  forbiddenColumns: ['id', 'created_at', 'updated_at'],
})
```

## Available Actions

Once installed, the following actions appear in your Forest Admin collections:

### Table Operations
- **Schema: Create Table** - Create a new table with columns
- **Schema: Drop Table** - ⚠️ Delete a table (requires confirmation)

### Column Operations
- **Schema: Add Column** - Add a new column to existing table
- **Schema: Drop Column** - Remove a column (requires confirmation)
- **Schema: Modify Column** - Change column type, nullable, default
- **Schema: Rename Column** - Rename an existing column

### Index Operations
- **Schema: Create Index** - Create index (simple or composite, unique)
- **Schema: Drop Index** - Remove an index

### Foreign Key Operations
- **Schema: Create Foreign Key** - Add foreign key constraint
- **Schema: Drop Foreign Key** - Remove foreign key constraint

## How It Works

### 1. Create a Column (Example)

1. Go to any collection in Forest Admin
2. Click "Actions" → "Schema: Add Column"
3. Fill in the form:
   - Column Name: `phone_number`
   - Data Type: `STRING`
   - Allow Null: `true`
   - Default Value: (empty)
4. Click "Execute"
5. ✅ Column is created instantly

### 2. Dry-Run Mode (Preview DDL)

If `dryRunMode: true`:

```
DRY RUN - The following DDL would be executed:

ALTER TABLE "users" ADD COLUMN "phone_number" VARCHAR(255) NULL;

No changes were made.
```

### 3. Type Safety

The plugin validates:
- ✅ Identifier names (no SQL injection)
- ✅ Data types (must be supported by database)
- ✅ Default values (must match column type)
- ✅ Foreign key references (table must exist)
- ✅ Permissions (caller must have required role)

## Supported Databases

| Database   | Tables | Columns | Indexes | Foreign Keys |
|------------|--------|---------|---------|--------------|
| PostgreSQL | ✅     | ✅      | ✅      | ✅           |
| MySQL      | ✅     | ✅      | ✅      | ✅           |
| MariaDB    | ✅     | ✅      | ✅      | ✅           |
| SQLite     | ✅     | ✅      | ✅      | ⚠️ Limited   |
| MongoDB    | ✅     | ⚠️ Schema-less | ✅ | ❌  |

## Data Types

### SQL Databases (Sequelize)

```
STRING, TEXT, CHAR
INTEGER, BIGINT
FLOAT, REAL, DOUBLE, DECIMAL
BOOLEAN
DATE, DATEONLY, TIME
UUID
JSON, JSONB
BLOB
ENUM
```

### MongoDB

```
string, number, int, long, double, decimal
boolean
date, timestamp
object, array
objectId
binary
null
```

## Security

### Permission Levels

By default, only `admin` and `developer` roles can use schema management actions. Configure with `restrictTo`:

```typescript
{
  restrictTo: ['admin'],  // Only admins
}
```

### SQL Injection Protection

All identifiers are validated and properly quoted:

```typescript
// ❌ Rejected
"user'; DROP TABLE users--"

// ✅ Accepted
"user_id"
```

### Confirmation Steps

Dangerous operations require explicit confirmation:

- **Drop Column**: Type "DELETE"
- **Drop Table**: Type "DELETE" + confirm backup checkbox

## Testing

```bash
# Start test databases
docker-compose -f docker-compose.test.yml up -d

# Run tests
npm test

# Run integration tests
npm run test:integration

# Stop test databases
docker-compose -f docker-compose.test.yml down
```

## Troubleshooting

### Actions don't appear

1. Check that `nativeDriver` is available on your datasource
2. Verify your datasource type is supported (SQL/MongoDB)
3. Check console for warnings during plugin initialization

### Permission errors

```typescript
{
  restrictTo: ['admin', 'developer'],  // Add more roles if needed
}
```

### Type conversion warnings

The plugin warns about potentially unsafe type conversions:

```
⚠️  Type change from TEXT to VARCHAR may truncate long text
⚠️  Consider backing up data before this conversion
```

Always test in non-production first!

## Roadmap

- [ ] Schema diff between environments
- [ ] Migration history tracking
- [ ] Rollback support
- [ ] Visual schema designer
- [ ] Import/export schema as JSON
- [ ] Schema templates (audit tables, etc.)
- [ ] Bulk operations

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md).

## License

GPL-3.0

## Support

- 📚 [Documentation](https://docs.forestadmin.com)
- 💬 [Community Forum](https://community.forestadmin.com)
- 🐛 [Issue Tracker](https://github.com/ForestAdmin/agent-nodejs/issues)

---

**Made with ❤️ by Forest Admin**
