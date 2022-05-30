/* eslint-disable */
import { ColumnSchema, ColumnType, Operator } from '@forestadmin/datasource-toolkit';
import { SchemaDefinition } from 'dynamoose/dist/Schema';

export default class SchemaBuilder {
  static convert(schema: SchemaDefinition): Record<string, ColumnSchema> {
    const columns = {};
    for (const [key, value] of Object.entries(schema)) {
      columns[key] = this.convertColumn(value);
    }

    return columns;
  }

  private static convertColumn(column: any): ColumnSchema {
    return {
      type: 'Column',
      columnType: this.convertColumnType(column),
      isPrimaryKey: !!column.hashKey || !!column.rangeKey,
      filterOperators: new Set([
        'Equal',
        'Present',
        'LessThan',
        'GreaterThan',
        'StartsWith',
        'Contains',
        'In',
        'NotEqual',
        'NotContains',
        'Missing',
      ]),
    };
  }

  private static convertColumnType(column: any): ColumnType {
    if (column === Number) return 'Number';
    if (column === Buffer || column === String) return 'String';
    if (column === Object) return 'Json';
    if (column === Date) return 'Date';
    if (column === Array) return ['Json'];
    if (column.type === Array) return [this.convertColumnType(column.schema[0])];
    if (column.type === Object) {
      const compositeType = {};
      for (const [key, subColumn] of Object.entries(column.schema))
        compositeType[key] = this.convertColumnType(subColumn);

      return compositeType;
    }
    if (column.type) return this.convertColumnType(column.type);

    console.log(`Unsupported ${column}`);
    return null;
  }
}
