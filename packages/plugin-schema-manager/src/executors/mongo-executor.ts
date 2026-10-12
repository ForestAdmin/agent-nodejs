/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Db, Collection as MongoCollection } from 'mongodb';
import { BaseSchemaExecutor } from './base-executor';
import {
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  SchemaOperation,
  SchemaOperationType,
  TableDefinition,
} from '../types';

export class MongoSchemaExecutor extends BaseSchemaExecutor {
  readonly dialect = 'mongodb';
  private db: Db;

  constructor(nativeDriver: any) {
    super();

    // Extract DB from different possible structures
    this.db = nativeDriver.db || nativeDriver.connection?.db || nativeDriver;

    if (!this.db || typeof this.db.createCollection !== 'function') {
      throw new Error('Invalid MongoDB instance in nativeDriver');
    }
  }

  protected override getSupportedOperations(): SchemaOperationType[] {
    return [
      'CREATE_TABLE', // Collection in MongoDB
      'DROP_TABLE',
      'RENAME_TABLE',
      'CREATE_INDEX',
      'DROP_INDEX',
      'LIST_TABLES',
      'DESCRIBE_TABLE',
      // MongoDB is schema-less, so no strict CREATE_COLUMN
      // But we can add/remove fields and validators
    ];
  }

  // ========== COLLECTIONS (equivalent to tables) ==========

  override async createTable(tableName: string, definition: TableDefinition): Promise<void> {
    const options: any = {};

    // If validation constraints are specified
    if (definition.columns && definition.columns.length > 0) {
      options.validator = this.buildValidator(definition.columns);
      options.validationLevel = 'moderate';
    }

    await this.db.createCollection(tableName, options);

    // Create indexes if specified
    if (definition.indexes) {
      for (const index of definition.indexes) {
        await this.createIndex(tableName, index);
      }
    }
  }

  override async dropTable(tableName: string): Promise<void> {
    const collection = this.db.collection(tableName);
    await collection.drop();
  }

  override async renameTable(oldName: string, newName: string): Promise<void> {
    const collection = this.db.collection(oldName);
    await collection.rename(newName);
  }

  override async listTables(): Promise<string[]> {
    const collections = await this.db.listCollections().toArray();
    return collections.map(c => c.name);
  }

  override async describeTable(tableName: string): Promise<TableDefinition> {
    const collection = this.db.collection(tableName);

    // Sample documents to infer schema
    const sample = await collection.find().limit(100).toArray();

    const fieldNames = new Set<string>();
    for (const doc of sample) {
      Object.keys(doc).forEach(key => fieldNames.add(key));
    }

    const columns: ColumnDefinition[] = Array.from(fieldNames).map(name => ({
      name,
      type: this.inferType(sample, name),
      allowNull: true, // MongoDB doesn't have strict NOT NULL
    }));

    // Get indexes
    const indexes = await this.listIndexes(tableName);

    return {
      name: tableName,
      columns,
      indexes,
    };
  }

  // ========== FIELDS (MongoDB is schema-less) ==========

  override async createColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    // MongoDB is schema-less, but we can add validation
    const collection = this.db.collection(tableName);

    const validator = {
      $jsonSchema: {
        properties: {
          [column.name]: this.buildFieldValidator(column),
        },
      },
    };

    await this.db.command({
      collMod: tableName,
      validator,
      validationLevel: 'moderate',
    });

