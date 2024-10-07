import {
  AlreadyDefinedFieldError,
  MissingColumnError,
  MissingFieldError,
  MissingRelationError,
  RelationFieldAccessDeniedError,
} from '../errors';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  ManyToManySchema,
  OneToManySchema,
  RelationSchema,
} from '../interfaces/schema';

export default class SchemaUtils {
  static throwIfAlreadyDefinedField(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): void {
    SchemaUtils.throwIfAccessingFieldFromRelation(fieldName, collectionName);

    if (schema.fields[fieldName]) {
      throw new AlreadyDefinedFieldError({ fieldName, collectionName });
    }
  }

  static throwIfMissingField(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): void {
    SchemaUtils.throwIfAccessingFieldFromRelation(fieldName, collectionName);

    if (!schema.fields[fieldName]) {
      throw new MissingFieldError({
        fieldName,
        availableFields: Object.keys(schema.fields),
        collectionName,
      });
    }
  }

  static getField(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): FieldSchema {
    SchemaUtils.throwIfMissingField(schema, fieldName, collectionName);

    return schema.fields[fieldName];
  }

  static getColumn(
    schema: CollectionSchema,
    fieldName: string,
    collectionName?: string,
  ): ColumnSchema {
    SchemaUtils.throwIfAccessingFieldFromRelation(fieldName, collectionName);

    const columns = SchemaUtils.getColumnNames(schema);

    if (!columns.find(name => name === fieldName)) {
      throw new MissingColumnError({ fieldName, availableFields: columns, collectionName });
    }

    return schema.fields[fieldName] as ColumnSchema;
  }

  static getRelation(
    schema: CollectionSchema,
    relationName: string,
    collectionName?: string,
  ): RelationSchema {
    SchemaUtils.throwIfAccessingFieldFromRelation(relationName, collectionName);

    const relations = Object.keys(schema.fields).filter(
      name => schema.fields[name].type !== 'Column',
    );

    if (!relations.find(name => name === relationName)) {
      throw new MissingRelationError({
        fieldName: relationName,
        availableFields: relations,
        collectionName,
      });
    }

    return schema.fields[relationName] as RelationSchema;
  }

  static getPrimaryKeys(schema: CollectionSchema): string[] {
    return Object.keys(schema.fields).filter(name => this.isPrimaryKey(schema, name));
  }

  static isPrimaryKey(schema: CollectionSchema, fieldName: string): boolean {
    const field = this.getField(schema, fieldName);

    return field.type === 'Column' && field.isPrimaryKey;
  }

  static isForeignKey(schema: CollectionSchema, name: string): boolean {
    const field = this.getField(schema, name);

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

  static getColumnNames(schema: CollectionSchema): string[] {
    return Object.keys(schema.fields).filter(
      name => SchemaUtils.getField(schema, name).type === 'Column',
    );
  }

  private static throwIfAccessingFieldFromRelation(
    fieldName: string,
    collectionName?: string,
  ): void {
    if (fieldName.includes(':')) {
      throw new RelationFieldAccessDeniedError({ fieldName, collectionName });
    }
  }
}
