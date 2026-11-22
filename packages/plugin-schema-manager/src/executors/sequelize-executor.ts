/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataTypes, QueryInterface, Sequelize } from 'sequelize';
import { BaseSchemaExecutor } from './base-executor';
import {
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  SchemaOperation,
  SchemaOperationType,
  TableDefinition,
} from '../types';

export class SequelizeSchemaExecutor extends BaseSchemaExecutor {
  readonly dialect: string;
  private sequelize: Sequelize;
  private queryInterface: QueryInterface;

  constructor(nativeDriver: any) {
    super();

    // Extract Sequelize instance from different possible structures
    this.sequelize =
      nativeDriver.sequelize || nativeDriver.model?.sequelize || nativeDriver;

    if (!this.sequelize || typeof this.sequelize.getQueryInterface !== 'function') {
      throw new Error('Invalid Sequelize instance in nativeDriver');
    }

    this.queryInterface = this.sequelize.getQueryInterface();
    this.dialect = this.sequelize.getDialect();
  }

  protected override getSupportedOperations(): SchemaOperationType[] {
    return [
      'CREATE_TABLE',
      'DROP_TABLE',
      'RENAME_TABLE',
      'CREATE_COLUMN',
      'DROP_COLUMN',
      'MODIFY_COLUMN',
      'RENAME_COLUMN',
      'CREATE_INDEX',
      'DROP_INDEX',
      'CREATE_FOREIGN_KEY',
      'DROP_FOREIGN_KEY',
      'LIST_TABLES',
      'DESCRIBE_TABLE',
    ];
  }

  // ========== TABLES ==========

  override async createTable(tableName: string, definition: TableDefinition): Promise<void> {
    const attributes = this.buildAttributesFromColumns(definition.columns);

    await this.queryInterface.createTable(tableName, attributes);

    // Create indexes if specified
    if (definition.indexes) {
      for (const index of definition.indexes) {
        await this.createIndex(tableName, index);
      }
    }

    // Create foreign keys if specified
    if (definition.foreignKeys) {
      for (const fk of definition.foreignKeys) {
        await this.createForeignKey(tableName, fk);
      }
    }
  }

  override async dropTable(tableName: string): Promise<void> {
    await this.queryInterface.dropTable(tableName);
  }

  override async renameTable(oldName: string, newName: string): Promise<void> {
    await this.queryInterface.renameTable(oldName, newName);
  }

  override async listTables(): Promise<string[]> {
    const tables = await this.queryInterface.showAllTables();
    return tables as string[];
  }

  override async describeTable(tableName: string): Promise<TableDefinition> {
    const description = await this.queryInterface.describeTable(tableName);

    const columns: ColumnDefinition[] = Object.entries(description).map(
      ([name, spec]: [string, any]) => ({
        name,
        type: this.reverseMapType(spec.type),
        allowNull: spec.allowNull ?? true,
        defaultValue: spec.defaultValue,
        autoIncrement: spec.autoIncrement || false,
        primaryKey: spec.primaryKey || false,
        unique: spec.unique || false,
        comment: spec.comment,
      }),
    );

    return {
      name: tableName,
      columns,
    };
  }

  // ========== COLUMNS ==========

  override async createColumn(tableName: string, column: ColumnDefinition): Promise<void> {
    const columnSpec = {
      type: this.mapType(column.type),
      allowNull: column.allowNull,
      defaultValue: column.defaultValue,
      autoIncrement: column.autoIncrement || false,
      primaryKey: column.primaryKey || false,
      unique: column.unique || false,
      comment: column.comment,
    };

    await this.queryInterface.addColumn(tableName, column.name, columnSpec);
  }

  override async dropColumn(tableName: string, columnName: string): Promise<void> {
    await this.queryInterface.removeColumn(tableName, columnName);
  }

  override async modifyColumn(
    tableName: string,
    columnName: string,
    newDef: ColumnDefinition,
  ): Promise<void> {
    const columnSpec = {
      type: this.mapType(newDef.type),
      allowNull: newDef.allowNull,
      defaultValue: newDef.defaultValue,
      comment: newDef.comment,
    };

    await this.queryInterface.changeColumn(tableName, columnName, columnSpec);
  }

