import {
  CollectionSchema,
  FieldTypes,
  ManyToManySchema,
  OneToManySchema,
  RelationSchema,
} from '../interfaces/schema';

export default class SchemaUtils {
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

  static getToManyRelation(
    schema: CollectionSchema,
    relationName: string,
  ): ManyToManySchema | OneToManySchema {
    const relationFieldSchema = schema.fields[relationName];

    if (!relationFieldSchema) throw new Error(`Relation '${relationName}' not found`);

    if (
      relationFieldSchema.type !== FieldTypes.OneToMany &&
      relationFieldSchema.type !== FieldTypes.ManyToMany
    ) {
      throw new Error(
        `Relation ${relationName} has invalid type should be one of ` +
          `${FieldTypes.OneToMany} or ${FieldTypes.ManyToMany}.`,
      );
    }

    return relationFieldSchema as ManyToManySchema | OneToManySchema;
  }
}
