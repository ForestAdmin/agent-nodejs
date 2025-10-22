import { BaseSchemaExecutor } from './base-executor';
import { SchemaOperationType, TableDefinition, ColumnDefinition } from '../types';

export class UnsupportedSchemaExecutor extends BaseSchemaExecutor {
  readonly dialect = 'unsupported';

  protected override getSupportedOperations(): SchemaOperationType[] {
    return [];
  }

  override getSupportedTypes(): string[] {
    return [];
  }

  override supportsOperation(): boolean {
    return false;
  }

  override async createTable(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  override async dropTable(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  override async createColumn(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  override async dropColumn(): Promise<void> {
    throw new Error('Schema management not supported for this datasource');
  }

  override async listTables(): Promise<string[]> {
    return [];
  }

  override async describeTable(): Promise<TableDefinition> {
    throw new Error('Schema management not supported for this datasource');
  }

  override buildDDL(): string {
    return '-- Schema management not supported for this datasource';
  }
}