    // If there's a default value, update existing documents
    if (column.defaultValue !== undefined) {
      await collection.updateMany(
        { [column.name]: { $exists: false } },
        { $set: { [column.name]: column.defaultValue } },
      );
    }
  }

  override async dropColumn(tableName: string, columnName: string): Promise<void> {
    // In MongoDB, "dropping" a field = removing it from all documents
    const collection = this.db.collection(tableName);

    await collection.updateMany({}, { $unset: { [columnName]: '' } });
  }

  override async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    const collection = this.db.collection(tableName);
    await collection.updateMany({}, { $rename: { [oldName]: newName } });
  }

  // ========== INDEXES ==========

  override async createIndex(tableName: string, index: IndexDefinition): Promise<void> {
    const collection = this.db.collection(tableName);

    const indexSpec: any = {};
    for (const col of index.columns) {
      indexSpec[col] = 1; // 1 = ascending, -1 = descending
    }

    const options: any = {
      unique: index.unique || false,
    };

    if (index.name) {
      options.name = index.name;
    }

    await collection.createIndex(indexSpec, options);
  }

  override async dropIndex(tableName: string, indexName: string): Promise<void> {
    const collection = this.db.collection(tableName);
    await collection.dropIndex(indexName);
  }

  override async listIndexes(tableName: string): Promise<IndexDefinition[]> {
    const collection = this.db.collection(tableName);
    const indexes = await collection.listIndexes().toArray();

    return indexes.map(idx => ({
      name: idx.name,
      columns: Object.keys(idx.key),
      unique: idx.unique || false,
    }));
  }

  // ========== NOT SUPPORTED ==========

  override async modifyColumn(): Promise<void> {
    throw new Error('modifyColumn not applicable for MongoDB (schema-less)');
  }

  override async createForeignKey(): Promise<void> {
    throw new Error('Foreign keys not supported in MongoDB');
  }

  override async dropForeignKey(): Promise<void> {
    throw new Error('Foreign keys not supported in MongoDB');
  }

  override async listForeignKeys(): Promise<ForeignKeyDefinition[]> {
    return [];
  }

  // ========== TYPE SUPPORT ==========

  override getSupportedTypes(): string[] {
    return [
      'string',
      'number',
      'int',
      'long',
      'double',
      'decimal',
      'boolean',
      'date',
      'timestamp',
      'object',
      'array',
      'objectId',
      'binary',
      'null',
    ];
  }

  // ========== HELPERS ==========

  private buildValidator(columns: ColumnDefinition[]): any {
    const properties: any = {};
    const required: string[] = [];

    for (const col of columns) {
      properties[col.name] = this.buildFieldValidator(col);
      if (!col.allowNull) {
        required.push(col.name);
      }
    }

    const schema: any = {
      bsonType: 'object',
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    return { $jsonSchema: schema };
  }

  private buildFieldValidator(column: ColumnDefinition): any {
    const validator: any = {
      bsonType: this.mapTypeToBSON(column.type),
    };

    if (column.comment) {
      validator.description = column.comment;
    }

    return validator;
  }

  private mapTypeToBSON(type: string): string | string[] {
    const typeLower = type.toLowerCase();
    const mapping: Record<string, string | string[]> = {
      string: 'string',
      number: ['int', 'long', 'double', 'decimal'],
      int: 'int',
      long: 'long',
      double: 'double',
      decimal: 'decimal',
      boolean: 'bool',
      date: 'date',
      timestamp: 'timestamp',
      object: 'object',
      array: 'array',
      objectid: 'objectId',
      binary: 'binData',
      null: 'null',
    };

    return mapping[typeLower] || 'string';
  }

  private inferType(documents: any[], fieldName: string): string {
    // Simple type inference logic
    for (const doc of documents) {
      if (doc[fieldName] !== undefined && doc[fieldName] !== null) {
        const value = doc[fieldName];
        const type = typeof value;

        if (type === 'string') return 'string';
        if (type === 'number') return Number.isInteger(value) ? 'int' : 'double';
        if (type === 'boolean') return 'boolean';
        if (value instanceof Date) return 'date';
        if (Array.isArray(value)) return 'array';
        if (type === 'object') {
          // Check if ObjectId
          if (value._bsontype === 'ObjectID' || value.constructor?.name === 'ObjectId') {
            return 'objectId';
          }
          return 'object';
        }
      }
    }
    return 'string'; // Fallback
  }

  // ========== DDL BUILDERS ==========

  override buildDDL(operation: SchemaOperation): string {
    // MongoDB doesn't have DDL, return equivalent command
    switch (operation.type) {
      case 'CREATE_TABLE':
        return `db.createCollection("${operation.collection}")`;
      case 'DROP_TABLE':
        return `db.${operation.collection}.drop()`;
      case 'RENAME_TABLE':
        return `db.${operation.collection}.renameCollection("${operation.details.newName}")`;
      case 'CREATE_INDEX':
        return this.buildMongoCreateIndexCommand(operation.collection, operation.details);
      case 'DROP_INDEX':
        return `db.${operation.collection}.dropIndex("${operation.details.indexName}")`;
      case 'DROP_COLUMN':
        return `db.${operation.collection}.updateMany({}, { $unset: { "${operation.details.columnName}": "" } })`;
      case 'RENAME_COLUMN':
        return `db.${operation.collection}.updateMany({}, { $rename: { "${operation.details.oldName}": "${operation.details.newName}" } })`;
      default:
        return `// MongoDB operation: ${operation.type}`;
    }
  }

  private buildMongoCreateIndexCommand(collection: string, details: any): string {
    const indexSpec = details.columns
      .map((col: string) => `"${col}": 1`)
      .join(', ');
    const unique = details.unique ? ', { unique: true }' : '';
    return `db.${collection}.createIndex({ ${indexSpec} }${unique})`;
  }

  protected override quoteIdentifier(identifier: string): string {
    // MongoDB doesn't need quoting in the same way
    return identifier;
  }
}
