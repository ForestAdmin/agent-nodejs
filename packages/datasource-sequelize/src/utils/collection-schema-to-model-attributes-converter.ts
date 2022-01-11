import {
  CollectionSchema,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { DataTypes } from 'sequelize';
import TypeConverter from './type-converter';

export default class CollectionSchemaToModelAttributesConverter {
  public static convert(schema: CollectionSchema) {
    const attributes = {};

    Object.entries(schema.fields).forEach(([name, field]) => {
      attributes[name] = this.convertField(field);
    });

    return attributes;
  }

  // TODO: Handle relations.
  private static convertField(field: FieldSchema) {
    if (field.type !== FieldTypes.Column) throw new Error(`Unsupported field type: ${field.type}`);

    const attribute = {
      primaryKey: Boolean(field.isPrimaryKey),
      type: TypeConverter.fromColumnType(field.columnType),
      autoIncrement: false,
    };

    if (attribute.primaryKey && field.columnType === PrimitiveTypes.Number) {
      attribute.type = DataTypes.INTEGER;
      attribute.autoIncrement = true;
    }

    return attribute;
  }
}
