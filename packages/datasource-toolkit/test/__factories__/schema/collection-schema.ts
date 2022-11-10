/* eslint-disable max-classes-per-file */
import { Factory } from 'fishery';

import CollectionSchema from '../../../src/collection-schema';

export class CollectionSchemaFactory extends Factory<CollectionSchema> {
  unsearchable(): CollectionSchemaFactory {
    return this.params({ searchable: false });
  }
}

export default CollectionSchemaFactory.define(() =>
  Object.assign(new CollectionSchema(), {
    actions: {},
    countable: true,
    charts: [],
    fields: {},
    searchable: true,
    segments: [],
  }),
);
