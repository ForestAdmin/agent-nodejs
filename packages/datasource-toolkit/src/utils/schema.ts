import { Collection } from '../interfaces/collection';
import { CollectionSchema, FieldTypes, RelationSchema } from '../interfaces/schema';

export default class SchemaUtils {
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

  static getInverseRelation(collection: Collection, name: string): string {
    const relation = collection.schema.fields[name] as RelationSchema;
    const foreignCollection = collection.dataSource.getCollection(relation.foreignCollection);
    const inverse = Object.entries(foreignCollection.schema.fields).find(([, field]) => {
      const isOneToManyInverse =
        relation.type === FieldTypes.ManyToOne &&
        (field.type === FieldTypes.OneToMany || field.type === FieldTypes.OneToOne) &&
        field.foreignKey === relation.foreignKey;

      const isManyToOneInverse =
        relation.type === FieldTypes.OneToMany ||
        (relation.type === FieldTypes.OneToOne &&
          field.type === FieldTypes.ManyToOne &&
          field.foreignKey === relation.foreignKey);

      const isManyToManyInverse =
        relation.type === FieldTypes.ManyToMany &&
        field.type === FieldTypes.ManyToMany &&
        field.throughCollection === relation.throughCollection &&
        field.foreignKey === relation.otherField &&
        field.otherField === relation.foreignKey;

      return (
        field.type !== FieldTypes.Column &&
        field.foreignCollection === collection.name &&
        (isManyToManyInverse || isOneToManyInverse || isManyToOneInverse)
      );
    }) as [string, RelationSchema];

    return inverse ? inverse[0] : null;
  }
}
