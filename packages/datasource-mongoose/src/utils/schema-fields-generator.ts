/* eslint-disable no-underscore-dangle */
import {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, Schema, SchemaType, model as mongooseModel } from 'mongoose';

import FilterOperatorBuilder from './filter-operator-builder';
import MongooseCollection, { ManyToManyMongooseCollection } from '../collection';

export default class SchemaFieldsGenerator {
  static addInverseRelationships(collections: MongooseCollection[]): void {
    const createdFakeManyToManyRelations: string[] = [];
    collections.forEach(collection => {
      Object.entries(collection.schema.fields).forEach(([fieldName, fieldSchema]) => {
        if (fieldSchema.type === 'ManyToOne') {
          this.createOneToManyRelation(fieldSchema, collection);
        } else if (
          fieldSchema.type === 'ManyToMany' &&
          !createdFakeManyToManyRelations.includes(fieldName)
        ) {
          this.createManyToManyCollection(fieldSchema, collection, createdFakeManyToManyRelations);
        }
      });
    });
  }

  static buildFieldsSchema(model: Model<RecordData>): CollectionSchema['fields'] {
    const schemaFields: CollectionSchema['fields'] = {};

    const existingCollectionNames: string[] = [];
    Object.entries(model.schema.paths).forEach(([fieldName, schemaType]) => {
      const mixedFieldPattern = '$*';
      const privateFieldPattern = '__';

      if (fieldName.startsWith(privateFieldPattern) || fieldName.includes(mixedFieldPattern)) {
        return;
      }

      const isArrayOfIdsColumn =
        schemaType.options?.type[0]?.schemaName === 'ObjectId' && schemaType.options?.ref;
      const isIdColumn = schemaType.options.ref;

      if (isArrayOfIdsColumn) {
        this.emulateManyToManyRelation(
          schemaType,
          model,
          fieldName,
          schemaFields,
          existingCollectionNames,
        );
      } else if (isIdColumn) {
        const newFieldName = `${fieldName}__${model.modelName.split('_').pop()}__manyToOne`;
        schemaFields[newFieldName] = {
          type: 'ManyToOne',
          foreignCollection: schemaType.options.ref,
          foreignKey: schemaType.path,
          foreignKeyTarget: '_id',
        } as ManyToOneSchema;
        schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(
          schemaType,
          'String',
          !schemaFields._id,
        );

        return;
      }

      schemaFields[schemaType.path.split('.').shift()] = SchemaFieldsGenerator.buildColumnSchema(
        schemaType,
        SchemaFieldsGenerator.getColumnType(schemaType.instance, schemaType),
      );
    });

    return schemaFields;
  }

  private static emulateManyToManyRelation(
    schema: SchemaType,
    model: Model<RecordData>,
    fieldName: string,
    schemaFields: CollectionSchema['fields'],
    existingCollectionNames: string[],
  ) {
    const foreignCollectionName = schema.options?.ref;

    const { modelName } = model;
    const newFieldName = `${fieldName}__${model.modelName.split('_').pop()}__manyToOne`;
    const throughCollection = `${modelName}__${foreignCollectionName}__${fieldName}`;
    existingCollectionNames.push(throughCollection);

    schemaFields[newFieldName] = {
      type: 'ManyToMany',
      foreignCollection: foreignCollectionName,
      throughCollection,
      foreignKey: `${foreignCollectionName}_id`,
      originKey: `${modelName}_id`,
      foreignKeyTarget: '_id',
      originKeyTarget: '_id',
    } as ManyToManySchema;
    schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(schema, 'String');
  }

  private static createManyToManyCollection(
    fieldSchema: ManyToManySchema,
    collection: MongooseCollection,
    createdFakeManyToManyRelations: string[],
  ) {
    const foreignCollection = collection.dataSource.getCollection(
      fieldSchema.foreignCollection,
    ) as MongooseCollection;
    const foreignKey = `${collection.name}_id`;
    const originKey = `${fieldSchema.foreignKey}`;
    const { throughCollection } = fieldSchema;

    const newFieldName = `${foreignCollection.name}__${fieldSchema.originKey}__${throughCollection
      .split('_')
      .pop()}`;
    createdFakeManyToManyRelations.push(newFieldName);

    foreignCollection.schema.fields[newFieldName] = {
      throughCollection,
      foreignKey,
      originKey,
      foreignCollection: collection.name,
      type: 'ManyToMany',
      foreignKeyTarget: '_id',
      originKeyTarget: '_id',
    } as ManyToManySchema;

    const schema = new Schema(
      {
        [foreignKey]: { type: Schema.Types.ObjectId, ref: collection.name },
        [originKey]: { type: Schema.Types.ObjectId, ref: foreignCollection.name },
      },
      { _id: false },
    );

    const model = mongooseModel(throughCollection, schema, null, { overwriteModels: true });
    collection.dataSource.addCollection(
      new ManyToManyMongooseCollection(collection.dataSource, model, collection, foreignCollection),
    );
  }

  private static createOneToManyRelation(
    schema: ManyToOneSchema,
    collection: MongooseCollection,
  ): void {
    const foreignCollection = collection.dataSource.getCollection(
      schema.foreignCollection,
    ) as MongooseCollection;

    const newFieldName = `${foreignCollection.name}__${schema.foreignKey}__oneToMany`;
    foreignCollection.schema.fields[newFieldName] = {
      foreignCollection: collection.name,
      originKey: schema.foreignKey,
      originKeyTarget: '_id',
      type: 'OneToMany',
    } as OneToManySchema;
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

  private static getEnumValues(field: SchemaType) {
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
