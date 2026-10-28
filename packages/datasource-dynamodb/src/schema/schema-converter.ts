import type { AttributeSchema, TableModel } from '../types';
import type { ColumnSchema, FieldSchema, Logger } from '@forestadmin/datasource-toolkit';

import { PUSHABLE_OPERATORS } from '../utils/expression-builder';
import TypeConverter from '../utils/type-converter';

function convertAttribute(
  attribute: AttributeSchema,
  isPrimaryKey: boolean,
  isOrdered: boolean,
  inMemoryProcessing: boolean,
): ColumnSchema {
  const columnType = TypeConverter.getColumnTypeFromDataType(attribute.type);
  const operators = TypeConverter.operatorsForColumnType(columnType);

  return {
    type: 'Column',
    columnType,
    filterOperators: inMemoryProcessing
      ? operators
      : new Set([...operators].filter(operator => PUSHABLE_OPERATORS.has(operator))),
    isPrimaryKey,
    isReadOnly: false,
    // DynamoDB orders by the sort key of the table or of an index and by nothing else.
    isSortable: TypeConverter.isSortable(attribute.type) && (inMemoryProcessing || isOrdered),
    validation: [],
  };
}

/**
 * Turns the attributes of a table into the columns of its collection, keys being the primary key.
 * Without `inMemoryProcessing`, a column only offers the filters DynamoDB evaluates itself, and
 * only the sort keys sort.
 */
export default function convertModelToFields(
  model: TableModel,
  logger?: Logger,
  inMemoryProcessing = true,
): Record<string, FieldSchema> {
  const keys = [model.partitionKey, model.sortKey].filter(Boolean);
  const attributes: Record<string, AttributeSchema> = { ...model.schema };

  for (const key of keys) {
    attributes[key.name] ??= { type: key.type === 'N' ? 'number' : 'string', nullable: false };
  }

  const sortKeys = new Set(
    [model.sortKey, ...model.indexes.map(index => index.sortKey)]
      .filter(Boolean)
      .map(key => key.name),
  );
  const fields: Record<string, FieldSchema> = {};

  for (const [name, attribute] of Object.entries(attributes)) {
    try {
      const isPrimaryKey = keys.some(key => key.name === name);
      const generated = convertAttribute(
        attribute,
        isPrimaryKey,
        sortKeys.has(name),
        inMemoryProcessing,
      );
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
