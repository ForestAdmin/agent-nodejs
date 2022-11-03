import { CollectionSchema, ManyToManySchema, OneToManySchema } from '../interfaces/schema';

export default class SchemaUtils {
  static getPrimaryKeys(schema: CollectionSchema): string[] {
    return Object.keys(schema.fields).filter(name => this.isPrimaryKey(schema, name));
  }

  static isPrimaryKey(schema: CollectionSchema, fieldName: string): boolean {
    const field = schema.fields[fieldName];

    return field.type === 'Column' && field.isPrimaryKey;
  }

  static isForeignKey(schema: CollectionSchema, name: string): boolean {
    const field = schema.fields[name];

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
    const relationFieldSchema = schema.fields[relationName];

    if (!relationFieldSchema) throw new Error(`Relation '${relationName}' not found`);

    if (relationFieldSchema.type !== 'OneToMany' && relationFieldSchema.type !== 'ManyToMany') {
      throw new Error(
        `Relation ${relationName} has invalid type should be one of ` +
          `${'OneToMany'} or ${'ManyToMany'}.`,
      );
    }

    return relationFieldSchema as ManyToManySchema | OneToManySchema;
  }
}
