import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  Logger,
  RelationSchema,
} from '@forestadmin/datasource-toolkit';
import {
  AbstractDataType,
  Association,
  BelongsTo,
  BelongsToMany,
  DataTypes,
  HasMany,
  HasOne,
  Model,
  ModelAttributes,
  ModelDefined,
} from 'sequelize';

import TypeConverter from './type-converter';
import { BelongsToManyExt, ModelAttributeColumnOptionsExt } from '../type-overrides';

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
          foreignKeyTarget: (association as unknown as { targetKey: string }).targetKey,
          type: 'ManyToOne',
        };
      case BelongsToMany.name:
        return {
          foreignCollection: association.target.name,
          throughCollection: (association as BelongsToManyExt).through.model.name,
          originKey: (association as BelongsToMany).foreignKey,
          originKeyTarget: (association as BelongsToMany).sourceKey,
          foreignKey: (association as BelongsToMany).otherKey,
          foreignKeyTarget: (association as BelongsToMany).targetKey,
          type: 'ManyToMany',
        };
      case HasMany.name:
        return {
          foreignCollection: association.target.name,
          originKey: association.foreignKey,
          originKeyTarget: (association as unknown as { sourceKey: string }).sourceKey,
          type: 'OneToMany',
        };
      case HasOne.name:
        return {
          foreignCollection: association.target.name,
          originKey: association.foreignKey,
          originKeyTarget: (association as unknown as { sourceKey: string }).sourceKey,
          type: 'OneToOne',
        };
      default:
        throw new Error(`Unsupported association: "${association.associationType}".`);
    }
  }

  private static convertAssociations(
    modelName: string,
    associations: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: Association<Model<any, any>, Model<any, any>>;
    },
    logger: Logger,
  ): CollectionSchema['fields'] {
    const schemaAssociations = {};

    if (associations) {
      Object.entries(associations).forEach(([name, association]) => {
        try {
          schemaAssociations[name] = this.convertAssociation(association);
        } catch (error) {
          logger?.('Warn', `Skipping association '${modelName}.${name}' (${error.message})`);
        }
      });
    }

    return schemaAssociations;
  }

  private static convertAttribute(attribute: ModelAttributeColumnOptionsExt): FieldSchema {
    const sequelizeColumnType = attribute.type as AbstractDataType;
    const columnType = TypeConverter.fromDataType(sequelizeColumnType);
    const filterOperators = TypeConverter.operatorsForColumnType(columnType);
    const column: ColumnSchema = {
      columnType,
      filterOperators,
      type: 'Column',
      validation: [],
      isReadOnly: attribute.autoIncrement,
      allowNull: attribute.allowNull,
      isSortable: true,
    };

    if (
      attribute.allowNull === false &&
      !column.isReadOnly &&
      !attribute.defaultValue &&
      // eslint-disable-next-line no-underscore-dangle
      !attribute._autoGenerated
    ) {
      column.validation.push({ operator: 'Present' });
    }

    if (attribute.primaryKey) column.isPrimaryKey = true;

    if (
      attribute.defaultValue !== null &&
      attribute.defaultValue !== undefined &&
      (columnType === 'Json' || typeof attribute.defaultValue !== 'object')
    ) {
      column.defaultValue = attribute.defaultValue;
    }

    if (columnType === 'Enum') {
      column.enumValues = [...attribute.values];
    } else if (Array.isArray(columnType) && columnType.length === 1 && columnType[0] === 'Enum') {
      const arrayType = attribute.type as DataTypes.ArrayDataType<DataTypes.EnumDataType<string>>;
      column.enumValues = [...arrayType.options.type.values];
    }

    return column;
  }

  private static convertAttributes(
    modelName: string,
    attributes: ModelAttributes,
    logger: Logger,
  ): CollectionSchema['fields'] {
    const fields: CollectionSchema['fields'] = {};

    Object.entries(attributes).forEach(([name, attribute]) => {
      try {
        fields[name] = this.convertAttribute(attribute as ModelAttributeColumnOptionsExt);
      } catch (error) {
        logger?.('Warn', `Skipping column '${modelName}.${name}' (${error.message})`);
      }
    });

    return fields;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static convert(model: ModelDefined<any, any>, logger: Logger): CollectionSchema {
    if (!model) throw new Error('Invalid (null) model.');

    return {
      actions: {},
      charts: [],
      fields: {
        ...this.convertAttributes(model.name, model.getAttributes(), logger),
        ...this.convertAssociations(model.name, model.associations, logger),
      },
      searchable: false,
      segments: [],
      countable: true,
      chartable: true,
      creatable: true,
      deletable: true,
      listable: true,
      support_native_query: false,
      updatable: true,
    };
  }
}
