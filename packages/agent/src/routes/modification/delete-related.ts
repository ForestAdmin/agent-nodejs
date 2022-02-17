import { Collection } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import { ForestAdminHttpDriverServices } from '../../services';

export default class DeleteRelated {
  services: ForestAdminHttpDriverServices;
  collection: Collection;
  foreignCollection: Collection;
  relationName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    collection: Collection,
    foreignCollection: Collection,
    relationName: string,
  ) {
    this.collection = collection;
    this.foreignCollection = foreignCollection;
    this.services = services;
    this.relationName = relationName;
  }

  async handleDeleteRelatedRoute(context: Context): Promise<void> {
    // remove related data and remove record
    void context;
  }
}