  override async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    await this.queryInterface.renameColumn(tableName, oldName, newName);
  }

  // ========== INDEXES ==========

  override async createIndex(tableName: string, index: IndexDefinition): Promise<void> {
    const options: any = {
      fields: index.columns,
      unique: index.unique || false,
    };

    if (index.name) {
      options.name = index.name;
    }

    if (index.type) {
      options.type = index.type;
    }

    await this.queryInterface.addIndex(tableName, options);
  }

  override async dropIndex(tableName: string, indexName: string): Promise<void> {
    await this.queryInterface.removeIndex(tableName, indexName);
  }

  override async listIndexes(tableName: string): Promise<IndexDefinition[]> {
    const indexes = await this.queryInterface.showIndex(tableName);

    // Group by index name (composite indexes)
    const indexMap = new Map<string, IndexDefinition>();

    for (const idx of indexes as any[]) {
      const name = idx.name;
      if (!indexMap.has(name)) {
        indexMap.set(name, {
          name,
          columns: [],
          unique: idx.unique || false,
        });
      }
      indexMap.get(name)!.columns.push(idx.column_name);
    }

    return Array.from(indexMap.values());
  }

  // ========== FOREIGN KEYS ==========

  override async createForeignKey(tableName: string, fk: ForeignKeyDefinition): Promise<void> {
    const constraintName = fk.name || `fk_${tableName}_${fk.columns.join('_')}`;

    await this.queryInterface.addConstraint(tableName, {
      type: 'foreign key',
      name: constraintName,
      fields: fk.columns,
      references: {
        table: fk.referencedTable,
        field: fk.referencedColumns[0],
      },
      onDelete: fk.onDelete || 'NO ACTION',
      onUpdate: fk.onUpdate || 'NO ACTION',
    });
  }

  override async dropForeignKey(tableName: string, fkName: string): Promise<void> {
    await this.queryInterface.removeConstraint(tableName, fkName);
  }

  override async listForeignKeys(tableName: string): Promise<ForeignKeyDefinition[]> {
    // This is dialect-specific and Sequelize doesn't have a universal method
    // We'll implement a basic version using raw queries
    try {
      let query: string;

      switch (this.dialect) {
        case 'postgres':
          query = `
            SELECT
              tc.constraint_name as name,
              kcu.column_name,
              ccu.table_name AS referenced_table,
              ccu.column_name AS referenced_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = :tableName
          `;
          break;

        case 'mysql':
        case 'mariadb':
          query = `
            SELECT
              CONSTRAINT_NAME as name,
              COLUMN_NAME as column_name,
              REFERENCED_TABLE_NAME as referenced_table,
              REFERENCED_COLUMN_NAME as referenced_column
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = :tableName
              AND REFERENCED_TABLE_NAME IS NOT NULL
              AND TABLE_SCHEMA = DATABASE()
          `;
          break;

        default:
          return [];
      }

      const results = await this.sequelize.query(query, {
        replacements: { tableName },
        type: 'SELECT' as any,
      });

      // Group by constraint name
      const fkMap = new Map<string, ForeignKeyDefinition>();

      for (const row of results as any[]) {
        const name = row.name;
        if (!fkMap.has(name)) {
          fkMap.set(name, {
            name,
            columns: [],
            referencedTable: row.referenced_table,
            referencedColumns: [],
          });
        }
        fkMap.get(name)!.columns.push(row.column_name);
        fkMap.get(name)!.referencedColumns.push(row.referenced_column);
      }

      return Array.from(fkMap.values());
    } catch (error) {
      // Fallback: return empty array
      return [];
    }
  }

  // ========== TYPE MAPPING ==========

  override getSupportedTypes(): string[] {
    return [
      'STRING',
      'TEXT',
      'CHAR',
      'INTEGER',
      'BIGINT',
      'FLOAT',
      'REAL',
      'DOUBLE',
      'DECIMAL',
      'BOOLEAN',
      'DATE',
      'DATEONLY',
      'TIME',
      'UUID',
      'JSON',
      'JSONB',
      'BLOB',
      'ENUM',
    ];
  }

  private mapType(type: string): any {
    const typeUpper = type.toUpperCase();
    const mapping: Record<string, any> = {
      STRING: DataTypes.STRING,
      TEXT: DataTypes.TEXT,
      CHAR: DataTypes.CHAR,
      INTEGER: DataTypes.INTEGER,
      BIGINT: DataTypes.BIGINT,
      FLOAT: DataTypes.FLOAT,
      REAL: DataTypes.REAL,
      DOUBLE: DataTypes.DOUBLE,
      DECIMAL: DataTypes.DECIMAL,
      BOOLEAN: DataTypes.BOOLEAN,
      DATE: DataTypes.DATE,
      DATEONLY: DataTypes.DATEONLY,
      TIME: DataTypes.TIME,
      UUID: DataTypes.UUID,
      JSON: DataTypes.JSON,
      JSONB: DataTypes.JSONB,
      BLOB: DataTypes.BLOB,
    };

    if (!mapping[typeUpper]) {
      throw new Error(`Unsupported type: ${type}`);
    }

    return mapping[typeUpper];
  }

  private reverseMapType(sequelizeType: any): string {
    const typeStr = String(sequelizeType);

    // Basic extraction - can be improved
    if (typeStr.includes('VARCHAR') || typeStr.includes('STRING')) return 'STRING';
    if (typeStr.includes('TEXT')) return 'TEXT';
    if (typeStr.includes('CHAR')) return 'CHAR';
    if (typeStr.includes('BIGINT')) return 'BIGINT';
    if (typeStr.includes('INTEGER') || typeStr.includes('INT')) return 'INTEGER';
    if (typeStr.includes('FLOAT')) return 'FLOAT';
    if (typeStr.includes('DOUBLE')) return 'DOUBLE';
    if (typeStr.includes('DECIMAL')) return 'DECIMAL';
    if (typeStr.includes('BOOLEAN') || typeStr.includes('TINYINT(1)')) return 'BOOLEAN';
    if (typeStr.includes('DATETIME') || typeStr.includes('TIMESTAMP')) return 'DATE';
    if (typeStr.includes('DATE')) return 'DATEONLY';
    if (typeStr.includes('TIME')) return 'TIME';
    if (typeStr.includes('UUID')) return 'UUID';
    if (typeStr.includes('JSONB')) return 'JSONB';
    if (typeStr.includes('JSON')) return 'JSON';
    if (typeStr.includes('BLOB')) return 'BLOB';

    return 'STRING'; // Fallback
  }

  // ========== DDL BUILDERS ==========

  override buildDDL(operation: SchemaOperation): string {
    switch (operation.type) {
      case 'CREATE_TABLE':
        return this.buildCreateTableDDL(operation.details);
      case 'DROP_TABLE':
        return `DROP TABLE ${this.quoteIdentifier(operation.collection)};`;
      case 'RENAME_TABLE':
        return `ALTER TABLE ${this.quoteIdentifier(operation.collection)} RENAME TO ${this.quoteIdentifier(operation.details.newName)};`;
      case 'CREATE_COLUMN':
        return this.buildCreateColumnDDL(operation.collection, operation.details);
      case 'DROP_COLUMN':
        return `ALTER TABLE ${this.quoteIdentifier(operation.collection)} DROP COLUMN ${this.quoteIdentifier(operation.details.columnName)};`;
      case 'MODIFY_COLUMN':
        return this.buildModifyColumnDDL(operation.collection, operation.details);
      case 'RENAME_COLUMN':
        return `ALTER TABLE ${this.quoteIdentifier(operation.collection)} RENAME COLUMN ${this.quoteIdentifier(operation.details.oldName)} TO ${this.quoteIdentifier(operation.details.newName)};`;
      case 'CREATE_INDEX':
        return this.buildCreateIndexDDL(operation.collection, operation.details);
      case 'DROP_INDEX':
        return `DROP INDEX ${this.quoteIdentifier(operation.details.indexName)};`;
      case 'CREATE_FOREIGN_KEY':
        return this.buildCreateForeignKeyDDL(operation.collection, operation.details);
      case 'DROP_FOREIGN_KEY':
        return `ALTER TABLE ${this.quoteIdentifier(operation.collection)} DROP CONSTRAINT ${this.quoteIdentifier(operation.details.fkName)};`;
      default:
        return `-- DDL preview not implemented for ${operation.type}`;
    }
  }

  protected override buildCreateTableDDL(details: any): string {
    const { tableName, columns } = details;
    const columnDefs = (columns as ColumnDefinition[])
      .map(col => {
        let def = `${this.quoteIdentifier(col.name)} ${col.type}`;
        if (!col.allowNull) def += ' NOT NULL';
        if (col.defaultValue !== undefined) def += ` DEFAULT ${this.formatValue(col.defaultValue)}`;
        if (col.primaryKey) def += ' PRIMARY KEY';
        if (col.autoIncrement) def += ' AUTO_INCREMENT';
        if (col.unique) def += ' UNIQUE';
        if (col.comment) def += ` COMMENT ${this.formatValue(col.comment)}`;
        return def;
      })
      .join(',\n  ');

    return `CREATE TABLE ${this.quoteIdentifier(tableName)} (\n  ${columnDefs}\n);`;
  }

  protected override buildCreateColumnDDL(tableName: string, details: any): string {
    const { columnName, type, allowNull, defaultValue, comment } = details;
    let ddl = `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD COLUMN ${this.quoteIdentifier(columnName)} ${type}`;

    if (!allowNull) {
      ddl += ' NOT NULL';
    }

    if (defaultValue !== undefined && defaultValue !== null) {
      ddl += ` DEFAULT ${this.formatValue(defaultValue)}`;
    }

    if (comment) {
      ddl += ` COMMENT ${this.formatValue(comment)}`;
    }

    return ddl + ';';
  }

  private buildModifyColumnDDL(tableName: string, details: any): string {
    const { columnName, type, allowNull, defaultValue } = details;
    let ddl = `ALTER TABLE ${this.quoteIdentifier(tableName)} MODIFY COLUMN ${this.quoteIdentifier(columnName)} ${type}`;

    if (!allowNull) {
      ddl += ' NOT NULL';
    }

    if (defaultValue !== undefined) {
      ddl += ` DEFAULT ${this.formatValue(defaultValue)}`;
    }

    return ddl + ';';
  }

  protected override buildCreateIndexDDL(tableName: string, details: any): string {
    const indexName = details.indexName || `idx_${tableName}_${details.columns.join('_')}`;
    const unique = details.unique ? 'UNIQUE ' : '';
    const columns = details.columns.map((c: string) => this.quoteIdentifier(c)).join(', ');
    return `CREATE ${unique}INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(tableName)} (${columns});`;
  }

  private buildCreateForeignKeyDDL(tableName: string, details: any): string {
    const { fkName, columns, referencedTable, referencedColumns, onDelete, onUpdate } = details;
    const name = fkName || `fk_${tableName}_${columns.join('_')}`;
    const cols = columns.map((c: string) => this.quoteIdentifier(c)).join(', ');
    const refCols = referencedColumns.map((c: string) => this.quoteIdentifier(c)).join(', ');

    let ddl = `ALTER TABLE ${this.quoteIdentifier(tableName)} ADD CONSTRAINT ${this.quoteIdentifier(name)} FOREIGN KEY (${cols}) REFERENCES ${this.quoteIdentifier(referencedTable)} (${refCols})`;

    if (onDelete) {
      ddl += ` ON DELETE ${onDelete}`;
    }

    if (onUpdate) {
      ddl += ` ON UPDATE ${onUpdate}`;
    }

    return ddl + ';';
  }

  private buildAttributesFromColumns(columns: ColumnDefinition[]): Record<string, any> {
    const attributes: Record<string, any> = {};

    for (const col of columns) {
      attributes[col.name] = {
        type: this.mapType(col.type),
        allowNull: col.allowNull,
        defaultValue: col.defaultValue,
        autoIncrement: col.autoIncrement || false,
        primaryKey: col.primaryKey || false,
        unique: col.unique || false,
        comment: col.comment,
      };
    }

    return attributes;
  }

  protected override quoteIdentifier(identifier: string): string {
    // Dialect-specific quoting
    switch (this.dialect) {
      case 'mysql':
      case 'mariadb':
        return `\`${identifier.replace(/`/g, '``')}\``;
      case 'postgres':
      case 'sqlite':
      default:
        return `"${identifier.replace(/"/g, '""')}"`;
    }
  }
}
