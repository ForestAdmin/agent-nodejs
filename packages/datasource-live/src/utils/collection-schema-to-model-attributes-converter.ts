import { DataTypes } from 'sequelize';
import {
  CollectionSchema,
  ColumnSchema,
  FieldTypes,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';

import { TypeConverter } from '@forestadmin/datasource-sequelize';

export default class CollectionSchemaToModelAttributesConverter {
  public static convert(schema: CollectionSchema) {
    const attributes = {};

    Object.entries(schema.fields).forEach(([name, field]) => {
      if (field.type !== FieldTypes.Column) return;

      attributes[name] = this.convertColumn(field);
    });

    return attributes;
  }

  private static convertColumn(field: ColumnSchema) {
    const attribute = {
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
