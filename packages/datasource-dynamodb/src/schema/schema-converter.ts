import type { AttributeSchema, TableModel } from '../types';
import type { ColumnSchema, FieldSchema, Logger } from '@forestadmin/datasource-toolkit';

import TypeConverter from '../utils/type-converter';

function convertAttribute(attribute: AttributeSchema, isPrimaryKey: boolean): ColumnSchema {
  const columnType = TypeConverter.getColumnTypeFromDataType(attribute.type);

  return {
    type: 'Column',
    columnType,
    filterOperators: TypeConverter.operatorsForColumnType(columnType),
    isPrimaryKey,
    isReadOnly: false,
    isSortable: TypeConverter.isSortable(attribute.type),
    validation: [],
  };
}

/** Turns the attributes of a table into the columns of its collection, keys being the primary key. */
export default function convertModelToFields(
  model: TableModel,
  logger?: Logger,
): Record<string, FieldSchema> {
  const keys = [model.partitionKey, model.sortKey].filter(Boolean);
  const attributes: Record<string, AttributeSchema> = { ...model.schema };

  for (const key of keys) {
    attributes[key.name] ??= { type: key.type === 'N' ? 'number' : 'string', nullable: false };
  }

  const fields: Record<string, FieldSchema> = {};

  for (const [name, attribute] of Object.entries(attributes)) {
    try {
      const isPrimaryKey = keys.some(key => key.name === name);
      const generated = convertAttribute(attribute, isPrimaryKey);
      const overridden = model.overrideTypeConverter?.({
        fieldName: name,
        attribute,
        generatedFieldSchema: generated,
      });

      fields[name] = overridden || generated;
    } catch (error) {
      logger?.('Warn', `Skipping column '${model.name}.${name}' (${error.message})`);
    }
  }

  return fields;
}
