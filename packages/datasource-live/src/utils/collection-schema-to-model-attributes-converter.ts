import { ColumnSchema, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { DataTypes, ModelAttributeColumnOptions, ModelAttributes } from 'sequelize';
import { TypeConverter } from '@forestadmin/datasource-sequelize';

import { LiveCollectionSchema } from '../types';

export default class CollectionSchemaToModelAttributesConverter {
  public static convert(schema: LiveCollectionSchema): ModelAttributes {
    const attributes: ModelAttributes = {};

    Object.entries(schema).forEach(([name, field]) => {
      if (field.type !== 'Column') return;

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
    if (attribute.primaryKey && field.columnType === 'Number') {
      attribute.type = DataTypes.INTEGER;
      attribute.autoIncrement = true;
    }

    return attribute;
  }
}
