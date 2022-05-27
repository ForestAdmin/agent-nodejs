import { BaseDataSource } from '@forestadmin/datasource-toolkit';
import { Connection } from 'mongoose';

import MongooseCollection from './collection';
import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  private connection: Connection;

  constructor(connection: Connection, pathsToFlatten: string[] = []) {
    super();

    if (!connection) throw new Error('Invalid (null) Mongoose instance.');

    this.connection = connection;

    this.createCollections(pathsToFlatten);
  }

  private createCollections(pathsToFlatten: string[] = []) {
    Object.values(this.connection.models).forEach(model => {
      this.addCollection(new MongooseCollection(this, model, pathsToFlatten));
    });
    SchemaFieldsGenerator.addNewCollectionAndInverseRelationships(this.collections);
  }

  // `generateCollectionAndRelation` parameter allow to generate
  // the collection and the relations when adding a new collection.
  // It is not activated by default because we let to
  // the user the right moment to generate the relations
  public override addCollection(
    collection: MongooseCollection,
    generateCollectionAndRelation = false,
  ): void {
    if (this._collections[collection.name] !== undefined)
      throw new Error(`Collection '${collection.name}' already defined in datasource`);

    this._collections[collection.name] = collection;

    if (generateCollectionAndRelation) {
      SchemaFieldsGenerator.addNewCollectionAndInverseRelationships([collection]);
    }
  }
}
