import type { ModelAttributeColumnOptions } from 'sequelize';

import { tables } from '@forestadmin/datasource-demo-bank/dist/seed/schema';
import { DataTypes } from 'sequelize';

export type DemoField = {
  name: string;
  type: 'uuid' | 'enum' | 'string' | 'integer' | 'decimal' | 'date' | 'datetime' | 'boolean';
  enum?: string[];
  primaryKey?: boolean;
  foreignKey?: boolean;
};

const UUID_AS_STRING_LENGTH = 36;

export function demoFields(table: string, omit: string[] = []): DemoField[] {
  const definition = tables[table];
  if (!definition) throw new Error(`Unknown demo bank table '${table}'`);

  return (definition.fields as DemoField[]).filter(field => !omit.includes(field.name));
}

function sequelizeType(field: DemoField) {
  switch (field.type) {
    case 'uuid':
      return DataTypes.STRING(UUID_AS_STRING_LENGTH);
    case 'enum':
      return DataTypes.ENUM(...field.enum);
    case 'integer':
      return DataTypes.INTEGER;
    case 'decimal':
      return DataTypes.DECIMAL(14, 2);
    case 'date':
      return DataTypes.DATEONLY;
    case 'datetime':
      return DataTypes.DATE;
    case 'boolean':
      return DataTypes.BOOLEAN;
    default:
      return DataTypes.TEXT;
  }
}

export function sequelizeAttributes(
  table: string,
  omit: string[] = [],
): Record<string, ModelAttributeColumnOptions> {
  return Object.fromEntries(
    demoFields(table, omit).map(field => [
      field.name,
      { type: sequelizeType(field), primaryKey: Boolean(field.primaryKey) },
    ]),
  );
}

function mongooseType(field: DemoField) {
  switch (field.type) {
    case 'enum':
      return { type: String, enum: field.enum };
    case 'integer':
    case 'decimal':
      return Number;
    case 'date':
    case 'datetime':
      return Date;
    case 'boolean':
      return Boolean;
    default:
      return String;
  }
}

export function mongooseDefinition(table: string, omit: string[] = []) {
  return Object.fromEntries(
    demoFields(table, omit).map(field => [
      field.primaryKey ? '_id' : field.name,
      mongooseType(field),
    ]),
  );
}
