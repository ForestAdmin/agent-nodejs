import { Collection } from '../interfaces/collection';
import { FieldSchema, FieldTypes, RelationSchema } from '../interfaces/schema';

export default class CollectionUtils {
  static getFieldSchema(collection: Collection, path: string): FieldSchema {
    const dotIndex = path.indexOf(':');

    if (dotIndex === -1) {
      if (!collection.schema.fields[path]) {
        throw new Error(`Field '${path}' not found on collection '${collection.name}'`);
      }

      return collection.schema.fields[path];
    }

    const field = path.substring(0, dotIndex);
    const schema = collection.schema.fields[field];

    if (!schema) {
      throw new Error(`Relation '${field}' not found on collection '${collection.name}'`);
    } else if (schema.type === FieldTypes.ManyToOne || schema.type === FieldTypes.OneToOne) {
      const target = collection.dataSource.getCollection(schema.foreignCollection);
      const childField = path.substring(dotIndex + 1);

      return CollectionUtils.getFieldSchema(target, childField);
    } else {
      throw new Error(`Invalid relation type: ${schema.type}`);
    }
  }

  static getInverseRelation(collection: Collection, relationName: string): string {
    const relation = collection.schema.fields[relationName] as RelationSchema;
    const foreignCollection = collection.dataSource.getCollection(relation.foreignCollection);
    const inverse = Object.entries(foreignCollection.schema.fields).find(
      ([, field]: [string, RelationSchema]) => {
        const isManyToManyInverse =
          field.type === FieldTypes.ManyToMany &&
          relation.type === FieldTypes.ManyToMany &&
          field.otherField === relation.foreignKey &&
          field.throughCollection === relation.throughCollection &&
          field.foreignKey === relation.otherField;

        const isManyToOneInverse =
          field.type === FieldTypes.ManyToOne &&
          (relation.type === FieldTypes.OneToMany || relation.type === FieldTypes.OneToOne) &&
          field.foreignKey === relation.foreignKey;

        const isOtherInverse =
          (field.type === FieldTypes.OneToMany || field.type === FieldTypes.OneToOne) &&
          relation.type === FieldTypes.ManyToOne &&
          field.foreignKey === relation.foreignKey;

        return (
          (isManyToManyInverse || isManyToOneInverse || isOtherInverse) &&
          field.foreignCollection === collection.name
        );
      },
    ) as [string, RelationSchema];

    return inverse ? inverse[0] : null;
  }
}
