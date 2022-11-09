import { ActionSchema, FieldSchema, ManyToManySchema, OneToManySchema } from './interfaces/schema';

export default class CollectionSchema {
  actions: { [actionName: string]: ActionSchema } = {};
  charts: string[] = [];
  countable = false;
  fields: { [fieldName: string]: FieldSchema } = {};
  searchable = false;
  segments: string[] = [];

  get primaryKeys(): string[] {
    return Object.keys(this.fields).filter(name => this.isPrimaryKey(name));
  }

  isPrimaryKey(fieldName: string): boolean {
    const field = this.fields[fieldName];

    return field.type === 'Column' && field.isPrimaryKey;
  }

  isForeignKey(name: string): boolean {
    const field = this.fields[name];

    return (
      field.type === 'Column' &&
      Object.values(this.fields).some(
        relation => relation.type === 'ManyToOne' && relation.foreignKey === name,
      )
    );
  }

  getToManyRelation(relationName: string): ManyToManySchema | OneToManySchema {
    const relationFieldSchema = this.fields[relationName];

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
