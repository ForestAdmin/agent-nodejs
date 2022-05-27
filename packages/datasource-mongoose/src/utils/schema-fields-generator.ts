/* eslint-disable no-underscore-dangle */
import {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  OneToOneSchema,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, Schema, SchemaType } from 'mongoose';

import FilterOperatorBuilder from './filter-operator-builder';
import MongooseCollection, {
  ManyToManyMongooseCollection,
  OneToOneMongooseCollection,
} from '../collection';
import NameFactory from './name-factory';

export default class SchemaFieldsGenerator {
  static addInverseRelationships(collections: MongooseCollection[]): void {
    // avoid to create two times the many to many collection
    // when iterating on the many to many type field schema
    const createdManyToMany: string[] = [];
    const isAlreadyCreated = name => createdManyToMany.includes(name);
    collections.forEach(collection => {
      Object.entries(collection.schema.fields).forEach(([fieldName, fieldSchema]) => {
        if (fieldSchema.type === 'ManyToOne') {
          this.addOneToManyRelation(fieldSchema, collection);
        } else if (fieldSchema.type === 'ManyToMany' && !isAlreadyCreated(fieldName)) {
          this.addManyToManyRelationAndCollection(fieldSchema, collection, createdManyToMany);
        } else if (fieldSchema.type === 'OneToOne') {
          const { foreignCollection } = fieldSchema;
          const originFieldName = NameFactory.getOriginFromOneToOne(foreignCollection);
          const c = new OneToOneMongooseCollection(foreignCollection, collection, originFieldName);
          collection.dataSource.addCollection(c);
        }
      });
    });
  }

  static buildFieldsSchema(
    model: Model<RecordData>,
    pathsToFlatten: string[] = [],
  ): CollectionSchema['fields'] {
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
      } else if (this.isPathMustBeFlatten(schemaType.path, pathsToFlatten)) {
        this.addOneToOneRelation(model.modelName, fieldName, schemaFields);
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

  private static addOneToOneRelation(
    modelName: string,
    fieldName: string,
    schemaFields: CollectionSchema['fields'],
  ): void {
    schemaFields[NameFactory.oneToOneRelationName(fieldName, modelName)] = {
      type: 'OneToOne',
      foreignCollection: NameFactory.oneToOneName(fieldName, modelName),
      originKey: '_id',
      originKeyTarget: '_id',
    } as OneToOneSchema;
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

  private static addManyToManyRelationAndCollection(
    fieldSchema: ManyToManySchema,
    collection: MongooseCollection,
    createdManyToMany: string[],
  ): void {
    const foreignCollection = collection.dataSource.getCollection(
      fieldSchema.foreignCollection,
    ) as MongooseCollection;
    const foreignKey = NameFactory.generateKey(collection.name);
    const originKey = fieldSchema.foreignKey;
    const { throughCollection } = fieldSchema;

    const manyToMany = NameFactory.manyToManyName(
      foreignCollection.name,
      fieldSchema.originKey,
      throughCollection,
    );
    createdManyToMany.push(manyToMany);

    foreignCollection.schema.fields[manyToMany] = {
      throughCollection,
      foreignKey,
      originKey,
      foreignCollection: collection.name,
      type: 'ManyToMany',
      foreignKeyTarget: '_id',
      originKeyTarget: '_id',
    } as ManyToManySchema;

    collection.dataSource.addCollection(
      new ManyToManyMongooseCollection(
        collection,
        foreignCollection,
        NameFactory.getOriginFieldNameOfIds(throughCollection),
        manyToMany,
      ),
    );
  }

  private static addOneToManyRelation(
    schema: ManyToOneSchema,
    collection: MongooseCollection,
  ): void {
    const foreignCollection = collection.dataSource.getCollection(
      schema.foreignCollection,
    ) as MongooseCollection;
    const field = NameFactory.oneToMany(foreignCollection.name, schema.foreignKey);
    foreignCollection.schema.fields[field] = {
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
