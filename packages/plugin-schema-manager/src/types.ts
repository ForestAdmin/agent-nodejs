import { Caller } from '@forestadmin/datasource-toolkit';

// ========== OPTIONS ==========

export interface SchemaManagerOptions {
  // Security
  restrictTo?: Array<'admin' | 'developer' | 'editor' | 'user'>;
  requireConfirmation?: boolean;
  dryRunMode?: boolean;

  // Features
  enableTableCreation?: boolean;
  enableTableDeletion?: boolean;
  enableColumnModification?: boolean;
  enableColumnDeletion?: boolean;
  enableIndexManagement?: boolean;
  enableForeignKeyManagement?: boolean;

  // Restrictions
  allowedDatabases?: string[];
  forbiddenTables?: string[];
  forbiddenColumns?: string[];

  // Callbacks
  beforeSchemaChange?: (operation: SchemaOperation) => Promise<boolean>;
  afterSchemaChange?: (operation: SchemaOperation) => Promise<void>;
  onError?: (error: Error, operation: SchemaOperation) => Promise<void>;

  // Advanced
  enableMigrationTracking?: boolean;
  autoRefreshSchema?: boolean;
}

// ========== OPERATIONS ==========

export type SchemaOperationType =
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'RENAME_TABLE'
  | 'CREATE_COLUMN'
  | 'DROP_COLUMN'
  | 'MODIFY_COLUMN'
  | 'RENAME_COLUMN'
  | 'CREATE_INDEX'
  | 'DROP_INDEX'
  | 'CREATE_FOREIGN_KEY'
  | 'DROP_FOREIGN_KEY'
  | 'DESCRIBE_TABLE'
  | 'LIST_TABLES';

export interface SchemaOperation {
  type: SchemaOperationType;
  datasource: string;
  collection: string;
  timestamp: Date;
  caller: {
    id: number;
    email: string;
    permissionLevel: string;
  };
  details: Record<string, any>;
  dryRun: boolean;
}

// ========== SCHEMA DEFINITIONS ==========

export interface ColumnDefinition {
  name: string;
  type: string;
  allowNull: boolean;
  defaultValue?: any;
  autoIncrement?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  comment?: string;
}

export interface TableDefinition {
  name: string;
  schema?: string;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
}

export interface IndexDefinition {
  name?: string;
  columns: string[];
  unique?: boolean;
  type?: 'BTREE' | 'HASH' | 'GIST' | 'GIN' | 'FULLTEXT' | 'SPATIAL';
}

export interface ForeignKeyDefinition {
  name?: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT' | 'SET DEFAULT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT' | 'SET DEFAULT';
}

// ========== VALIDATION ==========

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// ========== EXECUTOR INTERFACE ==========

export interface SchemaExecutor {
  // Metadata
  readonly dialect: string;
  getSupportedTypes(): string[];
  supportsOperation(operation: SchemaOperationType): boolean;

  // Tables
  createTable(tableName: string, definition: TableDefinition): Promise<void>;
  dropTable(tableName: string): Promise<void>;
  renameTable(oldName: string, newName: string): Promise<void>;
  listTables(): Promise<string[]>;
  describeTable(tableName: string): Promise<TableDefinition>;

  // Columns
  createColumn(tableName: string, column: ColumnDefinition): Promise<void>;
  dropColumn(tableName: string, columnName: string): Promise<void>;
  modifyColumn(
    tableName: string,
    columnName: string,
    newDefinition: ColumnDefinition,
  ): Promise<void>;
  renameColumn(tableName: string, oldName: string, newName: string): Promise<void>;

  // Indexes
  createIndex(tableName: string, index: IndexDefinition): Promise<void>;
  dropIndex(tableName: string, indexName: string): Promise<void>;
  listIndexes(tableName: string): Promise<IndexDefinition[]>;

  // Foreign Keys
  createForeignKey(tableName: string, fk: ForeignKeyDefinition): Promise<void>;
  dropForeignKey(tableName: string, fkName: string): Promise<void>;
  listForeignKeys(tableName: string): Promise<ForeignKeyDefinition[]>;

  // DDL Preview
  buildDDL(operation: SchemaOperation): string;
}

// ========== MIGRATION TRACKING (optional) ==========

export interface MigrationRecord {
  id: string;
  operation: SchemaOperation;
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  ddl?: string;
  error?: string;
  executedAt?: Date;
  rollbackDDL?: string;
}
