import {
  CollectionSchema,
  ColumnSchema,
  FieldTypes,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { DataTypes, ModelAttributeColumnOptions, ModelAttributes } from 'sequelize';

import { TypeConverter } from '@forestadmin/datasource-sequelize';

export default class CollectionSchemaToModelAttributesConverter {
  public static convert(schema: CollectionSchema): ModelAttributes {
    const attributes: ModelAttributes = {};

    Object.entries(schema.fields).forEach(([name, field]) => {
      if (field.type !== FieldTypes.Column) return;

      attributes[name] = this.convertColumn(field);
    });

    return attributes;
  }

  private static convertColumn(field: ColumnSchema): ModelAttributeColumnOptions {
    const attribute: ModelAttributeColumnOptions = {
      primaryKey: Boolean(field.isPrimaryKey),
      type: TypeConverter.fromColumnType(field.columnType as PrimitiveTypes),
      autoIncrement: false,
    };

    // FIXME: Allow to specify INTEGER fields via Number type without PK status.
    if (attribute.primaryKey && field.columnType === PrimitiveTypes.Number) {
      attribute.type = DataTypes.INTEGER;
      attribute.autoIncrement = true;
    }

    return attribute;
  }
}
