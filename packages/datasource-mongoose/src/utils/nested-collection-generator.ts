/* eslint-disable no-underscore-dangle */
import {
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
} from '@forestadmin/datasource-toolkit';
import ManyToManyMongooseCollection from '../collections/many-to-many';
import MongooseCollection from '../collections/collection';
import NameFactory from './name-factory';

export default class NestedCollectionGenerator {
  static addNewCollectionAndInverseRelationships(collections: MongooseCollection[]): void {
    // avoid to create two times the many to many collection
    // when iterating on the many to many type field schema
    const createdManyToMany: string[] = [];
    const isAlreadyCreated = name => createdManyToMany.includes(name);
    collections.forEach(collection => {
      Object.entries(collection.schema.fields).forEach(([fieldName, fieldSchema]) => {
        if (fieldSchema.type === 'ManyToOne') {
          this.addOneToManyRelation(fieldSchema, collection);
        } else if (fieldSchema.type === 'ManyToMany' && !isAlreadyCreated(fieldName)) {
          this.addManyToManyRelationAndCollection(fieldSchema, collection, createdManyToMany);
        }
      });
    });
  }

  private static addManyToManyRelationAndCollection(
    fieldSchema: ManyToManySchema,
    collection: MongooseCollection,
    createdManyToMany: string[],
  ): void {
    const foreignCollection = collection.dataSource.getCollection(
      fieldSchema.foreignCollection,
    ) as MongooseCollection;
    const foreignKey = NameFactory.generateKey(collection.name);
    const originKey = fieldSchema.foreignKey;
    const { throughCollection } = fieldSchema;

    const manyToMany = NameFactory.manyToManyName(
      foreignCollection.name,
      fieldSchema.originKey,
      throughCollection,
    );
    createdManyToMany.push(manyToMany);

    foreignCollection.schema.fields[manyToMany] = {
      throughCollection,
      foreignKey,
      originKey,
      foreignCollection: collection.name,
      type: 'ManyToMany',
      foreignKeyTarget: '_id',
      originKeyTarget: '_id',
    } as ManyToManySchema;

    collection.dataSource.addCollection(
      new ManyToManyMongooseCollection(
        collection,
        foreignCollection,
        NameFactory.getOriginFieldNameOfIds(throughCollection),
        manyToMany,
      ),
    );
  }

  private static addOneToManyRelation(
    schema: ManyToOneSchema,
    collection: MongooseCollection,
  ): void {
    const foreignCollection = collection.dataSource.getCollection(
      schema.foreignCollection,
    ) as MongooseCollection;
    const field = NameFactory.oneToMany(foreignCollection.name, schema.foreignKey);
    foreignCollection.schema.fields[field] = {
      foreignCollection: collection.name,
      originKey: schema.foreignKey,
      originKeyTarget: '_id',
      type: 'OneToMany',
    } as OneToManySchema;
  }
}
