import {
  SchemaExecutor,
  SchemaOperationType,
  TableDefinition,
  ColumnDefinition,
  IndexDefinition,
  ForeignKeyDefinition,
  SchemaOperation,
} from '../types';

export abstract class BaseSchemaExecutor implements SchemaExecutor {
  abstract readonly dialect: string;

  // ========== ABSTRACT METHODS (must be implemented) ==========

  abstract createTable(tableName: string, definition: TableDefinition): Promise<void>;
  abstract dropTable(tableName: string): Promise<void>;
  abstract createColumn(tableName: string, column: ColumnDefinition): Promise<void>;
  abstract dropColumn(tableName: string, columnName: string): Promise<void>;
  abstract listTables(): Promise<string[]>;
  abstract describeTable(tableName: string): Promise<TableDefinition>;
  abstract getSupportedTypes(): string[];

  // ========== OPTIONAL OPERATIONS (default: not supported) ==========

  async renameTable(oldName: string, newName: string): Promise<void> {
    throw new Error(`renameTable not supported for ${this.dialect}`);
  }

  async modifyColumn(
    tableName: string,
    columnName: string,
    newDef: ColumnDefinition,
  ): Promise<void> {
    throw new Error(`modifyColumn not supported for ${this.dialect}`);
  }

  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    throw new Error(`renameColumn not supported for ${this.dialect}`);
  }

  async createIndex(tableName: string, index: IndexDefinition): Promise<void> {
    throw new Error(`createIndex not supported for ${this.dialect}`);
  }

  async dropIndex(tableName: string, indexName: string): Promise<void> {
    throw new Error(`dropIndex not supported for ${this.dialect}`);
  }

  async listIndexes(tableName: string): Promise<IndexDefinition[]> {
    throw new Error(`listIndexes not supported for ${this.dialect}`);
  }

  async createForeignKey(tableName: string, fk: ForeignKeyDefinition): Promise<void> {
    throw new Error(`createForeignKey not supported for ${this.dialect}`);
  }

  async dropForeignKey(tableName: string, fkName: string): Promise<void> {
    throw new Error(`dropForeignKey not supported for ${this.dialect}`);
  }

  async listForeignKeys(tableName: string): Promise<ForeignKeyDefinition[]> {
    throw new Error(`listForeignKeys not supported for ${this.dialect}`);
  }

  // ========== SUPPORT DETECTION ==========

  supportsOperation(operation: SchemaOperationType): boolean {
    const supported = this.getSupportedOperations();
    return supported.includes(operation);
  }

  protected getSupportedOperations(): SchemaOperationType[] {
    // Override in subclasses for better control
    return [
      'CREATE_TABLE',
      'DROP_TABLE',
      'CREATE_COLUMN',
      'DROP_COLUMN',
      'LIST_TABLES',
      'DESCRIBE_TABLE',
    ];
  }

  // ========== DDL PREVIEW ==========

  buildDDL(operation: SchemaOperation): string {
    // Basic implementation - can be overridden
    switch (operation.type) {
      case 'CREATE_TABLE':
        return this.buildCreateTableDDL(operation.details);
      case 'DROP_TABLE':
        return `DROP TABLE ${this.quoteIdentifier(operation.collection)}`;
      case 'CREATE_COLUMN':
        return this.buildCreateColumnDDL(operation.collection, operation.details);
      case 'DROP_COLUMN':
        return `ALTER TABLE ${this.quoteIdentifier(operation.collection)} DROP COLUMN ${this.quoteIdentifier(operation.details.columnName)}`;
      case 'CREATE_INDEX':
        return this.buildCreateIndexDDL(operation.collection, operation.details);
      default:
        return `-- DDL preview not implemented for ${operation.type}`;
    }
  }

  protected buildCreateTableDDL(details: any): string {
    return `CREATE TABLE ${this.quoteIdentifier(details.tableName)} (...)`;
  }

  protected buildCreateColumnDDL(tableName: string, details: any): string {
    const { columnName, type, allowNull, defaultValue } = details;
    let ddl = `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD COLUMN ${this.quoteIdentifier(columnName)} ${type}`;

    if (!allowNull) {
      ddl += ' NOT NULL';
    }

    if (defaultValue !== undefined && defaultValue !== null) {
      ddl += ` DEFAULT ${this.formatValue(defaultValue)}`;
    }

    return ddl;
  }

  protected buildCreateIndexDDL(tableName: string, details: any): string {
    const indexName = details.indexName || `idx_${tableName}_${details.columns.join('_')}`;
    const unique = details.unique ? 'UNIQUE ' : '';
    const columns = details.columns.map((c: string) => this.quoteIdentifier(c)).join(', ');
    return `CREATE ${unique}INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(tableName)} (${columns})`;
  }

  // ========== UTILITIES ==========

  protected quoteIdentifier(identifier: string): string {
    // Default SQL quoting - override for specific dialects
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  protected formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    return String(value);
  }
}
