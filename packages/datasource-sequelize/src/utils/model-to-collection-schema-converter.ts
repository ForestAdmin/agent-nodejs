import {
  AbstractDataTypeConstructor,
  Association,
  BelongsTo,
  BelongsToMany,
  HasMany,
  HasOne,
  Model,
  ModelAttributeColumnOptions,
  ModelAttributes,
  ModelDefined,
} from 'sequelize';

import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  FieldTypes,
  RelationSchema,
} from '@forestadmin/datasource-toolkit';

import TypeConverter from './type-converter';

export default class ModelToCollectionSchemaConverter {
  private static convertAssociation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    association: Association<Model<any, any>, Model<any, any>>,
  ): RelationSchema {
    switch (association.associationType) {
      case BelongsTo.name:
        return {
          foreignCollection: association.target.name,
          foreignKey: association.foreignKey,
          type: FieldTypes.ManyToOne,
        };
      case BelongsToMany.name:
        return {
          foreignCollection: association.target.name,
          foreignKey: association.foreignKey,
          originRelation: association.source.name,
          otherField: (association as BelongsToMany).otherKey,
          targetRelation: association.target.name,
          throughCollection: (association as BelongsToMany).through.model.name,
          type: FieldTypes.ManyToMany,
        };
      case HasMany.name:
        return {
          foreignCollection: association.target.name,
          foreignKey: association.foreignKey,
          type: FieldTypes.OneToMany,
        };
      case HasOne.name:
        return {
          foreignCollection: association.target.name,
          foreignKey: association.foreignKey,
          type: FieldTypes.OneToOne,
        };
      default:
        throw new Error(`Unsupported association: "${association.associationType}".`);
    }
  }

  private static convertAssociations(associations: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: Association<Model<any, any>, Model<any, any>>;
  }): CollectionSchema['fields'] {
    const schemaAssociations = {};

    if (associations) {
      Object.entries(associations).forEach(([key, association]) => {
        schemaAssociations[key] = this.convertAssociation(association);
      });
    }

    return schemaAssociations;
  }

  private static convertAttribute(attribute: ModelAttributeColumnOptions): FieldSchema {
    const sequelizeColumnType = attribute.type as AbstractDataTypeConstructor;
    const columnType = TypeConverter.fromDataType(sequelizeColumnType);
    const filterOperators = TypeConverter.operatorsForDataType(sequelizeColumnType);
    const column: ColumnSchema = {
      columnType,
      filterOperators,
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
      fields: {
        ...this.convertAttributes(model.getAttributes()),
        ...this.convertAssociations(model.associations),
      },
      searchable: false,
      segments: [],
    };
  }
}
