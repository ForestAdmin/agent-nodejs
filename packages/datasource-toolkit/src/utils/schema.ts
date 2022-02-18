import { CollectionSchema, FieldTypes, RelationSchema } from '../interfaces/schema';

export default class SchemaUtils {
  static getRelationName(schema: CollectionSchema, name) {
    return Object.entries(schema.fields).find(([, fieldSchema]) => {
      return Object.values(fieldSchema).find(value => value === name);
    })[0];
  }

  static getForeignKeyName(schema: CollectionSchema, relationName: string): string {
    const schemaRelation = schema.fields[relationName] as RelationSchema;

    return schemaRelation?.foreignKey ?? null;
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
