import { MongoClient, Db } from 'mongodb';
import { MongoSchemaExecutor } from '../../src/executors/mongo-executor';

describe('MongoSchemaExecutor - Integration Tests', () => {
  let client: MongoClient;
  let db: Db;
  let executor: MongoSchemaExecutor;

  beforeAll(async () => {
    const mongoUrl =
      process.env.TEST_MONGO_URL || 'mongodb://localhost:27018/test_schema_manager';

    client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db();

    executor = new MongoSchemaExecutor({ db });
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    // Clean up test collections
    const collections = await db.listCollections().toArray();
    for (const coll of collections) {
      if (coll.name.startsWith('test_')) {
        await db.collection(coll.name).drop();
      }
    }
  });

  describe('Collection Operations', () => {
    it('should create a collection', async () => {
      const collectionName = 'test_users';

      await executor.createTable(collectionName, {
        name: collectionName,
        columns: [
          {
            name: 'email',
            type: 'string',
            allowNull: false,
          },
          {
            name: 'age',
            type: 'number',
            allowNull: true,
          },
        ],
      });

      const collections = await executor.listTables();
      expect(collections).toContain(collectionName);
    });

    it('should drop a collection', async () => {
      const collectionName = 'test_to_drop';

      await db.createCollection(collectionName);
      await executor.dropTable(collectionName);

      const collections = await executor.listTables();
      expect(collections).not.toContain(collectionName);
    });

    it('should rename a collection', async () => {
      const oldName = 'test_old';
      const newName = 'test_new';

      await db.createCollection(oldName);
      await executor.renameTable(oldName, newName);

      const collections = await executor.listTables();
      expect(collections).not.toContain(oldName);
      expect(collections).toContain(newName);

      // Clean up
      await db.collection(newName).drop();
    });

    it('should describe a collection', async () => {
      const collectionName = 'test_describe';

      // Create collection with documents
      const collection = await db.createCollection(collectionName);
      await collection.insertMany([
        { name: 'Alice', age: 30, email: 'alice@example.com' },
        { name: 'Bob', age: 25, active: true },
      ]);

      const description = await executor.describeTable(collectionName);

      expect(description.name).toBe(collectionName);
      expect(description.columns.length).toBeGreaterThan(0);
      expect(description.columns.find(c => c.name === 'name')).toBeDefined();
      expect(description.columns.find(c => c.name === 'age')).toBeDefined();
    });
  });

  describe('Field Operations', () => {
    const collectionName = 'test_fields';

    beforeEach(async () => {
      await db.createCollection(collectionName);
    });

    it('should add a field with default value', async () => {
      const collection = db.collection(collectionName);
      await collection.insertOne({ name: 'Test' });

      await executor.createColumn(collectionName, {
        name: 'status',
        type: 'string',
        allowNull: true,
        defaultValue: 'active',
      });

      // Verify default value was set
      const doc = await collection.findOne({ name: 'Test' });
      expect(doc?.status).toBe('active');
    });

    it('should drop a field (unset)', async () => {
      const collection = db.collection(collectionName);
      await collection.insertOne({ name: 'Test', oldField: 'value' });

      await executor.dropColumn(collectionName, 'oldField');

      const doc = await collection.findOne({ name: 'Test' });
      expect(doc?.oldField).toBeUndefined();
    });

    it('should rename a field', async () => {
      const collection = db.collection(collectionName);
      await collection.insertOne({ oldName: 'value' });

      await executor.renameColumn(collectionName, 'oldName', 'newName');

      const doc = await collection.findOne({});
      expect(doc?.oldName).toBeUndefined();
      expect(doc?.newName).toBe('value');
    });
  });

  describe('Index Operations', () => {
    const collectionName = 'test_indexes';

    beforeEach(async () => {
      await db.createCollection(collectionName);
    });

    it('should create a simple index', async () => {
      await executor.createIndex(collectionName, {
        name: 'idx_email',
        columns: ['email'],
        unique: true,
      });

      const indexes = await executor.listIndexes(collectionName);
      const emailIndex = indexes.find(idx => idx.name === 'idx_email');

      expect(emailIndex).toBeDefined();
      expect(emailIndex?.unique).toBe(true);
    });

    it('should create a composite index', async () => {
      await executor.createIndex(collectionName, {
        name: 'idx_compound',
        columns: ['email', 'status'],
        unique: false,
      });

      const indexes = await executor.listIndexes(collectionName);
      const compoundIndex = indexes.find(idx => idx.name === 'idx_compound');

      expect(compoundIndex).toBeDefined();
      expect(compoundIndex?.columns).toContain('email');
      expect(compoundIndex?.columns).toContain('status');
    });

    it('should drop an index', async () => {
      await executor.createIndex(collectionName, {
        name: 'idx_to_drop',
        columns: ['field'],
      });

      await executor.dropIndex(collectionName, 'idx_to_drop');

      const indexes = await executor.listIndexes(collectionName);
      const droppedIndex = indexes.find(idx => idx.name === 'idx_to_drop');

      expect(droppedIndex).toBeUndefined();
    });
  });

  describe('Type Inference', () => {
    it('should infer field types from documents', async () => {
      const collectionName = 'test_types';
      const collection = await db.createCollection(collectionName);

      await collection.insertMany([
        {
          stringField: 'text',
          numberField: 42,
          booleanField: true,
          dateField: new Date(),
          arrayField: [1, 2, 3],
          objectField: { nested: 'value' },
        },
      ]);

      const description = await executor.describeTable(collectionName);

      expect(description.columns.find(c => c.name === 'stringField')?.type).toBe('string');
      expect(description.columns.find(c => c.name === 'numberField')?.type).toBe('int');
      expect(description.columns.find(c => c.name === 'booleanField')?.type).toBe('boolean');
      expect(description.columns.find(c => c.name === 'dateField')?.type).toBe('date');
      expect(description.columns.find(c => c.name === 'arrayField')?.type).toBe('array');
      expect(description.columns.find(c => c.name === 'objectField')?.type).toBe('object');
    });
  });

  describe('DDL Generation', () => {
    it('should generate MongoDB commands', () => {
      const createOp: any = {
        type: 'CREATE_TABLE',
        collection: 'users',
        details: {},
      };

      const ddl = executor.buildDDL(createOp);
      expect(ddl).toContain('db.createCollection("users")');
    });

    it('should generate index command', () => {
      const indexOp: any = {
        type: 'CREATE_INDEX',
        collection: 'users',
        details: {
          columns: ['email', 'status'],
          unique: true,
        },
      };

      const ddl = executor.buildDDL(indexOp);
      expect(ddl).toContain('db.users.createIndex');
      expect(ddl).toContain('unique: true');
    });
  });

  describe('Unsupported Operations', () => {
    it('should throw on foreign key operations', async () => {
      await expect(
        executor.createForeignKey('test', {
          name: 'fk_test',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        }),
      ).rejects.toThrow('Foreign keys not supported');
    });

    it('should throw on modify column', async () => {
      await expect(
        executor.modifyColumn('test', 'field', {
          name: 'field',
          type: 'string',
          allowNull: true,
        }),
      ).rejects.toThrow('not applicable');
    });
  });
});
