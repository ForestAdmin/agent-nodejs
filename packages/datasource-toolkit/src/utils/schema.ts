import { ValidationError } from '../errors';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  ManyToManySchema,
  OneToManySchema,
  RelationSchema,
} from '../interfaces/schema';

export default class SchemaUtils {
  static checkAlreadyDefinedField(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): void {
    if (schema.fields[fieldName]) {
      const path = collectionName ? `${collectionName}.${fieldName}` : fieldName;
      throw new ValidationError(`Field '${path}' is already defined in schema`);
    }
  }

  static checkMissingField(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): void {
    SchemaUtils.getField(schema, fieldName, collectionName);
  }

  static getField(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): FieldSchema {
    if (!schema.fields[fieldName]) {
      const path = collectionName ? `${collectionName}.${fieldName}` : fieldName;
      throw new ValidationError(
        `Field '${path}' not found in the available list: [${Object.keys(schema.fields)}]`,
      );
    }

    return schema.fields[fieldName];
  }

  static getColumn(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): ColumnSchema {
    const columns = Object.keys(schema.fields).filter(
      name => schema.fields[name].type === 'Column',
    );

    if (!columns.find(name => name === fieldName)) {
      const path = collectionName ? `${collectionName}.${fieldName}` : fieldName;
      throw new ValidationError(`Column '${path}' not found in the available list: [${columns}]`);
    }

    return schema.fields[fieldName] as ColumnSchema;
  }

  static getRelation(
    schema: CollectionSchema,
    relationName: string,
    collectionName?: string,
  ): RelationSchema {
    const relations = Object.keys(schema.fields).filter(
      name => schema.fields[name].type !== 'Column',
    );

    if (!relations.find(name => name === relationName)) {
      const path = collectionName ? `${collectionName}.${relationName}` : relationName;
      throw new ValidationError(
        `Relation '${path}' not found in the available list: [${relations}]`,
      );
    }

    return schema.fields[relationName] as RelationSchema;
  }

  static getPrimaryKeys(schema: CollectionSchema): string[] {
    return Object.keys(schema.fields).filter(name => this.isPrimaryKey(schema, name));
  }

  static isPrimaryKey(schema: CollectionSchema, fieldName: string): boolean {
    const field = this.getColumn(schema, fieldName);

    return field.isPrimaryKey;
  }

  static isForeignKey(schema: CollectionSchema, name: string): boolean {
    const field = this.getColumn(schema, name);

    return (
      field.type === 'Column' &&
      Object.values(schema.fields).some(
        relation => relation.type === 'ManyToOne' && relation.foreignKey === name,
      )
    );
  }

  static getToManyRelation(
    schema: CollectionSchema,
    relationName: string,
  ): ManyToManySchema | OneToManySchema {
    const relationFieldSchema = this.getRelation(schema, relationName);

    if (relationFieldSchema.type !== 'OneToMany' && relationFieldSchema.type !== 'ManyToMany') {
      throw new Error(
        `Relation ${relationName} has invalid type should be one of ` +
          `${'OneToMany'} or ${'ManyToMany'}.`,
      );
    }

    return relationFieldSchema as ManyToManySchema | OneToManySchema;
  }
}
