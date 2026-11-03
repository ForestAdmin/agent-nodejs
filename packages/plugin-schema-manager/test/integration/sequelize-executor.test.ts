import { Sequelize } from 'sequelize';
import { SequelizeSchemaExecutor } from '../../src/executors/sequelize-executor';

describe('SequelizeSchemaExecutor - Integration Tests', () => {
  let sequelize: Sequelize;
  let executor: SequelizeSchemaExecutor;

  beforeAll(async () => {
    // Use environment variables or defaults
    const dbUrl =
      process.env.TEST_POSTGRES_URL ||
      'postgres://test:test@localhost:5433/test_schema_manager';

    sequelize = new Sequelize(dbUrl, {
      logging: false,
    });

    await sequelize.authenticate();

    executor = new SequelizeSchemaExecutor({ sequelize });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up test tables
    const tables = await executor.listTables();
    for (const table of tables) {
      if (table.startsWith('test_')) {
        try {
          await executor.dropTable(table);
        } catch {
          // Ignore errors
        }
      }
    }
  });

  describe('Table Operations', () => {
    it('should create a table', async () => {
      const tableName = 'test_users';

      await executor.createTable(tableName, {
        name: tableName,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          {
            name: 'email',
            type: 'STRING',
            allowNull: false,
            unique: true,
          },
          {
            name: 'created_at',
            type: 'DATE',
            allowNull: true,
          },
        ],
      });

      const tables = await executor.listTables();
      expect(tables).toContain(tableName);

      const description = await executor.describeTable(tableName);
      expect(description.columns).toHaveLength(3);
      expect(description.columns.find(c => c.name === 'email')).toBeDefined();
    });

    it('should drop a table', async () => {
      const tableName = 'test_to_drop';

      await executor.createTable(tableName, {
        name: tableName,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            primaryKey: true,
            allowNull: false,
          },
        ],
      });

      await executor.dropTable(tableName);

      const tables = await executor.listTables();
      expect(tables).not.toContain(tableName);
    });

    it('should rename a table', async () => {
      const oldName = 'test_old_name';
      const newName = 'test_new_name';

      await executor.createTable(oldName, {
        name: oldName,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            primaryKey: true,
            allowNull: false,
          },
        ],
      });

      await executor.renameTable(oldName, newName);

      const tables = await executor.listTables();
      expect(tables).not.toContain(oldName);
      expect(tables).toContain(newName);

      // Clean up
      await executor.dropTable(newName);
    });
  });

  describe('Column Operations', () => {
    const tableName = 'test_columns';

    beforeEach(async () => {
      await executor.createTable(tableName, {
        name: tableName,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
        ],
      });
    });

    it('should add a column', async () => {
      await executor.createColumn(tableName, {
        name: 'username',
        type: 'STRING',
        allowNull: false,
      });

      const description = await executor.describeTable(tableName);
      const column = description.columns.find(c => c.name === 'username');

      expect(column).toBeDefined();
      expect(column?.type).toBe('STRING');
      expect(column?.allowNull).toBe(false);
    });

    it('should add a column with default value', async () => {
      await executor.createColumn(tableName, {
        name: 'status',
        type: 'STRING',
        allowNull: false,
        defaultValue: 'active',
      });

      const description = await executor.describeTable(tableName);
      const column = description.columns.find(c => c.name === 'status');

      expect(column).toBeDefined();
      expect(column?.defaultValue).toBeDefined();
    });

    it('should drop a column', async () => {
      await executor.createColumn(tableName, {
        name: 'to_drop',
        type: 'STRING',
        allowNull: true,
      });

      await executor.dropColumn(tableName, 'to_drop');

      const description = await executor.describeTable(tableName);
      const column = description.columns.find(c => c.name === 'to_drop');

      expect(column).toBeUndefined();
    });

    it('should modify a column', async () => {
      await executor.createColumn(tableName, {
        name: 'age',
        type: 'INTEGER',
        allowNull: true,
      });

      await executor.modifyColumn(tableName, 'age', {
        name: 'age',
        type: 'BIGINT',
        allowNull: false,
      });

      const description = await executor.describeTable(tableName);
      const column = description.columns.find(c => c.name === 'age');

      expect(column).toBeDefined();
      expect(column?.type).toBe('BIGINT');
    });

    it('should rename a column', async () => {
      await executor.createColumn(tableName, {
        name: 'old_name',
        type: 'STRING',
        allowNull: true,
      });

      await executor.renameColumn(tableName, 'old_name', 'new_name');

      const description = await executor.describeTable(tableName);
      const oldColumn = description.columns.find(c => c.name === 'old_name');
      const newColumn = description.columns.find(c => c.name === 'new_name');

      expect(oldColumn).toBeUndefined();
      expect(newColumn).toBeDefined();
    });
  });

  describe('Index Operations', () => {
    const tableName = 'test_indexes';

    beforeEach(async () => {
      await executor.createTable(tableName, {
        name: tableName,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          {
            name: 'email',
            type: 'STRING',
            allowNull: false,
          },
          {
            name: 'username',
            type: 'STRING',
            allowNull: false,
          },
        ],
      });
    });

    it('should create an index', async () => {
      await executor.createIndex(tableName, {
        name: 'idx_email',
        columns: ['email'],
        unique: true,
      });

      const indexes = await executor.listIndexes(tableName);
      const emailIndex = indexes.find(idx => idx.name === 'idx_email');

      expect(emailIndex).toBeDefined();
      expect(emailIndex?.columns).toContain('email');
      expect(emailIndex?.unique).toBe(true);
    });

    it('should create a composite index', async () => {
      await executor.createIndex(tableName, {
        name: 'idx_email_username',
        columns: ['email', 'username'],
        unique: false,
      });

      const indexes = await executor.listIndexes(tableName);
      const compositeIndex = indexes.find(idx => idx.name === 'idx_email_username');

      expect(compositeIndex).toBeDefined();
      expect(compositeIndex?.columns).toHaveLength(2);
    });

    it('should drop an index', async () => {
      await executor.createIndex(tableName, {
        name: 'idx_to_drop',
        columns: ['email'],
      });

      await executor.dropIndex(tableName, 'idx_to_drop');

      const indexes = await executor.listIndexes(tableName);
      const droppedIndex = indexes.find(idx => idx.name === 'idx_to_drop');

      expect(droppedIndex).toBeUndefined();
    });
  });

  describe('Foreign Key Operations', () => {
    const usersTable = 'test_fk_users';
    const postsTable = 'test_fk_posts';

    beforeEach(async () => {
      // Create users table
      await executor.createTable(usersTable, {
        name: usersTable,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          {
            name: 'email',
            type: 'STRING',
            allowNull: false,
          },
        ],
      });

      // Create posts table
      await executor.createTable(postsTable, {
        name: postsTable,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          {
            name: 'user_id',
            type: 'INTEGER',
            allowNull: false,
          },
          {
            name: 'title',
            type: 'STRING',
            allowNull: false,
          },
        ],
      });
    });

    afterEach(async () => {
      try {
        await executor.dropTable(postsTable);
        await executor.dropTable(usersTable);
      } catch {
        // Ignore
      }
    });

    it('should create a foreign key', async () => {
      await executor.createForeignKey(postsTable, {
        name: 'fk_posts_user_id',
        columns: ['user_id'],
        referencedTable: usersTable,
        referencedColumns: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      });

      // Verify FK was created (this is dialect-specific)
      const fks = await executor.listForeignKeys(postsTable);
      const userFk = fks.find(fk => fk.name === 'fk_posts_user_id');

      expect(userFk).toBeDefined();
    });
  });

  describe('DDL Generation', () => {
    it('should generate CREATE TABLE DDL', () => {
      const operation: any = {
        type: 'CREATE_TABLE',
        collection: 'test_table',
        details: {
          tableName: 'test_table',
          columns: [
            {
              name: 'id',
              type: 'INTEGER',
              primaryKey: true,
              allowNull: false,
            },
            {
              name: 'name',
              type: 'STRING',
              allowNull: false,
            },
          ],
        },
      };

      const ddl = executor.buildDDL(operation);

      expect(ddl).toContain('CREATE TABLE');
      expect(ddl).toContain('test_table');
      expect(ddl).toContain('id');
      expect(ddl).toContain('name');
    });

    it('should generate CREATE COLUMN DDL', () => {
      const operation: any = {
        type: 'CREATE_COLUMN',
        collection: 'test_table',
        details: {
          columnName: 'email',
          type: 'STRING',
          allowNull: false,
          defaultValue: 'unknown',
        },
      };

      const ddl = executor.buildDDL(operation);

      expect(ddl).toContain('ALTER TABLE');
      expect(ddl).toContain('ADD COLUMN');
      expect(ddl).toContain('email');
      expect(ddl).toContain('NOT NULL');
      expect(ddl).toContain('DEFAULT');
    });
  });
});
