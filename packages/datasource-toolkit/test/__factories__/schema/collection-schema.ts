import { Factory } from 'fishery';
import { CollectionSchema } from '../../../src/interfaces/schema';

export class CollectionSchemaFactory extends Factory<CollectionSchema> {
  buildUnsearchable(partialCollection?: Partial<CollectionSchema>): CollectionSchema {
    return this.build({ ...partialCollection, searchable: false });
  }
}

export default CollectionSchemaFactory.define(() => ({
  actions: {},
  fields: {},
  searchable: true,
  segments: [],
}));
