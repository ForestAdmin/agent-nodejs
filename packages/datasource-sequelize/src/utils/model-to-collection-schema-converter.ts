import {
  CollectionSchema,
  ColumnSchema,
  ColumnSchemaValidation,
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

    column.validation.push(
      ...ModelToCollectionSchemaConverter.convertAttributeValidation(attribute, column),
    );

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
      countable: true,
      fields: {
        ...this.convertAttributes(model.name, model.getAttributes(), logger),
        ...this.convertAssociations(model.name, model.associations, logger),
      },
      searchable: false,
      segments: [],
    };
  }

  private static convertAttributeValidation(
    attribute: ModelAttributeColumnOptionsExt,
    column: ColumnSchema,
  ): ColumnSchemaValidation {
    const validations: ColumnSchemaValidation = [];

    if (
      attribute.allowNull === false &&
      !column.isReadOnly &&
      !attribute.defaultValue &&
      // eslint-disable-next-line no-underscore-dangle
      !attribute._autoGenerated
    ) {
      validations.push({ operator: 'Present' });
    }

    // eslint-disable-next-line
    if (!attribute.validate || attribute._autoGenerated === true) {
      return validations;
    }

    if (attribute.validate.min || attribute.validate.min === 0) {
      validations.push({
        operator: 'GreaterThanOrEqual',
        value:
          (
            attribute.validate.min as {
              args: readonly [number];
            }
          ).args?.[0] ?? (attribute.validate.min as number),
      });
    }

    if (attribute.validate.max || attribute.validate.max === 0) {
      validations.push({
        operator: 'LessThanOrEqual',
        value:
          (
            attribute.validate.max as {
              args: readonly [number];
            }
          ).args?.[0] ?? (attribute.validate.max as number),
      });
    }

    if (attribute.validate.isBefore) {
      validations.push({
        operator: 'Before',
        value:
          (
            attribute.validate.isBefore as {
              args: string;
            }
          ).args || attribute.validate.isBefore,
      });
    }

    if (attribute.validate.isAfter) {
      validations.push({
        operator: 'After',
        value:
          (
            attribute.validate.isAfter as {
              args: string;
            }
          ).args || attribute.validate.isAfter,
      });
    }

    if (attribute.validate.len) {
      const length =
        (
          attribute.validate.len as {
            args: readonly [number, number];
          }
        ).args || attribute.validate.len;

      if (Array.isArray(length) && length.length) {
        validations.push({
          operator: 'LongerThan',
          value: length[0],
        });

        if (length.length === 2) {
          validations.push({
            operator: 'ShorterThan',
            value: length[1],
          });
        }
      } else {
        validations.push({
          operator: 'LongerThan',
          value: length,
        });
      }
    }

    if (attribute.validate.equals) {
      validations.push({
        operator: 'Equal',
        value: attribute.validate.equals.toString(),
      });
    }

    if (attribute.validate.contains) {
      validations.push({
        operator: 'Contains',
        value: attribute.validate.contains,
      });
    }

    if (attribute.validate.is) {
      let value;

      if (
        (
          attribute.validate.is as {
            args: string | RegExp | readonly (string | RegExp)[];
          }
        ).args
      ) {
        ({ args: value } = attribute.validate.is as {
          args: string | RegExp | readonly (string | RegExp)[];
        });
      } else {
        value = attribute.validate.is;
      }

      if (!Array.isArray(value)) {
        validations.push({
          operator: 'Match',
          value,
        });
      } else {
        // Not sure about this behavior
        // value.forEach(v => {
        //   validations.push({
        //     operator: 'Match',
        //     value: v,
        //   });
        // });
      }
    }

    if (attribute.validate.notEmpty) {
      validations.push({
        operator: 'Present',
      });
    }

    return validations;
  }
}
