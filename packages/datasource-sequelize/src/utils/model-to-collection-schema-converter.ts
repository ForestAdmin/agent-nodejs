import { ModelDefined } from 'sequelize';

import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  FieldTypes,
} from '@forestadmin/datasource-toolkit';

import TypeConverter from './type-converter';

export default class ModelToCollectionSchemaConverter {
  // FIXME: Handle relations.
  private static convertAttribute(attribute): FieldSchema {
    const column: ColumnSchema = {
      columnType: TypeConverter.fromDataType(attribute.type),
      type: FieldTypes.Column,
    };

    if (attribute.primaryKey) column.isPrimaryKey = true;

    if (attribute.defaultValue !== null && attribute.defaultValue !== undefined)
      column.defaultValue = attribute.defaultValue;

    return column;
  }

  private static convertAttributes(model): CollectionSchema['fields'] {
    const attributes = model.getAttributes();
    const fields: CollectionSchema['fields'] = {};

    Object.entries(attributes).forEach(([name, attribute]) => {
      fields[name] = this.convertAttribute(attribute);
    });

    return fields;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static convert(model: ModelDefined<any, any>): CollectionSchema {
    if (!model) throw new Error('Invalid (null) model.');

    return {
      actions: {},
      fields: this.convertAttributes(model),
      searchable: false,
      segments: [],
    };
  }
}
