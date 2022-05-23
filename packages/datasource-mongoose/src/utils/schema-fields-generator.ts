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
import MongooseCollection from '../collection';

export default class SchemaFieldsGenerator {
  static addInverseRelationships(collections: MongooseCollection[]): void {
    const createdFakeManyToManyRelations: string[] = [];
    collections.forEach(collection => {
      Object.entries(collection.schema.fields).forEach(([fieldName, fieldSchema]) => {
        if (fieldSchema.type === 'ManyToOne') {
          this.createOneToManyRelation(collections, fieldSchema, collection);
        } else if (
          fieldSchema.type === 'ManyToMany' &&
          !createdFakeManyToManyRelations.includes(fieldName)
        ) {
          this.createManyToManyCollection(
            collections,
            fieldSchema,
            collection,
            createdFakeManyToManyRelations,
          );
        }
      });
    });
  }

  static buildFieldsSchema(model: Model<RecordData>): CollectionSchema['fields'] {
    const schemaFields: CollectionSchema['fields'] = {};

    const existingCollectionNames: string[] = [];
    Object.entries(model.schema.paths).forEach(([fieldName, field]) => {
      const mixedFieldPattern = '$*';
      const privateFieldPattern = '__';

      if (fieldName.startsWith(privateFieldPattern) || fieldName.includes(mixedFieldPattern)) {
        return;
      }

      const isArrayOfIdsColumn =
        field.options?.type[0]?.schemaName === 'ObjectId' && field.options?.ref;
      const isIdColumn = field.options.ref;

      if (isArrayOfIdsColumn) {
        this.emulateManyToManyRelation(
          field,
          model,
          fieldName,
          schemaFields,
          existingCollectionNames,
        );
      } else if (isIdColumn) {
        const newFieldName = this.generateUniqueFieldName(fieldName, 'manyToOne', schemaFields);
        schemaFields[newFieldName] = {
          type: 'ManyToOne',
          foreignCollection: field.options.ref,
          foreignKey: field.path,
          foreignKeyTarget: '_id',
        } as ManyToOneSchema;
        schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(field, 'String');
      }

      schemaFields[field.path.split('.').shift()] = SchemaFieldsGenerator.buildColumnSchema(
        field,
        SchemaFieldsGenerator.getColumnType(field.instance, field),
      );
    });

    return schemaFields;
  }

  private static emulateManyToManyRelation(
    field: SchemaType,
    model: Model<RecordData>,
    fieldName: string,
    schemaFields: CollectionSchema['fields'],
    existingCollectionNames: string[],
  ) {
    const foreignCollectionName = field.options?.ref;

    const { modelName } = model;
    const newFieldName = this.generateUniqueFieldName(fieldName, 'manyToOne', schemaFields);
    const throughCollection = this.generateUniqueCollectionName(
      `${modelName}_${foreignCollectionName}`,
      existingCollectionNames,
    );
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
    schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(field, 'String');
  }

  private static createManyToManyCollection(
    collections: MongooseCollection[],
    fieldSchema: ManyToManySchema,
    collection: MongooseCollection,
    createdFakeManyToManyRelations: string[],
  ) {
    const foreignCollection = this.getCollection(collections, fieldSchema);
    const foreignKey = `${collection.name}_id`;
    const originKey = `${fieldSchema.foreignKey}`;

    const field = this.generateUniqueFieldName(
      `${foreignCollection.name}__${fieldSchema.originKey}`,
      'ManyToMany',
      foreignCollection.schema.fields,
    );
    const throughCollection = this.generateUniqueCollectionName(
      `${collection.name}_${foreignCollection.name}`,
      collection.dataSource.collections.map(coll => coll.name),
    );

    foreignCollection.schema.fields[field] = {
      throughCollection,
      foreignKey,
      originKey,
      foreignCollection: collection.name,
      type: 'ManyToMany',
      foreignKeyTarget: '_id',
      originKeyTarget: '_id',
    } as ManyToManySchema;

    const schema = new Schema({
      [foreignKey]: { type: Schema.Types.ObjectId, ref: collection.name },
      [originKey]: { type: Schema.Types.ObjectId, ref: foreignCollection.name },
    });

    const model = mongooseModel(throughCollection, schema, null, { overwriteModels: true });
    collection.dataSource.addCollection(new MongooseCollection(collection.dataSource, model));

    createdFakeManyToManyRelations.push(field);
  }

  private static createOneToManyRelation(
    collections: MongooseCollection[],
    fieldSchema: ManyToOneSchema,
    collection: MongooseCollection,
  ): void {
    const foreignCollection = this.getCollection(collections, fieldSchema);

    const field = this.generateUniqueFieldName(
      `${foreignCollection.name}__${fieldSchema.foreignKey}`,
      'oneToMany',
      foreignCollection.schema.fields,
    );
    foreignCollection.schema.fields[field] = {
      foreignCollection: collection.name,
      originKey: fieldSchema.foreignKey,
      originKeyTarget: '_id',
      type: 'OneToMany',
    } as OneToManySchema;
  }

  private static generateUniqueFieldName(
    prefix: string,
    relationName: string,
    fields: CollectionSchema['fields'],
    uniqueId = 1,
  ): string {
    const uniqueFieldName = `${prefix}__${relationName}--${uniqueId}`;

    if (fields[uniqueFieldName]) {
      return SchemaFieldsGenerator.generateUniqueFieldName(
        prefix,
        relationName,
        fields,
        uniqueId + 1,
      );
    }

    return uniqueFieldName;
  }

  private static generateUniqueCollectionName(
    collectionName: string,
    existingNames: string[],
    uniqueId = 1,
  ): string {
    const uniqueCollectionName = `${collectionName}--${uniqueId}`;

    if (existingNames.includes(uniqueCollectionName)) {
      return SchemaFieldsGenerator.generateUniqueCollectionName(
        collectionName,
        existingNames,
        uniqueId + 1,
      );
    }

    return uniqueCollectionName;
  }

  private static getCollection(
    collections: MongooseCollection[],
    fieldSchema: ManyToOneSchema | ManyToManySchema,
  ): MongooseCollection {
    const foreignCollection = collections.find(c => c.name === fieldSchema.foreignCollection);

    if (!foreignCollection) {
      throw new Error(`The collection '${fieldSchema.foreignCollection}' does not exist`);
    }

    return foreignCollection;
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

  private static buildColumnSchema(field: SchemaType, columnType: ColumnType): ColumnSchema {
    return {
      columnType,
      filterOperators: FilterOperatorBuilder.getSupportedOperators(columnType as PrimitiveTypes),
      defaultValue: field.options?.default,
      enumValues: this.getEnumValues(field),
      isPrimaryKey: field.path === '_id',
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
