/* eslint-disable no-underscore-dangle */
import {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ManyToManySchema,
  ManyToOneSchema,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, Schema, SchemaType } from 'mongoose';

import FilterOperatorBuilder from './filter-operator-builder';
import NameFactory from './name-factory';

export default class SchemaFieldsGenerator {
  static buildFieldsSchema(model: Model<RecordData>): CollectionSchema['fields'] {
    return Object.entries(model.schema.paths).reduce((schemaFields, [fieldName, schemaType]) => {
      const mixedFieldPattern = '$*';
      const privateFieldPattern = '__';

      if (fieldName.startsWith(privateFieldPattern) || fieldName.includes(mixedFieldPattern)) {
        return schemaFields;
      }

      const isRefField = schemaType.options?.ref;
      const isArrayOfRefField =
        schemaType.options?.type[0]?.schemaName === 'ObjectId' && isRefField;

      if (isArrayOfRefField) {
        this.addManyToManyRelation(schemaType, model.modelName, fieldName, schemaFields);
      } else if (isRefField) {
        this.addManyToOneRelation(schemaType, model.modelName, fieldName, schemaFields);
      } else {
        schemaFields[schemaType.path.split('.').shift()] = SchemaFieldsGenerator.buildColumnSchema(
          schemaType,
          SchemaFieldsGenerator.getColumnType(schemaType.instance, schemaType),
        );
      }

      return schemaFields;
    }, {});
  }

  private static isPathMustBeFlatten(currentPath: string, pathsToFlatten: string[]): boolean {
    const pathWithoutModelName = pathsToFlatten.map(pathToFlatten =>
      pathToFlatten.split(':').slice(1, pathToFlatten.length).join(':'),
    );

    return pathWithoutModelName.includes(currentPath.split('.').shift());
  }

  private static addManyToOneRelation(
    schema: SchemaType,
    modelName: string,
    fieldName: string,
    schemaFields: CollectionSchema['fields'],
  ): void {
    schemaFields[NameFactory.manyToOneRelationName(fieldName, modelName)] = {
      type: 'ManyToOne',
      foreignCollection: schema.options.ref,
      foreignKey: schema.path,
      foreignKeyTarget: '_id',
    } as ManyToOneSchema;
    // when there is no _id all ref are an id, this case is for the generated many to many
    const isPrimaryKey = !schemaFields._id;
    schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(
      schema,
      'String',
      isPrimaryKey,
    );
  }

  private static addManyToManyRelation(
    schema: SchemaType,
    modelName: string,
    fieldName: string,
    schemaFields: CollectionSchema['fields'],
  ): void {
    const foreignCollectionName = schema.options?.ref;

    schemaFields[NameFactory.manyToOneRelationName(fieldName, modelName)] = {
      type: 'ManyToMany',
      foreignCollection: foreignCollectionName,
      throughCollection: NameFactory.manyToManyName(modelName, foreignCollectionName, fieldName),
      foreignKey: NameFactory.generateKey(foreignCollectionName),
      originKey: NameFactory.generateKey(modelName),
      foreignKeyTarget: '_id',
      originKeyTarget: '_id',
    } as ManyToManySchema;
    schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(schema, 'String');
  }

  private static getColumnType(instance: string, field: SchemaType): ColumnType {
    if (field.path.includes('.')) {
      const fieldPath = field.path.split('.');
      fieldPath.shift();
      field.path = fieldPath[fieldPath.length - 1];

      return SchemaFieldsGenerator.getColumnTypeFromNestedPath(fieldPath, field);
    }

    const potentialEnumValues = this.getEnumValues(field);

    if (potentialEnumValues) {
      if (potentialEnumValues.some(value => !(typeof value === 'string'))) {
        throw new Error('Enum support only String values');
      }

      return 'Enum';
    }

    switch (instance) {
      case 'Array':
        return [
          SchemaFieldsGenerator.getColumnType(
            field.schema ? 'Embedded' : (field as Schema.Types.Array).caster.instance,
            field.schema ? field : (field as Schema.Types.Array).caster,
          ),
        ];
      case 'String':
      case 'ObjectID':
      case 'Buffer':
      case 'Decimal128':
        return 'String';
      case 'Number':
        return 'Number';
      case 'Date':
        return 'Date';
      case 'Boolean':
        return 'Boolean';
      case 'Map':
      case 'Mixed':
        return 'Json';
      case 'Embedded':
      default:
        return SchemaFieldsGenerator.getColumnTypeFromNested(field);
    }
  }

  private static buildColumnSchema(
    field: SchemaType,
    columnType: ColumnType,
    isPrimaryKey = false,
  ): ColumnSchema {
    return {
      columnType,
      filterOperators: FilterOperatorBuilder.getSupportedOperators(columnType as PrimitiveTypes),
      defaultValue: field.options?.default,
      enumValues: this.getEnumValues(field),
      isPrimaryKey: field.path === '_id' || isPrimaryKey,
      isReadOnly: !!field.options?.immutable,
      isSortable: !(columnType instanceof Object || columnType === 'Json'),
      type: 'Column',
      validation: field.isRequired ? [{ operator: 'Present' }] : null,
    };
  }

  private static getEnumValues(field: SchemaType): string[] {
    return field.options?.enum instanceof Array ? field.options.enum : field.options?.enum?.values;
  }

  private static getColumnTypeFromNested(field: SchemaType): ColumnType {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { singleNestedPaths } = field.schema;
    const paths =
      Object.keys(singleNestedPaths).length > 0 ? singleNestedPaths : field.schema.paths;

    return Object.entries(paths).reduce((columnType, [fieldPath, fieldSchema]) => {
      return SchemaFieldsGenerator.getColumnTypeFromNestedPath(
        fieldPath.split('.'),
        fieldSchema as SchemaType,
        columnType,
      );
    }, {});
  }

  private static getColumnTypeFromNestedPath(
    fieldPath: string[],
    field: SchemaType,
    columnType: ColumnType = {},
  ): ColumnType {
    let previousPath;

    fieldPath.forEach((fieldName, index) => {
      if (fieldName === '_id') {
        return;
      }

      if (index !== fieldPath.length - 1) {
        if (previousPath) {
          if (!previousPath[fieldName]) {
            previousPath[fieldName] = {};
          }

          previousPath = previousPath[fieldName];
        } else {
          if (!columnType[fieldName]) {
            columnType[fieldName] = {};
          }

          previousPath = columnType[fieldName];
        }
      } else {
        if (!previousPath) {
          previousPath = columnType;
        }

        previousPath[fieldName] = SchemaFieldsGenerator.getColumnType(field.instance, field);
      }
    });

    return columnType;
  }
}
