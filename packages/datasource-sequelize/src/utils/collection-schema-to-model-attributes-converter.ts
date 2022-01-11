import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
  RelationSchema,
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

  private static convertField(field: FieldSchema) {
    if (field.type === FieldTypes.Column) return this.convertColumn(field);

    return this.convertRelation(field);
  }

  private static convertColumn(field: ColumnSchema) {
    const attribute = {
      primaryKey: Boolean(field.isPrimaryKey),
      type: TypeConverter.fromColumnType(field.columnType),
      autoIncrement: false,
    };

    // FIXME: Allow to specify INTEGER fields via Number type without PK status.
    if (attribute.primaryKey && field.columnType === PrimitiveTypes.Number) {
      attribute.type = DataTypes.INTEGER;
      attribute.autoIncrement = true;
    }

    return attribute;
  }

  // TODO: Handle all relation types.
  private static convertRelation(field: RelationSchema) {
    throw new Error(`Unsupported field type: "${field.type}".`);
  }
}
