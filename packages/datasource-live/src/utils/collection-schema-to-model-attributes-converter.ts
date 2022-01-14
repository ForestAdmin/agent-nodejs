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
      const attribute = this.convertField(field);

      if (attribute) attributes[name] = attribute;
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
    if ([FieldTypes.ManyToOne, FieldTypes.OneToMany, FieldTypes.OneToOne].includes(field.type)) {
      return {
        references: {
          key: field.foreignKey,
          model: field.foreignCollection,
        },
      };
    }

    // TODO: Handle Many-to-Many relations.
    throw new Error(`Unsupported relation type: "${field.type}".`);
  }
}
