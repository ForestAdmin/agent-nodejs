import { Collection } from '../interfaces/collection';
import { FieldSchema, FieldTypes, RelationSchema } from '../interfaces/schema';

export default class CollectionUtils {
  static getFieldSchema(collection: Collection, field: string): FieldSchema {
    const dotIndex = field.indexOf(':');

    if (dotIndex === -1) {
      if (!collection.schema.fields[field]) {
        throw new Error(`Field '${field}' not found on collection '${collection.name}'`);
      }

      return collection.schema.fields[field];
    }

    const prefix = field.substring(0, dotIndex);
    const schema = collection.schema.fields[prefix];

    if (!schema) {
      throw new Error(`Relation '${prefix}' not found on collection ${collection.name}`);
    } else if (schema.type === FieldTypes.ManyToOne || schema.type === FieldTypes.OneToOne) {
      const target = collection.dataSource.getCollection(schema.foreignCollection);
      const suffix = field.substring(dotIndex + 1);

      return CollectionUtils.getFieldSchema(target, suffix);
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
