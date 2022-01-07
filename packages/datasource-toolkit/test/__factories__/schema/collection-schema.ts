import { Factory } from 'fishery';
import { CollectionSchema } from '../../../src/interfaces/schema';

export default Factory.define<CollectionSchema>(() => ({
  actions: {},
  fields: {},
  searchable: true,
  segments: [],
}));
