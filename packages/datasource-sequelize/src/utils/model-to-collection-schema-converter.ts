import {
  AbstractDataTypeConstructor,
  ModelAttributeColumnOptions,
  ModelAttributes,
  ModelDefined,
} from 'sequelize';

import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  FieldTypes,
} from '@forestadmin/datasource-toolkit';

import TypeConverter from './type-converter';

export default class ModelToCollectionSchemaConverter {
  // FIXME: Handle relations.
  private static convertAttribute(attribute: ModelAttributeColumnOptions): FieldSchema {
    const column: ColumnSchema = {
      columnType: TypeConverter.fromDataType(attribute.type as AbstractDataTypeConstructor),
      type: FieldTypes.Column,
    };

    if (attribute.primaryKey) column.isPrimaryKey = true;

    if (attribute.defaultValue !== null && attribute.defaultValue !== undefined)
      column.defaultValue = attribute.defaultValue;

    return column;
  }

  private static convertAttributes(attributes: ModelAttributes): CollectionSchema['fields'] {
    const fields: CollectionSchema['fields'] = {};

    Object.entries(attributes).forEach(([name, attribute]) => {
      fields[name] = this.convertAttribute(attribute as ModelAttributeColumnOptions);
    });

    return fields;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static convert(model: ModelDefined<any, any>): CollectionSchema {
    if (!model) throw new Error('Invalid (null) model.');

    return {
      actions: {},
      fields: this.convertAttributes(model.getAttributes()),
      searchable: false,
      segments: [],
    };
  }
}
