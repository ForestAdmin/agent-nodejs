import { Collection, ManyToOneSchema } from '@forestadmin/datasource-toolkit';

import MongooseCollection from '../../collection';
import MongooseSchema from '../../mongoose/schema';
import { escape } from '../helpers';

/** Generate all relations which are not explicitly written in the mongoose schema using `ref` */
export default class RelationGenerator {
  /**
   * Scan collections for many to one relations, and inject all the other relations in the schemas
   * (one to one, one to many, many to many)
   */
  static addImplicitRelations(collections: MongooseCollection[]): void {
    for (const collection of collections) {
      const manyToOnes = Object.entries(collection.schema.fields).filter(
        ([, f]) => f.type === 'ManyToOne',
      ) as [string, ManyToOneSchema][];

      // Create one-to-many and one-to-one
      for (const [name, field] of manyToOnes) {
        this.addManyToOneInverse(collection, name, field);
      }

      // @fixme this will break if _id is both a foreignkey and a pk
      // Create many to many (5 fields == _id + 2 relations + 2 foreignKeys)
      if (manyToOnes.length === 2 && Object.keys(collection.schema.fields).length === 5) {
        this.addManyToMany(collection, manyToOnes[0][1], manyToOnes[1][1]);
        this.addManyToMany(collection, manyToOnes[1][1], manyToOnes[0][1]);
      }
    }
  }

  /**
   * Given any many to one relation, generated while parsing mongoose schema, generate the
   * inverse relationship on the foreignCollection.
   *
   * /!\ The inverse can be a OneToOne, or a ManyToOne
   */
  private static addManyToOneInverse(
    collection: MongooseCollection,
    name: string,
    schema: ManyToOneSchema,
  ): void {
    let type: 'OneToMany' | 'OneToOne';
    let inverseName: string;

    if (name === 'parent') {
      // Create inverse of 'parent' relationship so that the relation name matches the actual name
      // of the data which is stored in the database.
      const childSchema = MongooseSchema.fromModel(collection.model).getSubSchema(
        collection.prefix,
        true,
      );

      inverseName = escape(collection.prefix.substring(collection.prefix.lastIndexOf('.') + 1));
      type = childSchema.fields.parent[inverseName]['[]'] ? 'OneToMany' : 'OneToOne';
    } else {
      // Native ManyToOne relationship (there is an actual foreign key in the document, this is
      // not an embedded document that we're faking as a relation).
      inverseName = escape(`${collection.name}_${name}__inverse`);
      type = 'OneToMany';
    }

    const otherCollection = collection.dataSource.getCollection(schema.foreignCollection);

    otherCollection.schema.fields[inverseName] = {
      type,
      foreignCollection: collection.name,
      originKey: schema.foreignKey,
      originKeyTarget: schema.foreignKeyTarget,
    };
  }

  /** Generate many to many from two many to one */
  private static addManyToMany(
    throughCollection: Collection,
    originRelation: ManyToOneSchema,
    foreignRelation: ManyToOneSchema,
  ): void {
    const origin = throughCollection.dataSource.getCollection(originRelation.foreignCollection);
    const relationName = escape(
      `${foreignRelation.foreignCollection}_through_${throughCollection.name}`,
    );

    origin.schema.fields[relationName] = {
      type: 'ManyToMany',
      throughCollection: throughCollection.name,
      foreignCollection: foreignRelation.foreignCollection,
      foreignKey: foreignRelation.foreignKey,
      foreignKeyTarget: foreignRelation.foreignKeyTarget,
      originKey: originRelation.foreignKey,
      originKeyTarget: originRelation.foreignKeyTarget,
    };
  }
}
