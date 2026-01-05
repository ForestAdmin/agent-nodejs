import type { CollectionSchema } from '../../../src/interfaces/schema';

import { Factory } from 'fishery';

export class CollectionSchemaFactory extends Factory<CollectionSchema> {
  unsearchable(): CollectionSchemaFactory {
    return this.params({ searchable: false });
  }
}

export default CollectionSchemaFactory.define(() => ({
  actions: {},
  countable: true,
  charts: [],
  fields: {},
  searchable: true,
  segments: [],
}));
