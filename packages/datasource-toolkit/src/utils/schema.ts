import {
  CollectionSchema,
  FieldTypes,
  CollectionSchema,
  FieldSchema,
  FieldTypes,
  RelationSchema,
} from '../interfaces/schema';
import { Collection } from '../interfaces/collection';

export default class SchemaUtils {
  static getField(name: string, schema: CollectionSchema): FieldSchema {
    return schema.fields[name];
  }

  static getPrimaryKeys(schema: CollectionSchema): string[] {
    return Object.keys(schema.fields).filter(fieldName => {
      const field = schema.fields[fieldName];

      return field.type === FieldTypes.Column && field.isPrimaryKey;
    });
  }

  static isSolelyForeignKey(schema: CollectionSchema, name: string): boolean {
    const field = schema.fields[name];

    return (
      field.type === FieldTypes.Column &&
      !field.isPrimaryKey &&
      Object.values(schema.fields).some(
        relation => relation.type === FieldTypes.ManyToOne && relation.foreignKey === name,
      )
    );
  }
}
